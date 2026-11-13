// Supabase Edge Function: shopify-public
// ------------------------------------------------------------------------
// The Shopify app's addresses that carry no SaleLinx session:
//
//   POST /app      The app's page in the Shopify admin (the website's
//                  app/embed/shopify), with an App Bridge ID token in
//                  Authorization. { action: 'session' } -> { shopName,
//                  shopDomain, linked, account, connectUrl }: the store's
//                  tokens are taken (token exchange) the first time it opens
//                  the app, and again when Shopify has refused the stored ones
//                  or the store has approved new permissions since. linked says
//                  whether a SaleLinx account holds the store, account that
//                  account's email, masked; connectUrl, when no account does, is
//                  where Connect goes. Errors { error, code }: 'invalid_session'
//                  (401) when the page should fetch a fresh ID token and retry.
//   GET  /connect  Connect's address: sends the tab on to the website's
//                  /shopify/connect with the code, where a signed-in seller
//                  connects the store (the shopify function's claimStore). The
//                  extension watches this address, as it may read supabase.co
//                  and not salelinx.com, and connects the store itself when
//                  the extension is signed in.
//   GET  /         The App URL until 2026-11-13: sent to the website.
//   POST /         Webhooks, verified against X-Shopify-Hmac-Sha256, all
//                  subscribed in shopify/shopify.app.toml:
//        app/uninstalled          deletes that store's tokens; the link stays,
//                                 so the extension asks the seller to reconnect
//        shop/redact              (48 hours after an uninstall) deletes the
//                                 store's tokens, link and listings
//        customers/data_request,  nothing to do: SaleLinx keeps no data about
//        customers/redact         a store's customers
//
// Secrets: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SITE_URL.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/security.ts';
import {
  ShopifyError,
  adminGraphql,
  connectCode,
  maskEmail,
  missingScopes,
  shopIdFromGid,
  verifyIdToken,
  verifyWebhook,
} from '../_shared/shopify.ts';
import {
  type ShopifyCreds,
  type TokenKey,
  accessToken,
  claimLock,
  exchangeIdToken,
  releaseLock,
  sleep,
  tokenColumns,
} from '../_shared/shopify-tokens.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.salelinx.com';

const SHOP_QUERY = '{ shop { id name myshopifyDomain } }';

const CORS_HEADERS = corsHeaders();

const text = (status: number, body: string) => new Response(body, { status });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

function creds(): ShopifyCreds {
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  if (!clientId || !secret) throw new ShopifyError('Not configured', 'not_configured', 500);
  return { clientId, secret };
}

const adminClient = () =>
  createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

// ── The app's page ─────────────────────────────────────────────────────────

/**
 * New tokens for the store from the page's ID token, under the row's lock when it has one: an
 * exchange retires every other refresh token for the store, so it must not cross a refresh. A
 * store installed again after an uninstall (which deleted its tokens, not its link) goes back to
 * the account it was linked to.
 */
async function exchange(admin, shop: string, idToken: string, c: ShopifyCreds, row) {
  const key: TokenKey = { column: 'shop_domain', value: shop };
  if (row) {
    let held = false;
    for (let attempt = 0; attempt < 8 && !held; attempt++) {
      held = !!(await claimLock(admin, key));
      if (!held) await sleep(500);
    }
    if (!held) throw new ShopifyError('Shopify is busy, try again', 'busy', 503);
  }
  try {
    const tokens = await exchangeIdToken(shop, idToken, c);
    if (!tokens.refresh_token) throw new ShopifyError('Shopify sent no refresh token', 'shopify');
    const { shop: me } = await adminGraphql(shop, tokens.access_token, SHOP_QUERY);
    const shopId = shopIdFromGid(me.id);
    let userId = row?.user_id ?? null;
    if (!row) {
      const { data: link } = await admin
        .from('linked_accounts')
        .select('user_id')
        .eq('platform', 'shopify')
        .eq('platform_user_id', shopId)
        .maybeSingle();
      userId = link?.user_id ?? null;
    }
    const { error } = await admin.from('shopify_tokens').upsert(
      {
        shop_id: shopId,
        shop_domain: me.myshopifyDomain ?? shop,
        user_id: userId,
        ...tokenColumns(tokens),
        refreshing_until: null,
      },
      { onConflict: 'shop_id' },
    );
    if (error) {
      console.error('[shopify-public] token store failed:', error.code ?? error.message);
      throw new ShopifyError('Could not save the Shopify connection', 'unavailable', 500);
    }
    return { me, shopId, userId };
  } catch (err) {
    if (row) await releaseLock(admin, key);
    throw err;
  }
}

async function session(admin, idToken: string) {
  const c = creds();
  const shop = await verifyIdToken(idToken, c.clientId, c.secret);
  const { data: row, error } = await admin
    .from('shopify_tokens')
    .select('shop_id, user_id, scope')
    .eq('shop_domain', shop)
    .maybeSingle();
  if (error) throw new ShopifyError('Token lookup failed', 'unavailable', 500);

  // The stored tokens while they still work and carry every permission; a store approves new
  // ones on its way into the app, and only an exchange brings them into a token.
  let store = null;
  if (row && missingScopes(row.scope).length === 0) {
    try {
      const auth = await accessToken(admin, { column: 'shop_domain', value: shop }, c);
      const { shop: me } = await adminGraphql(auth.shop, auth.token, SHOP_QUERY);
      store = { me, shopId: row.shop_id, userId: row.user_id };
    } catch (err) {
      if (!(err instanceof ShopifyError && err.code === 'reauth')) throw err;
    }
  }
  store ??= await exchange(admin, shop, idToken, c, row);

  const shopDomain = store.me.myshopifyDomain ?? shop;
  const shopName = store.me.name ?? null;
  let account = null;
  if (store.userId) {
    const { data } = await admin.auth.admin.getUserById(store.userId);
    account = maskEmail(data?.user?.email);
  }
  const code = store.userId
    ? null
    : await connectCode({ shopId: store.shopId, shopDomain, shopName }, c.secret);
  return {
    shopName,
    shopDomain,
    linked: !!store.userId,
    account,
    connectUrl: code
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-public/connect?code=${encodeURIComponent(code)}`
      : null,
  };
}

async function app(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const auth = req.headers.get('Authorization') ?? '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON', code: 'bad_request' });
  }
  if (body?.action !== 'session') {
    return json(400, { error: `Unknown action: ${String(body?.action)}`, code: 'bad_request' });
  }
  try {
    return json(200, await session(adminClient(), idToken));
  } catch (err) {
    if (err instanceof ShopifyError) {
      if (err.code !== 'invalid_session') console.warn(`[shopify-public] app code=${err.code}`);
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error('[shopify-public] app', err instanceof Error ? err.message : err);
    return json(502, { error: 'Shopify request failed', code: 'unavailable' });
  }
}

// ── Webhooks ───────────────────────────────────────────────────────────────

async function webhook(req: Request): Promise<Response> {
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  if (!secret) return text(500, 'Not configured');

  // The raw body, before any parsing: the signature covers its exact bytes.
  const raw = await req.text();
  if (!(await verifyWebhook(raw, req.headers.get('X-Shopify-Hmac-Sha256'), secret))) {
    return text(401, 'Bad signature');
  }

  const topic = req.headers.get('X-Shopify-Topic');
  const shopDomain = req.headers.get('X-Shopify-Shop-Domain') ?? '';
  const admin = adminClient();

  if (topic === 'app/uninstalled') {
    const { error } = await admin.from('shopify_tokens').delete().eq('shop_domain', shopDomain);
    if (error) {
      console.error(`[shopify-public] topic=${topic} delete failed`);
      return text(500, 'Retry');
    }
  } else if (topic === 'shop/redact') {
    let shopId = '';
    try {
      shopId = String(JSON.parse(raw).shop_id ?? '');
    } catch {
      return text(400, 'Bad body');
    }
    if (!shopId) return text(400, 'Bad body');
    const results = await Promise.all([
      admin.from('shopify_tokens').delete().eq('shop_id', shopId),
      admin
        .from('linked_accounts')
        .delete()
        .eq('platform', 'shopify')
        .eq('platform_user_id', shopId),
      admin.from('listings').delete().eq('platform', 'shopify').eq('platform_user_id', shopId),
    ]);
    if (results.some((r) => r.error)) {
      console.error(`[shopify-public] topic=${topic} delete failed`);
      return text(500, 'Retry');
    }
  }

  // Shopify retries anything but a 2xx, so every verified topic answers ok.
  return text(200, 'ok');
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/app')) return app(req);
  if (req.method === 'GET' && url.pathname.endsWith('/connect')) {
    const code = url.searchParams.get('code') ?? '';
    const target = new URL('/shopify/connect', SITE_URL);
    if (code) target.searchParams.set('code', code);
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  }
  if (req.method === 'GET') {
    return new Response(null, { status: 302, headers: { Location: SITE_URL } });
  }
  if (req.method !== 'POST') return text(405, 'Method not allowed');
  return webhook(req);
});
