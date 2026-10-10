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
//   link       { code }                      -> { userId, username }
//   unlink     {}                            -> { ok }
//   listings   { page }                      -> { listings, hasMore }
//   item       { itemId }                    -> { item }
//   revise     { itemId, changes }           -> { ok }
//   uploadPhoto { dataUrl }                  -> { url }
//   end        { itemId }                    -> { ok }
//
// Errors: { error, code } with code 'not_linked' or 'reauth' when the user
// must connect eBay again, 'ebay' for an eBay-side refusal.
//
// Secrets: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME,
// EBAY_ENV ('sandbox' for the sandbox hosts, anything else is production).

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.5.0';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';

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
].join(' ');

const TRADING_VERSION = '1451';

const SITE_IDS: Record<string, number> = {
  EBAY_US: 0, EBAY_CA: 2, EBAY_GB: 3, EBAY_AU: 15, EBAY_AT: 16, EBAY_FR: 71,
  EBAY_DE: 77, EBAY_IT: 101, EBAY_NL: 146, EBAY_ES: 186, EBAY_IE: 205,
};

const ARRAY_PATHS = new Set([
  'GetMyeBaySellingResponse.ActiveList.ItemArray.Item',
  'GetMyeBaySellingResponse.SoldList.OrderTransactionArray.OrderTransaction',
  'GetMyeBaySellingResponse.SoldList.OrderTransactionArray.OrderTransaction.Order.TransactionArray.Transaction',
  'GetItemResponse.Item.PictureDetails.PictureURL',
  'GetItemResponse.Item.ItemSpecifics.NameValueList',
  'GetItemResponse.Item.ItemSpecifics.NameValueList.Value',
]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  parseTagValue: false,
  isArray: (_name: string, jpath: string) => ARRAY_PATHS.has(jpath) || jpath.endsWith('.Errors'),
});

class EbayError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

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

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  return parseTrading(call, await res.text());
}

function parseTrading(call: string, text: string) {
  const body = xml.parse(text)?.[`${call}Response`];
  if (!body) throw new EbayError(`Unexpected eBay response to ${call}`, 'ebay', 502);
  if (body.Ack === 'Failure' || body.Ack === 'PartialFailure') {
    const errors = (body.Errors ?? []).filter((e) => e.SeverityCode === 'Error');
    // 931/932/21916013: the token eBay was given is no longer valid.
    const reauth = errors.some((e) => ['931', '932', '21916013'].includes(String(e.ErrorCode)));
    const message = errors.map((e) => e.LongMessage ?? e.ShortMessage).join(' ') || `${call} failed`;
    throw new EbayError(message, reauth ? 'reauth' : 'ebay');
  }
  return body;
}

const money = (amount) =>
  amount ? { value: Number(amount['#text'] ?? amount), currency: amount['@currencyID'] ?? null } : null;

function summaryFromActive(item) {
  const price = money(item.SellingStatus?.CurrentPrice);
  return {
    itemId: String(item.ItemID),
    title: item.Title ?? '',
    price: price?.value ?? 0,
    currency: price?.currency ?? null,
    quantity: Number(item.QuantityAvailable ?? item.Quantity ?? 1),
    photo: item.PictureDetails?.GalleryURL ?? null,
    url: item.ListingDetails?.ViewItemURL ?? null,
    createdAt: item.ListingDetails?.StartTime ?? null,
    watchCount: item.WatchCount != null ? Number(item.WatchCount) : null,
    status: 'active',
  };
}

function soldTransactions(list) {
  return (list?.OrderTransactionArray?.OrderTransaction ?? []).flatMap(
    (ot) => (ot.Transaction ? [ot.Transaction] : ot.Order?.TransactionArray?.Transaction ?? []),
  );
}

function summaryFromSold(tx) {
  const item = tx.Item ?? {};
  const price = money(tx.TotalTransactionPrice ?? item.SellingStatus?.CurrentPrice);
  return {
    itemId: String(item.ItemID),
    title: item.Title ?? '',
    price: price?.value ?? 0,
    currency: price?.currency ?? null,
    quantity: 0,
    photo: item.PictureDetails?.GalleryURL ?? null,
    url: item.ListingDetails?.ViewItemURL ?? null,
    createdAt: item.ListingDetails?.StartTime ?? null,
    watchCount: null,
    status: 'sold',
  };
}

const PAGE_SIZE = 200;

async function listings(auth, page: number) {
  const pagination = `<Pagination><EntriesPerPage>${PAGE_SIZE}</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`;
  const body = await trading(
    'GetMyeBaySelling',
    auth,
    `<ActiveList><Include>true</Include><IncludeWatchCount>true</IncludeWatchCount>${pagination}</ActiveList>` +
      `<SoldList><Include>true</Include><DurationInDays>60</DurationInDays>${pagination}</SoldList>` +
      `<DetailLevel>ReturnAll</DetailLevel>`,
  );
  const active = (body.ActiveList?.ItemArray?.Item ?? []).map(summaryFromActive);
  const activeIds = new Set(active.map((l) => l.itemId));
  // A multi-quantity listing can be both selling and partly sold; it stays active.
  const sold = soldTransactions(body.SoldList)
    .map(summaryFromSold)
    .filter((l) => !activeIds.has(l.itemId));
  const pages = Math.max(
    Number(body.ActiveList?.PaginationResult?.TotalNumberOfPages ?? 0),
    Number(body.SoldList?.PaginationResult?.TotalNumberOfPages ?? 0),
  );
  return { listings: [...sold, ...active], hasMore: page < pages };
}

async function item(auth, itemId: string) {
  const body = await trading(
    'GetItem',
    auth,
    `<ItemID>${esc(itemId)}</ItemID><DetailLevel>ReturnAll</DetailLevel>` +
      `<IncludeItemSpecifics>true</IncludeItemSpecifics><IncludeWatchCount>true</IncludeWatchCount>`,
  );
  const it = body.Item;
  const price = money(it.StartPrice ?? it.SellingStatus?.CurrentPrice);
  const quantity = Number(it.Quantity ?? 0) - Number(it.SellingStatus?.QuantitySold ?? 0);
  const specifics: Record<string, string[]> = {};
  for (const nv of it.ItemSpecifics?.NameValueList ?? []) {
    specifics[nv.Name] = (nv.Value ?? []).map(String);
  }
  const listingStatus = it.SellingStatus?.ListingStatus;
  return {
    itemId: String(it.ItemID),
    title: it.Title ?? '',
    description: it.Description ?? '',
    price: price?.value ?? 0,
    currency: price?.currency ?? it.Currency ?? null,
    quantity,
    conditionId: it.ConditionID != null ? Number(it.ConditionID) : null,
    conditionName: it.ConditionDisplayName ?? null,
    photos: (it.PictureDetails?.PictureURL ?? []).map(String),
    specifics,
    categoryId: it.PrimaryCategory?.CategoryID ?? null,
    categoryName: it.PrimaryCategory?.CategoryName ?? null,
    url: it.ListingDetails?.ViewItemURL ?? null,
    createdAt: it.ListingDetails?.StartTime ?? null,
    watchCount: it.WatchCount != null ? Number(it.WatchCount) : null,
    hitCount: it.HitCount != null ? Number(it.HitCount) : null,
    hasVariations: !!it.Variations,
    status:
      listingStatus === 'Active'
        ? 'active'
        : Number(it.SellingStatus?.QuantitySold ?? 0) > 0
          ? 'sold'
          : 'hidden',
  };
}

async function revise(auth, itemId: string, c) {
  let fields = '';
  if (typeof c.title === 'string') fields += `<Title>${esc(c.title.slice(0, 80))}</Title>`;
  if (typeof c.description === 'string') fields += `<Description>${esc(c.description)}</Description>`;
  if (typeof c.price === 'number') fields += `<StartPrice>${c.price.toFixed(2)}</StartPrice>`;
  // Revise takes the available quantity; eBay adds the units already sold.
  if (Number.isInteger(c.quantity)) fields += `<Quantity>${c.quantity}</Quantity>`;
  if (Number.isInteger(c.conditionId)) fields += `<ConditionID>${c.conditionId}</ConditionID>`;
  // Both of these replace the whole list on eBay, so the caller sends the full set.
  if (Array.isArray(c.photos)) {
    fields += `<PictureDetails>${c.photos.map((u) => `<PictureURL>${esc(u)}</PictureURL>`).join('')}</PictureDetails>`;
  }
  if (c.specifics && typeof c.specifics === 'object') {
    fields +=
      '<ItemSpecifics>' +
      Object.entries(c.specifics)
        .map(
          ([name, values]) =>
            `<NameValueList><Name>${esc(name)}</Name>${[values]
              .flat()
              .map((v) => `<Value>${esc(v)}</Value>`)
              .join('')}</NameValueList>`,
        )
        .join('') +
      '</ItemSpecifics>';
  }
  if (!fields) return;
  await trading('ReviseFixedPriceItem', auth, `<Item><ItemID>${esc(itemId)}</ItemID>${fields}</Item>`);
}

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

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
  return { userId: me.userId, username: me.username ?? null };
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
