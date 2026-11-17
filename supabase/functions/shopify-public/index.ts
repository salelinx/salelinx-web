// Supabase Edge Function: shopify-public
// ------------------------------------------------------------------------
// The Shopify app's addresses that carry no SaleLinx session:
//
//   POST /app      The app's page in the Shopify admin (the website's
//                  app/embed/shopify), with an App Bridge ID token in
//                  Authorization. { action: 'session', fresh? } -> { shopName,
//                  shopDomain, linked, account, connectUrl, ebay, billing }: the store's
//                  tokens are taken (token exchange) the first time it opens
//                  the app, and again when Shopify has refused the stored ones
//                  or the store has approved new permissions since. linked says
//                  whether a SaleLinx account holds the store, account that
//                  account's email, masked; connectUrl, when no account does, is
//                  where Connect goes; ebay, for a connected store, that
//                  account's eBay connection ({ linked, username, reconnect }),
//                  and billing, for a connected store once the Partner API is
//                  set up, the account's plan and Shopify's plan page
//                  ({ plan, doubleBilled, planPageUrl },
//                  _shared/shopify-billing.ts). fresh, sent after the welcome
//                  link (plan_handle), reads the plan again rather than from cache.
//                  { action: 'products', cursor?, query? } -> { currency,
//                  products, cursor }: a page of the store's products, newest
//                  changes first, each variant with the eBay listing it is
//                  linked to (_shared/shopify-app-page.ts); 'store_not_connected'
//                  (409) until an account holds the store.
//                  Errors { error, code }: 'invalid_session'
//                  (401) when the page should fetch a fresh ID token and retry.
//   GET  /connect  Connect's address: sends the tab on to the website's
//                  /shopify/connect with the code, where a signed-in seller
//                  connects the store (the shopify function's claimStore). The
//                  extension watches this address, as it may read supabase.co
//                  and not salelinx.com, and connects the store itself when
//                  the extension is signed in.
//   POST /sync     The hourly dashboard Cron job, with x-shopify-sync-secret
//                  (SHOPIFY_SYNC_SECRET): reads again the live plans Shopify
//                  bills, as App Pricing sends no webhooks for their changes
//                  (syncDueStores in _shared/shopify-billing.ts). -> { read,
//                  failed, stopped }
//   GET  /         The App URL until 2026-11-13: sent to the website.
//   POST /         Webhooks, verified against X-Shopify-Hmac-Sha256, all
//                  subscribed in shopify/shopify.app.toml:
//        app/uninstalled          deletes that store's tokens; the link stays,
//                                 so the extension asks the seller to reconnect.
//                                 The store's plan is read again, and its row
//                                 ends if Shopify no longer bills it
//        inventory_levels/update  (only a location's count reaching 0 or below)
//                                 a variant with none left ends its linked eBay
//                                 listing (_shared/shopify-sold-out.ts)
//        shop/redact              (48 hours after an uninstall) deletes the
//                                 store's tokens, link and listings
//        customers/data_request,  nothing to do: SaleLinx keeps no data about
//        customers/redact         a store's customers
//
// Secrets: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SITE_URL, the ebay
// function's EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_ENV (ebay/api.ts), and
// for billing SHOPIFY_PARTNER_ID, SHOPIFY_PARTNER_TOKEN, SHOPIFY_APP_ID and the
// sweep's SHOPIFY_SYNC_SECRET (_shared/shopify-billing.ts).

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, timingSafeEqual } from '../_shared/security.ts';
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
import { SAFE_LISTING_ID, linkedEbayRows } from '../_shared/link-groups.ts';
import {
  PAGE_PRODUCTS_QUERY,
  pageProduct,
  productSearchQuery,
  variantRowId,
} from '../_shared/shopify-app-page.ts';
import {
  type MemberRow,
  MEMBER_COLUMNS,
  SOLD_OUT_QUERY,
  ebayToEnd,
  ebayVerdict,
  groupFilter,
  groupMembers,
  hasStockLeft,
  inventoryItemGid,
  mightBeSoldOut,
  soldOutRowIds,
} from '../_shared/shopify-sold-out.ts';
import { checkFeatureAllowed } from '../_shared/feature-gate.ts';
import {
  billingConfigured,
  planPageUrl,
  syncAfterUninstall,
  syncDueStores,
  syncStorePlan,
} from '../_shared/shopify-billing.ts';
import { accessTokenFor, trading } from '../ebay/api.ts';
import { EbayError, esc, itemFromResponse, listingCall } from '../ebay/trading.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.salelinx.com';

// The app's handle is for Shopify's plan page (planPageUrl in _shared/shopify-billing.ts).
const SHOP_QUERY =
  '{ shop { id name myshopifyDomain } currentAppInstallation { app { handle } } }';

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
    const { shop: me, currentAppInstallation } = await adminGraphql(
      shop,
      tokens.access_token,
      SHOP_QUERY,
    );
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
    return { me, shopId, userId, appHandle: currentAppInstallation?.app?.handle ?? null };
  } catch (err) {
    if (row) await releaseLock(admin, key);
    throw err;
  }
}

/**
 * The account's eBay connection, for the app's page. An eBay link with no tokens means eBay refused
 * them (or they were deleted), so the seller must connect it again.
 */
async function ebayConnection(admin, userId: string) {
  const [link, tokens] = await Promise.all([
    admin
      .from('linked_accounts')
      .select('platform_username')
      .eq('user_id', userId)
      .eq('platform', 'ebay')
      .maybeSingle(),
    admin.from('ebay_tokens').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (link.error || tokens.error) throw new ShopifyError('eBay lookup failed', 'unavailable', 500);
  return {
    linked: !!link.data && !!tokens.data,
    username: link.data?.platform_username ?? null,
    reconnect: !!link.data && !tokens.data,
  };
}

/**
 * The account's plan for the app's page, and Shopify's plan page. Null until the Partner API is
 * set up, or when Shopify can't be asked just now: the page then leaves its plan section out
 * rather than offering a plan to an account that may already have one.
 */
async function billing(admin, store, shopDomain: string, fresh: boolean) {
  if (!billingConfigured()) return null;
  try {
    const state = await syncStorePlan(admin, store.shopId, store.userId, { fresh });
    return { ...state, planPageUrl: planPageUrl(shopDomain, store.appHandle) };
  } catch (err) {
    console.warn(`[shopify-public] billing code=${err?.code ?? 'error'}`);
    return null;
  }
}

async function session(admin, idToken: string, fresh: boolean) {
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
      const { shop: me, currentAppInstallation } = await adminGraphql(
        auth.shop,
        auth.token,
        SHOP_QUERY,
      );
      store = {
        me,
        shopId: row.shop_id,
        userId: row.user_id,
        appHandle: currentAppInstallation?.app?.handle ?? null,
      };
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
    ebay: store.userId ? await ebayConnection(admin, store.userId) : null,
    billing: store.userId ? await billing(admin, store, shopDomain, fresh) : null,
    connectUrl: code
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-public/connect?code=${encodeURIComponent(code)}`
      : null,
  };
}

// ── The product list ───────────────────────────────────────────────────────

/**
 * A page of the store's products for the app's page, each variant with its eBay listing. Only for
 * a store an account holds, as links and eBay belong to the account.
 */
async function products(admin, idToken: string, body) {
  const c = creds();
  const shop = await verifyIdToken(idToken, c.clientId, c.secret);
  if (body.cursor != null && (typeof body.cursor !== 'string' || body.cursor.length > 512)) {
    throw new ShopifyError('Bad cursor', 'bad_request', 400);
  }
  const { data: row, error } = await admin
    .from('shopify_tokens')
    .select('user_id')
    .eq('shop_domain', shop)
    .maybeSingle();
  if (error) throw new ShopifyError('Token lookup failed', 'unavailable', 500);
  if (!row?.user_id) {
    throw new ShopifyError('Connect the store to a SaleLinx account first', 'store_not_connected', 409);
  }
  const auth = await accessToken(admin, { column: 'shop_domain', value: shop }, c);
  const data = await adminGraphql(auth.shop, auth.token, PAGE_PRODUCTS_QUERY, {
    cursor: body.cursor ?? null,
    query: productSearchQuery(body.query),
  });
  const nodes = data?.products?.nodes ?? [];
  const rowIds = nodes
    .flatMap((p) =>
      (p?.variants?.nodes ?? []).map((v) =>
        variantRowId(String(p?.legacyResourceId), String(v?.legacyResourceId)),
      ),
    )
    .filter((id) => SAFE_LISTING_ID.test(id));
  let ebay;
  try {
    ebay = await linkedEbayRows(admin, row.user_id, rowIds);
  } catch {
    throw new ShopifyError('Listings lookup failed', 'unavailable', 500);
  }
  const page = data?.products?.pageInfo;
  return {
    currency: data?.shop?.currencyCode ?? null,
    products: nodes.map((p) => pageProduct(p, ebay)).filter(Boolean),
    cursor: page?.hasNextPage ? (page.endCursor ?? null) : null,
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
  try {
    switch (body?.action) {
      case 'session':
        return json(200, await session(adminClient(), idToken, body.fresh === true));
      case 'products':
        return json(200, await products(adminClient(), idToken, body));
      default:
        return json(400, { error: `Unknown action: ${String(body?.action)}`, code: 'bad_request' });
    }
  } catch (err) {
    if (err instanceof ShopifyError) {
      if (err.code !== 'invalid_session') console.warn(`[shopify-public] app code=${err.code}`);
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error('[shopify-public] app', err instanceof Error ? err.message : err);
    return json(502, { error: 'Shopify request failed', code: 'unavailable' });
  }
}

// ── A variant sold out ─────────────────────────────────────────────────────

/** Nothing a retry would change: the eBay or Shopify connection gone, or (`refusal`) eBay refusing
 *  a listing call, which says why in its answer. */
const settled = (err, refusal = false) =>
  (err instanceof EbayError &&
    (['not_linked', 'reauth'].includes(err.code) || (refusal && err.code === 'ebay'))) ||
  (err instanceof ShopifyError && ['not_linked', 'reauth'].includes(err.code));

/**
 * The variant's linked eBay listing ended, as the extension's takedown ends it when its poll sees
 * the sale (_shared/shopify-sold-out.ts has the rules). True when Shopify should send the webhook
 * again, as something failed that a retry could fix.
 */
async function endLinkedEbay(admin, userId: string, rowId: string): Promise<boolean> {
  const { data: row, error } = await admin
    .from('listings')
    .select(MEMBER_COLUMNS)
    .eq('user_id', userId)
    .eq('id', rowId)
    .maybeSingle();
  if (error) return true;
  // A Shopify row has to be saved to the cloud to be linked.
  if (!row) return false;
  const filter = groupFilter(rowId, row.link_id);
  if (!filter) return false;
  const { data: found, error: groupErr } = await admin
    .from('listings')
    .select(MEMBER_COLUMNS)
    .eq('user_id', userId)
    .or(filter);
  if (groupErr) return true;
  const members: MemberRow[] = groupMembers(rowId, found ?? []);
  const toEnd = ebayToEnd(members);
  if (toEnd.length === 0) return false;
  if (hasStockLeft([row, ...members])) {
    console.log(`[shopify-public] sold out: user=${userId} restock count left, eBay stays up`);
    return false;
  }
  // Ending listings by itself is linking's, as in the extension.
  const gate = await checkFeatureAllowed(admin, userId, 'account_linking', 'shopify-public');
  if (!gate.ok) return gate.status === 500;

  let retry = false;
  try {
    const auth = await accessTokenFor(admin, userId);
    for (const member of toEnd) {
      const itemId = esc(member.platform_listing_id);
      try {
        // One call against the shared quota, for whether it is still live and an auction.
        const item = itemFromResponse(
          await trading('GetItem', auth, `<ItemID>${itemId}</ItemID><DetailLevel>ReturnAll</DetailLevel>`),
        );
        if (ebayVerdict(item) === 'gone') continue;
        await trading(
          listingCall('end', !!item.auction),
          auth,
          `<ItemID>${itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`,
        );
        // Ended rather than removed: it stays on My Listings (Deleted, as a linked row is saved)
        // and can be relisted.
        const { error: statusErr } = await admin
          .from('listings')
          .update({ status: 'hidden' })
          .eq('user_id', userId)
          .eq('id', member.id);
        if (statusErr) console.warn(`[shopify-public] sold out: user=${userId} status write failed`);
        // The Restocker's count goes to 0 and off across the group, as the extension's does.
        if (member.restock_enabled) {
          await admin
            .from('listings')
            .update({ restock_quantity: 0, restock_enabled: false })
            .eq('user_id', userId)
            .in('id', [row.id, ...members.map((m) => m.id)]);
        }
        console.log(`[shopify-public] sold out: user=${userId} ended eBay ${member.id}`);
      } catch (err) {
        if (!settled(err, true)) retry = true;
        console.warn(
          `[shopify-public] sold out: user=${userId} eBay ${member.id} not ended code=${err?.code ?? 'error'}`,
        );
      }
    }
  } catch (err) {
    // No eBay connection to end it with.
    if (!settled(err)) throw err;
  }
  return retry;
}

/**
 * inventory_levels/update: a location's count changed, and Shopify only sends one reaching 0 or
 * below (shopify.app.toml). Each of the item's variants with none left anywhere ends its linked
 * eBay listing, with no browser open. True when Shopify should send it again.
 */
async function inventoryUpdate(admin, shop: string, payload): Promise<boolean> {
  const itemId = inventoryItemGid(payload);
  if (!itemId || !mightBeSoldOut(payload)) return false;
  const { data: store, error } = await admin
    .from('shopify_tokens')
    .select('user_id')
    .eq('shop_domain', shop)
    .maybeSingle();
  if (error) return true;
  // A store no account holds has no links.
  if (!store?.user_id) return false;
  try {
    const auth = await accessToken(admin, { column: 'shop_domain', value: shop }, creds());
    const data = await adminGraphql(auth.shop, auth.token, SOLD_OUT_QUERY, { id: itemId });
    let retry = false;
    for (const rowId of soldOutRowIds(data)) {
      if (await endLinkedEbay(admin, store.user_id, rowId)) retry = true;
    }
    return retry;
  } catch (err) {
    if (settled(err)) return false;
    console.error('[shopify-public] sold out:', err instanceof Error ? err.message : err);
    return true;
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
    const { data: gone, error } = await admin
      .from('shopify_tokens')
      .delete()
      .eq('shop_domain', shopDomain)
      .select('shop_id');
    if (error) {
      console.error(`[shopify-public] topic=${topic} delete failed`);
      return text(500, 'Retry');
    }
    // The plan read again for the store just removed. Best effort, as the tokens are gone and a
    // retry would find nothing to remove: installing again reads the plan afresh.
    for (const { shop_id } of gone ?? []) {
      try {
        await syncAfterUninstall(admin, shop_id);
      } catch {
        console.warn(`[shopify-public] topic=${topic} plan sync failed`);
      }
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
  } else if (topic === 'inventory_levels/update') {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return text(400, 'Bad body');
    }
    // Shopify sends it again on anything but a 2xx, up to 8 times over 4 hours; a listing that
    // already ended is left alone, so a second run ends nothing twice.
    if (await inventoryUpdate(admin, shopDomain, payload)) return text(500, 'Retry');
  }

  // Shopify retries anything but a 2xx, so every verified topic answers ok.
  return text(200, 'ok');
}

// ── The plan sweep ─────────────────────────────────────────────────────────

/** POST /sync from the hourly dashboard Cron job: the live plans Shopify bills, read again. */
async function sync(req: Request): Promise<Response> {
  if (req.method !== 'POST') return text(405, 'Method not allowed');
  const secret = Deno.env.get('SHOPIFY_SYNC_SECRET') ?? '';
  const presented = req.headers.get('x-shopify-sync-secret') ?? '';
  if (!secret || !(await timingSafeEqual(presented, secret))) return text(401, 'Unauthorized');
  if (!billingConfigured()) return json(200, { read: 0, failed: 0, stopped: 'billing_not_configured' });
  try {
    const result = await syncDueStores(adminClient());
    console.log(
      `[shopify-public] sync read=${result.read} failed=${result.failed} stopped=${result.stopped ?? '-'}`,
    );
    return json(200, result);
  } catch (err) {
    console.error('[shopify-public] sync', err instanceof Error ? err.message : err);
    return json(500, { error: 'Sync failed' });
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/app')) return app(req);
  if (url.pathname.endsWith('/sync')) return sync(req);
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
