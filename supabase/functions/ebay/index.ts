// Supabase Edge Function: ebay
// ------------------------------------------------------------------------
// The extension's only route to eBay. Holds the app secret and each user's
// OAuth tokens (public.ebay_tokens, service role only) and speaks the Trading
// API on the user's behalf, returning plain JSON.
//
// Auth: the signed-in user's Supabase JWT in Authorization.
//
// Request body: { action, ...params }
//   consentUrl { state }                     -> { url }
//   link       { code }                      -> { userId, username, marketplace }
//   unlink     {}                            -> { ok }
//   account    {}                            -> { accountType } ('INDIVIDUAL' or 'BUSINESS')
//   listings   { page }                      -> { listings, hasMore }
//   item       { itemId }                    -> { item }
//   revise     { itemId, changes }           -> { ok }
//   uploadPhoto { dataUrl }                  -> { url }
//   end        { itemId }                    -> { ok }
//   relist     { itemId }                    -> { itemId } (the new listing's id)
//   add        { item }                      -> { itemId } (AddFixedPriceItem; item.templateItemId copies that listing's postage and returns)
//   shippingServices {}                      -> { services } ({ id, name }[], domestic, listable)
//   policies   {}                            -> { shipping, returns, payment } ({ id, name }[] each)
//   aspects    { categoryId }                -> { aspects } (Taxonomy item specifics)
//   categories { q }                         -> { categories } (Taxonomy suggestions)
//   conditions { categoryId }                -> { conditions } (allowed condition ids)
//   traffic    { itemIds }                   -> { views: { [itemId]: n } } (last 90 days)
//
// Errors: { error, code } with code 'not_linked' or 'reauth' when the user
// must connect eBay again, 'ebay' for an eBay-side refusal.
//
// Secrets: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME,
// EBAY_ENV ('sandbox' for the sandbox hosts, anything else is production).

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';
import {
  EbayError,
  esc,
  itemFromResponse,
  listingsFromResponse,
  parseTrading,
  trafficQuery,
  viewsFromTrafficReport,
  aspectsFromResponse,
  conditionsFromResponse,
  categorySuggestionsFromResponse,
  reviseFields,
  addItemXml,
  policiesFromPreferences,
  shippingFromItemXml,
  shippingServicesFromDetails,
} from './trading.ts';

const CORS_HEADERS = sharedCorsHeaders();

const SANDBOX = Deno.env.get('EBAY_ENV') === 'sandbox';
const AUTH_HOST = SANDBOX ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';
const API_HOST = SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const APIZ_HOST = SANDBOX ? 'https://apiz.sandbox.ebay.com' : 'https://apiz.ebay.com';

// sell.inventory and sell.account are for crosslisting, asked for now so
// linked users do not have to consent a second time when it ships.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
].join(' ');

const TRADING_VERSION = '1451';

const SITE_IDS: Record<string, number> = {
  EBAY_US: 0, EBAY_CA: 2, EBAY_GB: 3, EBAY_AU: 15, EBAY_AT: 16, EBAY_FR: 71,
  EBAY_DE: 77, EBAY_IT: 101, EBAY_NL: 146, EBAY_ES: 186, EBAY_IE: 205,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new EbayError(`${name} not configured`, 'not_configured', 500);
  return v;
}

// ── OAuth ──────────────────────────────────────────────────────────────────

async function tokenRequest(params: Record<string, string>) {
  const basic = btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);
  const res = await fetch(`${API_HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant: the refresh token was revoked or expired.
    const code = body.error === 'invalid_grant' ? 'reauth' : 'ebay';
    throw new EbayError(body.error_description ?? `eBay token error ${res.status}`, code);
  }
  return body as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

async function accessTokenFor(admin, userId: string): Promise<{ token: string; siteId: number }> {
  const { data: row, error } = await admin
    .from('ebay_tokens')
    .select('access_token, access_expires_at, refresh_token, site_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new EbayError('Token lookup failed', 'unavailable', 500);
  if (!row) throw new EbayError('eBay is not connected', 'not_linked', 409);

  if (new Date(row.access_expires_at).getTime() - Date.now() > 60_000) {
    return { token: row.access_token, siteId: row.site_id };
  }
  const fresh = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
    scope: SCOPES,
  });
  await admin
    .from('ebay_tokens')
    .update({
      access_token: fresh.access_token,
      access_expires_at: inSeconds(fresh.expires_in),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  return { token: fresh.access_token, siteId: row.site_id };
}

// ── Trading API ────────────────────────────────────────────────────────────

async function trading(call: string, auth: { token: string; siteId: number }, inner: string) {
  return parseTrading(call, await tradingText(call, auth, inner));
}

async function tradingText(call: string, auth: { token: string; siteId: number }, inner: string) {
  const res = await fetch(`${API_HOST}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': call,
      'X-EBAY-API-SITEID': String(auth.siteId),
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_VERSION,
      'X-EBAY-API-IAF-TOKEN': auth.token,
      'Content-Type': 'text/xml',
    },
    body:
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<${call}Request xmlns="urn:ebay:apis:eBLBaseComponents">` +
      `<ErrorLanguage>en_GB</ErrorLanguage>${inner}</${call}Request>`,
  });
  return res.text();
}

const PAGE_SIZE = 200;

async function listings(auth, page: number) {
  const pagination = `<Pagination><EntriesPerPage>${PAGE_SIZE}</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`;
  const body = await trading(
    'GetMyeBaySelling',
    auth,
    `<ActiveList><Include>true</Include><IncludeWatchCount>true</IncludeWatchCount>${pagination}</ActiveList>` +
      `<SoldList><Include>true</Include><DurationInDays>60</DurationInDays>${pagination}</SoldList>` +
      `<UnsoldList><Include>true</Include><DurationInDays>60</DurationInDays>${pagination}</UnsoldList>` +
      `<DetailLevel>ReturnAll</DetailLevel>`,
  );
  return listingsFromResponse(body, page);
}

async function item(auth, itemId: string) {
  const body = await trading(
    'GetItem',
    auth,
    `<ItemID>${esc(itemId)}</ItemID><DetailLevel>ReturnAll</DetailLevel>` +
      `<IncludeItemSpecifics>true</IncludeItemSpecifics><IncludeWatchCount>true</IncludeWatchCount>`,
  );
  return itemFromResponse(body);
}

async function revise(auth, itemId: string, c) {
  const fields = reviseFields(c);
  if (!fields) return;
  await trading('ReviseFixedPriceItem', auth, `<Item><ItemID>${esc(itemId)}</ItemID>${fields}</Item>`);
}

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const TRAFFIC_BATCH = 200;

const MARKETPLACE_BY_SITE = Object.fromEntries(Object.entries(SITE_IDS).map(([m, id]) => [id, m]));

async function rest(auth, path: string) {
  const res = await fetch(`${API_HOST}${path}`, { headers: { Authorization: `Bearer ${auth.token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new EbayError(body?.errors?.[0]?.message ?? `eBay request failed (${res.status})`, 'ebay', 502);
  }
  return body;
}

async function uploadPhoto(auth, dataUrl: string): Promise<string> {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(dataUrl ?? '');
  if (!m) throw new EbayError('Expected an image data URL', 'bad_request');
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  if (bytes.length > MAX_PHOTO_BYTES) throw new EbayError('Photo is too large', 'bad_request');

  const form = new FormData();
  form.append(
    'XML Payload',
    `<?xml version="1.0" encoding="utf-8"?>` +
      `<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">` +
      `<PictureSet>Supersize</PictureSet></UploadSiteHostedPicturesRequest>`,
  );
  form.append('image', new Blob([bytes], { type: m[1] }), 'photo');
  const res = await fetch(`${API_HOST}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
      'X-EBAY-API-SITEID': String(auth.siteId),
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_VERSION,
      'X-EBAY-API-IAF-TOKEN': auth.token,
    },
    body: form,
  });
  const body = parseTrading('UploadSiteHostedPictures', await res.text());
  return String(body.SiteHostedPictureDetails.FullURL);
}

// ── Linking ────────────────────────────────────────────────────────────────

async function link(admin, userScoped, userId: string, code: string) {
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env('EBAY_RUNAME'),
  });
  const res = await fetch(`${APIZ_HOST}/commerce/identity/v1/user/`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) throw new EbayError(`eBay identity lookup failed (${res.status})`, 'ebay');
  const me = await res.json();

  // linked_accounts first, through the user's own client, so the one-shop-per-
  // account index and the trial triggers decide before any token is kept.
  const { error: linkErr } = await userScoped.from('linked_accounts').upsert(
    {
      user_id: userId,
      platform: 'ebay',
      platform_user_id: me.userId,
      platform_username: me.username ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,platform' },
  );
  if (linkErr) {
    const msg = `${linkErr.code ?? ''} ${linkErr.message ?? ''}`;
    const code = msg.includes('platform_account_already_trialed')
      ? 'ALREADY_TRIALED'
      : msg.includes('23505') || msg.includes('linked_accounts_platform_identity_key')
        ? 'ALREADY_LINKED_ELSEWHERE'
        : 'UNKNOWN';
    throw new EbayError(linkErr.message ?? 'Link failed', code, 409);
  }

  const { error: tokErr } = await admin.from('ebay_tokens').upsert(
    {
      user_id: userId,
      ebay_user_id: me.userId,
      site_id: SITE_IDS[me.registrationMarketplaceId] ?? 3,
      access_token: tokens.access_token,
      access_expires_at: inSeconds(tokens.expires_in),
      refresh_token: tokens.refresh_token,
      refresh_expires_at: inSeconds(tokens.refresh_token_expires_in ?? 47_304_000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (tokErr) {
    console.error('[ebay] token store failed:', tokErr.message);
    throw new EbayError('Could not save the eBay connection', 'unavailable', 500);
  }
  return { userId: me.userId, username: me.username ?? null, marketplace: me.registrationMarketplaceId ?? null };
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Missing auth' });
  const jwt = authHeader.slice('Bearer '.length).trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: 'Supabase env missing' });

  const admin = createClient(supabaseUrl, serviceKey);
  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(jwt);
  if (userErr || !user) return json(401, { error: userErr?.message ?? 'Invalid session' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  try {
    switch (body?.action) {
      case 'consentUrl': {
        if (typeof body.state !== 'string' || !body.state) return json(400, { error: 'Missing state' });
        const url = new URL(`${AUTH_HOST}/oauth2/authorize`);
        url.search = new URLSearchParams({
          client_id: env('EBAY_CLIENT_ID'),
          redirect_uri: env('EBAY_RUNAME'),
          response_type: 'code',
          scope: SCOPES,
          state: body.state,
        }).toString();
        return json(200, { url: url.toString() });
      }

      case 'link': {
        if (typeof body.code !== 'string' || !body.code) return json(400, { error: 'Missing code' });
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        return json(200, await link(admin, userScoped, user.id, body.code));
      }

      case 'account': {
        const auth = await accessTokenFor(admin, user.id);
        const res = await fetch(`${APIZ_HOST}/commerce/identity/v1/user/`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!res.ok) throw new EbayError(`eBay identity lookup failed (${res.status})`, 'ebay', 502);
        const me = await res.json();
        return json(200, { accountType: me.accountType === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL' });
      }

      case 'unlink': {
        await admin.from('ebay_tokens').delete().eq('user_id', user.id);
        return json(200, { ok: true });
      }

      case 'listings': {
        const page = Number.isInteger(body.page) && body.page > 0 ? body.page : 1;
        return json(200, await listings(await accessTokenFor(admin, user.id), page));
      }

      case 'item': {
        if (typeof body.itemId !== 'string') return json(400, { error: 'Missing itemId' });
        return json(200, { item: await item(await accessTokenFor(admin, user.id), body.itemId) });
      }

      case 'revise': {
        if (typeof body.itemId !== 'string') return json(400, { error: 'Missing itemId' });
        await revise(await accessTokenFor(admin, user.id), body.itemId, body.changes ?? {});
        return json(200, { ok: true });
      }

      case 'uploadPhoto': {
        return json(200, { url: await uploadPhoto(await accessTokenFor(admin, user.id), body.dataUrl) });
      }

      case 'aspects': {
        const categoryId = String(body.categoryId ?? '');
        if (!/^\d+$/.test(categoryId)) return json(400, { error: 'Missing categoryId' });
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const tree = await rest(auth, `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplace}`);
        const aspects = await rest(
          auth,
          `/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_item_aspects_for_category?category_id=${categoryId}`,
        );
        return json(200, { aspects: aspectsFromResponse(aspects) });
      }

      case 'categories': {
        const q = typeof body.q === 'string' ? body.q.trim().slice(0, 100) : '';
        if (q.length < 2) return json(200, { categories: [] });
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const tree = await rest(auth, `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplace}`);
        const found = await rest(
          auth,
          `/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(q)}`,
        );
        return json(200, { categories: categorySuggestionsFromResponse(found) });
      }

      case 'conditions': {
        const categoryId = String(body.categoryId ?? '');
        if (!/^\d+$/.test(categoryId)) return json(400, { error: 'Missing categoryId' });
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const policies = await rest(
          auth,
          `/sell/metadata/v1/marketplace/${marketplace}/get_item_condition_policies?filter=${encodeURIComponent(`categoryIds:{${categoryId}}`)}`,
        );
        return json(200, { conditions: conditionsFromResponse(policies) });
      }

      case 'traffic': {
        const ids = Array.isArray(body.itemIds) ? body.itemIds.filter((i) => typeof i === 'string') : [];
        if (ids.length === 0) return json(200, { views: {} });
        const auth = await accessTokenFor(admin, user.id);
        const views: Record<string, number> = {};
        for (let i = 0; i < ids.length; i += TRAFFIC_BATCH) {
          const res = await fetch(
            `${API_HOST}/sell/analytics/v1/traffic_report?${trafficQuery(ids.slice(i, i + TRAFFIC_BATCH), new Date())}`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          const report = await res.json().catch(() => ({}));
          if (!res.ok) {
            // A token from before the analytics scope was asked for is refused here.
            const code = res.status === 403 ? 'scope' : 'ebay';
            throw new EbayError(report?.errors?.[0]?.message ?? `Traffic report failed (${res.status})`, code, res.status === 403 ? 403 : 502);
          }
          Object.assign(views, viewsFromTrafficReport(report));
        }
        return json(200, { views });
      }

      case 'add': {
        const auth = await accessTokenFor(admin, user.id);
        const item = { ...(body.item ?? {}) };
        // No business policies: copy postage, returns and location from one of the seller's listings.
        if (typeof item.templateItemId === 'string' && /^\d+$/.test(item.templateItemId)) {
          const text = await tradingText(
            'GetItem',
            auth,
            `<ItemID>${item.templateItemId}</ItemID><DetailLevel>ReturnAll</DetailLevel>`,
          );
          const template = parseTrading('GetItem', text).Item ?? {};
          item.copiedShipping = shippingFromItemXml(text);
          item.postcode = item.postcode || template.PostalCode || '';
        }
        const built = addItemXml(item, MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB');
        if (built.error) return json(400, { error: built.error, code: 'bad_request' });
        const res = await trading('AddFixedPriceItem', auth, built.xml);
        return json(200, { itemId: String(res.ItemID) });
      }

      case 'shippingServices': {
        const res = await trading(
          'GeteBayDetails',
          await accessTokenFor(admin, user.id),
          '<DetailName>ShippingServiceDetails</DetailName>',
        );
        return json(200, { services: shippingServicesFromDetails(res) });
      }

      case 'policies': {
        const res = await trading(
          'GetUserPreferences',
          await accessTokenFor(admin, user.id),
          '<ShowSellerProfilePreferences>true</ShowSellerProfilePreferences>',
        );
        return json(200, policiesFromPreferences(res));
      }

      case 'relist': {
        if (typeof body.itemId !== 'string') return json(400, { error: 'Missing itemId' });
        const res = await trading(
          'RelistFixedPriceItem',
          await accessTokenFor(admin, user.id),
          `<Item><ItemID>${esc(body.itemId)}</ItemID></Item>`,
        );
        return json(200, { itemId: String(res.ItemID) });
      }

      case 'end': {
        if (typeof body.itemId !== 'string') return json(400, { error: 'Missing itemId' });
        await trading(
          'EndFixedPriceItem',
          await accessTokenFor(admin, user.id),
          `<ItemID>${esc(body.itemId)}</ItemID><EndingReason>NotAvailable</EndingReason>`,
        );
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: `Unknown action: ${String(body?.action)}` });
    }
  } catch (err) {
    if (err instanceof EbayError) {
      console.warn(`[ebay] user=${user.id} action=${body?.action} code=${err.code}`);
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error(`[ebay] user=${user.id} action=${body?.action}`, err instanceof Error ? err.message : err);
    return json(502, { error: 'eBay request failed', code: 'unavailable' });
  }
});
