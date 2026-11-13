// Supabase Edge Function: shopify
// ------------------------------------------------------------------------
// The extension's only route to Shopify. Holds the app secret and each user's
// Admin API tokens (public.shopify_tokens, service role only) and calls the
// Admin GraphQL API on the user's behalf, returning plain JSON.
//
// Auth: the signed-in user's Supabase JWT in Authorization.
//
// Request body: { action, ...params }
//   authorizeUrl { query, state, extensionId } -> { url }
//                query: the App URL's params Shopify sent the popup on install
//                (shop, host, timestamp, hmac), checked here; url: Shopify's
//                consent page, redirecting to https://<extensionId>.chromiumapp.org/shopify
//   link    { query }   -> { shopId, shopName, shopDomain, currency }
//                query: that redirect's params (code, shop, state, timestamp,
//                hmac). The extension checks state; this checks the signature.
//   unlink  {}          -> { ok }
//   account {}          -> { shopName, shopDomain, currency }
//   setStatus { productId, status } -> { status, totalInventory, tracksInventory }
//                status ACTIVE, DRAFT or ARCHIVED: Post draft, Hide and Unhide. Made
//                ACTIVE on no sales channel, the product goes on the Online Store
//   deleteProduct { productId, variantId? } -> { ok, deleted: 'variant' | 'product' }
//                for good; with a variant, only it goes unless it is the product's
//                last. One already gone counts as deleted
//   product { productId, variantId? }
//                -> { listing, descriptionHtml, quantity, editable, variant, category, tags, options, fields }
//                one product for the editor, about one variant: the one named, else
//                the product's only one (none with several). listing as `listings`
//                gives it (up to 50 photos, its variantList that one variant; its
//                description is Shopify's one-line text, so the editor reads
//                descriptionHtml); quantity the variant's units when SaleLinx can set
//                them; editable { price, quantity, photos, variant, tracked }. category
//                (Shopify's own, as its path), tags and options (the variant's) are for
//                a crosslist out of the store; fields (ProductFields) the rest of the
//                product page for the editor
//   updateProduct { productId, variantId?, changes } -> as `product`, read after the save
//                changes: title, description (plain text), vendor, productType,
//                photos (addresses in order), categoryId, tags, collections (the
//                manual ones' ids, the whole set), channels (the sales channels' ids,
//                the whole set; needs write_publications), seoTitle, seoDescription
//                and handle are the product's; price, quantity, compareAtPrice, cost, taxable,
//                sku, barcode, tracked, continueSelling, physical, weight,
//                countryOfOrigin, hsCode and options the variant's. A change the
//                product doesn't allow is refused with 'not_editable'
//   uploadPhoto { dataUrl } -> { url }   a new photo, staged in Shopify for the save
//   createProduct { product } -> as `product`, read after the create
//                a crosslist into the store, held to the crosslist allowance.
//                product: title, description (plain text), vendor, productType,
//                categoryPath (the source's, to find Shopify's own category),
//                price, quantity, size (a Size option), tags, photos (fetched
//                by Shopify), status DRAFT or ACTIVE, fields (as updateProduct's,
//                less tags and options; a categoryId, or null, replaces the match;
//                channels, else the Online Store); stock at the primary location
//   categories { search } -> { categories: [{ id, name, fullName }] }
//                Shopify's standard categories matching the text, for the editor
//   matchCategory { productType, categoryPath, title } -> { category: { id, name } | null }
//                the category createProduct would find for a source, so the editor
//                can show it first
//   collections {} -> { collections: [{ id, title }] }
//                the store's manual collections, the ones a product can join
//   channels {} -> { channels: [{ id, name, onlineStore }] | null }
//                the store's sales channels; null until it grants write_publications
//                (a store linked before it was asked for approves it by opening the app)
//   takeOneOff { productId, variantId?, key } -> { result, listing, descriptionHtml, quantity, editable, variant }
//                a linked listing sold elsewhere: one off the variant's stock.
//                result 'counted', 'sold', 'archived', 'manual' or 'gone' (see takeOneOff)
//   listings { cursor? } -> { listings, cursor, hasMore }
//                up to 100 products a call, each with every variant (variantList),
//                in Shopify's order; pass the
//                returned cursor back for the next call. Status is Shopify's
//                own: the extension maps it onto My Listings' statuses.
//
// Errors: { error, code } with code 'not_linked' or 'reauth' when the user
// must connect Shopify again, 'busy' when Shopify throttles or a token refresh
// is already running, 'shop_unavailable' for a lapsed or locked store,
// 'upgrade_required' / 'limit_reached' for a crosslist past the plan,
// 'not_found' for a product gone from the store, 'not_editable' for an edit
// the product doesn't allow (see updateProduct),
// 'bad_signature' / 'expired' / 'bad_request' for a redirect that doesn't
// check out, 'shopify' for anything else Shopify refused.
//
// Secrets: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';
import { checkCrosslistAllowed } from '../_shared/crosslist-gate.ts';
import {
  PUBLISH_SCOPE,
  type SalesChannel,
  ShopifyError,
  adminGraphql,
  authorizeUrl,
  channelMoves,
  collectionMoves,
  granted,
  salesChannels,
  newProduct,
  newProductInput,
  pickTaxonomyCategory,
  taxonomySearchTerms,
  photoFiles,
  productDetail,
  productFieldsInput,
  oneOffPlan,
  productEdit,
  productGid,
  productSummary,
  refusal,
  samePhotos,
  shopIdFromGid,
  textToHtml,
  tokenRequest,
  variantFieldsInput,
  variantGid,
  variantSummary,
  verifiedShop,
} from '../_shared/shopify.ts';

const CORS_HEADERS = sharedCorsHeaders();

// A refresh normally takes well under a second; a claim older than this is
// from a call that died mid-refresh, and the next caller may take over.
const REFRESH_LOCK_MS = 30_000;

const SHOP_QUERY = '{ shop { id name myshopifyDomain currencyCode } }';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new ShopifyError(`${name} not configured`, 'not_configured', 500);
  return v;
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Tokens ─────────────────────────────────────────────────────────────────

function tokenColumns(t) {
  return {
    scope: t.scope,
    access_token: t.access_token,
    access_expires_at: inSeconds(t.expires_in ?? 3600),
    refresh_token: t.refresh_token,
    refresh_expires_at: inSeconds(t.refresh_token_expires_in ?? 90 * 86400),
    updated_at: new Date().toISOString(),
  };
}

async function refresh(
  admin,
  userId: string,
  shop: string,
  refreshToken: string,
  scope: string | null,
): Promise<Auth> {
  try {
    const fresh = await tokenRequest(shop, {
      client_id: env('SHOPIFY_CLIENT_ID'),
      client_secret: env('SHOPIFY_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const { error } = await admin
      .from('shopify_tokens')
      .update({
        ...tokenColumns({
          ...fresh,
          refresh_token: fresh.refresh_token ?? refreshToken,
        }),
        refreshing_until: null,
      })
      .eq('user_id', userId);
    // Shopify has already retired the old refresh token, so this link is lost.
    if (error) console.error(`[shopify] user=${userId} refreshed token not saved`);
    return { shop, token: fresh.access_token, scope: fresh.scope ?? scope };
  } catch (err) {
    await admin.from('shopify_tokens').update({ refreshing_until: null }).eq('user_id', userId);
    throw err;
  }
}

/** A store's access token and the scopes it granted (Shopify's comma list). */
interface Auth {
  shop: string;
  token: string;
  scope: string | null;
}

/**
 * A working access token, refreshed when it has under a minute left. Shopify
 * retires a refresh token the moment it issues the next one, so only the call
 * that claims refreshing_until refreshes; any other waits for its result.
 */
async function accessTokenFor(admin, userId: string): Promise<Auth> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row, error } = await admin
      .from('shopify_tokens')
      .select('shop_domain, access_token, access_expires_at, scope')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new ShopifyError('Token lookup failed', 'unavailable', 500);
    if (!row) throw new ShopifyError('Shopify is not connected', 'not_linked', 409);
    if (new Date(row.access_expires_at).getTime() - Date.now() > 60_000) {
      return { shop: row.shop_domain, token: row.access_token, scope: row.scope ?? null };
    }

    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from('shopify_tokens')
      .update({
        refreshing_until: new Date(Date.now() + REFRESH_LOCK_MS).toISOString(),
      })
      .eq('user_id', userId)
      .or(`refreshing_until.is.null,refreshing_until.lt."${now}"`)
      .select('refresh_token');
    if (claimErr) throw new ShopifyError('Token lookup failed', 'unavailable', 500);
    if (claimed?.length) {
      return refresh(admin, userId, row.shop_domain, claimed[0].refresh_token, row.scope ?? null);
    }
    await sleep(500);
  }
  throw new ShopifyError('Shopify is busy, try again', 'busy', 503);
}

// ── Linking ────────────────────────────────────────────────────────────────

// The legacy install flow rules out app-wide webhook subscriptions (Shopify
// refuses them on deploy), so each store is subscribed to app/uninstalled when
// it links. Shopify drops a store's subscriptions with the install, and a
// reconnect while still installed finds it taken, which is fine. Best effort:
// without it an uninstall goes unnoticed until the next call, which then gets
// 401 and answers reauth anyway.
const UNINSTALL_MUTATION = `mutation ($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
    webhookSubscription { id }
    userErrors { message }
  }
}`;

async function subscribeUninstall(shop: string, token: string, userId: string) {
  try {
    const { webhookSubscriptionCreate: res } = await adminGraphql(shop, token, UNINSTALL_MUTATION, {
      topic: 'APP_UNINSTALLED',
      sub: { uri: `${env('SUPABASE_URL')}/functions/v1/shopify-public` },
    });
    if (res?.userErrors?.some((e) => !/taken/i.test(String(e.message)))) {
      console.warn(`[shopify] user=${userId} uninstall webhook refused`);
    }
  } catch (err) {
    console.warn(
      `[shopify] user=${userId} uninstall webhook failed code=${err?.code ?? 'unknown'}`,
    );
  }
}

async function link(admin, userScoped, userId: string, query) {
  const shop = await verifiedShop(query, env('SHOPIFY_CLIENT_SECRET'));
  if (typeof query.code !== 'string' || !query.code) {
    throw new ShopifyError('Missing code', 'bad_request', 400);
  }
  const tokens = await tokenRequest(shop, {
    client_id: env('SHOPIFY_CLIENT_ID'),
    client_secret: env('SHOPIFY_CLIENT_SECRET'),
    code: query.code,
    expiring: '1',
  });
  if (!tokens.refresh_token) throw new ShopifyError('Shopify sent no refresh token', 'shopify');
  const { shop: me } = await adminGraphql(shop, tokens.access_token, SHOP_QUERY);
  const shopId = shopIdFromGid(me.id);

  // linked_accounts first, through the user's own client, so the one-store-per-
  // account index and the trial triggers decide before any token is kept.
  const { error: linkErr } = await userScoped.from('linked_accounts').upsert(
    {
      user_id: userId,
      platform: 'shopify',
      platform_user_id: shopId,
      platform_username: me.name ?? null,
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
    throw new ShopifyError(linkErr.message ?? 'Link failed', code, 409);
  }

  const { error: tokErr } = await admin.from('shopify_tokens').upsert(
    {
      user_id: userId,
      shop_id: shopId,
      shop_domain: me.myshopifyDomain ?? shop,
      ...tokenColumns(tokens),
      refreshing_until: null,
    },
    { onConflict: 'user_id' },
  );
  if (tokErr) {
    console.error(`[shopify] user=${userId} token store failed:`, tokErr.code ?? tokErr.message);
    throw new ShopifyError('Could not save the Shopify connection', 'unavailable', 500);
  }
  await subscribeUninstall(shop, tokens.access_token, userId);
  return {
    shopId,
    shopName: me.name ?? null,
    shopDomain: me.myshopifyDomain ?? shop,
    currency: me.currencyCode ?? null,
  };
}

// ── Listings ───────────────────────────────────────────────────────────────

// A variant as My Listings takes it (variantSummary): its price, stock, options
// and own photo.
const VARIANT_FIELDS = `legacyResourceId
        title
        price
        inventoryQuantity
        selectedOptions { name value }
        media(first: 1) { nodes { ... on MediaImage { image { url } } } }`;

// 25 products with 8 photos and their first variant each ask about 800 points
// of the store's bucket, under Shopify's 1,000-point cap on one query and inside
// a Standard store's bucket, which refills at 100 points a second.
const PRODUCTS_QUERY = `query ($cursor: String) {
  products(first: 25, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      legacyResourceId
      title
      description
      status
      onlineStoreUrl
      totalInventory
      tracksInventory
      vendor
      productType
      createdAt
      updatedAt
      priceRangeV2 { minVariantPrice { amount currencyCode } }
      variantsCount { count }
      media(first: 8) { nodes { ... on MediaImage { image { url } } } }
      variants(first: 1) {
        nodes {
          ${VARIANT_FIELDS}
          inventoryItem { tracked }
        }
      }
    }
  }
}`;

// The variants of a page's products that have several. 50 ask about 450 points.
const VARIANTS_QUERY = `query ($query: String!, $cursor: String) {
  productVariants(first: 50, after: $cursor, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes {
      position
      product { legacyResourceId }
      ${VARIANT_FIELDS}
      inventoryItem { tracked }
    }
  }
}`;

const PAGES_PER_CALL = 4;
// Keeps a call, waits included, well inside the extension's 30-second timeout.
const LISTINGS_BUDGET_MS = 15_000;

/**
 * Every variant of the given products (those with several), in each product's
 * own order, onto their variantList. False when the call's budget ran out first.
 */
async function fillVariants(rows, ask, room): Promise<boolean> {
  const byProduct = new Map(rows.map((r) => [r.productId, []]));
  const query = `product_ids:${[...byProduct.keys()].join(',')}`;
  let after = null;
  do {
    if (!(await room())) return false;
    const data = await ask(VARIANTS_QUERY, { query, cursor: after });
    const page = data?.productVariants;
    for (const v of page?.nodes ?? []) {
      const list = byProduct.get(String(v?.product?.legacyResourceId));
      const summary = variantSummary(v);
      if (list && summary) list.push({ position: Number(v.position) || 0, summary });
    }
    after = page?.pageInfo?.hasNextPage ? (page.pageInfo.endCursor ?? null) : null;
  } while (after);
  for (const r of rows) {
    const list = byProduct.get(r.productId) ?? [];
    if (list.length > 0) {
      r.variantList = list.sort((a, b) => a.position - b.position).map((x) => x.summary);
    }
  }
  return true;
}

/**
 * A run of product pages, each with every variant of its products. Between
 * queries it waits for the store's bucket to hold the next one's cost, so a big
 * store is read without being throttled. A throttle or failure after the first
 * page ends the run early with the cursor kept at the page it was on, and the
 * extension asks again from there; one on the first page is the call failing.
 */
async function listings(admin, userId: string, cursor: unknown) {
  if (cursor != null && typeof cursor !== 'string') {
    throw new ShopifyError('Bad cursor', 'bad_request', 400);
  }
  const auth = await accessTokenFor(admin, userId);
  const started = Date.now();
  const out = [];
  let after = (cursor as string | null) ?? null;
  let hasMore = true;
  let cost = null;
  const ask = (query: string, variables) =>
    adminGraphql(auth.shop, auth.token, query, variables, (c) => (cost = c));
  // Waits for the bucket to hold the next query, or answers false when that would pass the budget.
  const room = async () => {
    if (!cost || cost.available >= cost.requested) return true;
    const waitMs = ((cost.requested - cost.available) / cost.restoreRate) * 1000;
    if (Date.now() - started + waitMs > LISTINGS_BUDGET_MS) return false;
    await sleep(waitMs);
    return true;
  };
  for (let page = 0; page < PAGES_PER_CALL && hasMore; page++) {
    if (page > 0 && !(await room())) break;
    let products;
    let rows;
    try {
      products = (await ask(PRODUCTS_QUERY, { cursor: after }))?.products;
      rows = (products?.nodes ?? []).map((p) => productSummary(auth.shop, p));
      const several = rows.filter((r) => r.variants > 1);
      if (several.length > 0 && !(await fillVariants(several, ask, room))) {
        throw new ShopifyError('Shopify is busy, try again shortly', 'busy', 429);
      }
    } catch (err) {
      if (page === 0) throw err;
      break;
    }
    out.push(...rows);
    hasMore = products?.pageInfo?.hasNextPage === true;
    after = products?.pageInfo?.endCursor ?? null;
    if (!after) hasMore = false;
    if (Date.now() - started > LISTINGS_BUDGET_MS) break;
  }
  return { listings: out, cursor: hasMore ? after : null, hasMore };
}

// ── Product changes ────────────────────────────────────────────────────────

const STATUSES = new Set(['ACTIVE', 'DRAFT', 'ARCHIVED']);

const STATUS_MUTATION = `mutation ($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { status totalInventory tracksInventory }
    userErrors { field message }
  }
}`;

/** Sends back what the product reads as afterwards, as the extension's row maps it. */
async function setStatus(admin, userId: string, productId: unknown, status: unknown) {
  const id = productGid(productId);
  if (typeof status !== 'string' || !STATUSES.has(status)) {
    throw new ShopifyError('Bad status', 'bad_request', 400);
  }
  const auth = await accessTokenFor(admin, userId);
  const { productUpdate: res } = await adminGraphql(auth.shop, auth.token, STATUS_MUTATION, {
    product: { id, status },
  });
  const refused = refusal(res?.userErrors);
  if (refused) throw refused;
  // Posted (or unhidden) on no channel, it would be Active on no page of the store.
  if (status === 'ACTIVE') await onlineStoreIfNowhere(auth, id, null);
  const p = res?.product ?? {};
  return {
    status: String(p.status ?? status),
    totalInventory: typeof p.totalInventory === 'number' ? p.totalInventory : null,
    tracksInventory: p.tracksInventory === true,
  };
}

const DELETE_MUTATION = `mutation ($id: ID!) {
  productDelete(input: { id: $id }, synchronous: true) {
    deletedProductId
    userErrors { field message }
  }
}`;

const VARIANT_OWNER_QUERY = `query ($id: ID!, $variantId: ID!) {
  product(id: $id) { variantsCount { count } }
  productVariant(id: $variantId) { product { id } }
}`;

const VARIANT_DELETE_MUTATION = `mutation ($productId: ID!, $variantsIds: [ID!]!) {
  productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
    product { id }
    userErrors { field message }
  }
}`;

/**
 * For good: Shopify keeps no copy. A product takes its variants and unshared
 * media with it. With a variant named, only that variant goes, unless it is the
 * product's last, when the product goes too. `deleted` says which, so the
 * extension drops that one row or every row of the product. Deleted already, in
 * Shopify or by an earlier try, counts as done.
 */
async function deleteProduct(admin, userId: string, productId: unknown, variantId: unknown) {
  const id = productGid(productId);
  const vid = variantId == null ? null : variantGid(variantId);
  const auth = await accessTokenFor(admin, userId);
  if (vid) {
    const owner = await adminGraphql(auth.shop, auth.token, VARIANT_OWNER_QUERY, {
      id,
      variantId: vid,
    });
    if (!owner?.product) return { ok: true, deleted: 'product' };
    if (owner.productVariant?.product?.id !== id) return { ok: true, deleted: 'variant' };
    if (Number(owner.product.variantsCount?.count) > 1) {
      const { productVariantsBulkDelete: res } = await adminGraphql(
        auth.shop,
        auth.token,
        VARIANT_DELETE_MUTATION,
        { productId: id, variantsIds: [vid] },
      );
      const refused = refusal(res?.userErrors);
      if (refused && refused.code !== 'not_found') throw refused;
      return { ok: true, deleted: 'variant' };
    }
  }
  const { productDelete: res } = await adminGraphql(auth.shop, auth.token, DELETE_MUTATION, { id });
  const refused = refusal(res?.userErrors);
  if (refused && refused.code !== 'not_found') throw refused;
  return { ok: true, deleted: 'product' };
}

// ── Editing a product ──────────────────────────────────────────────────────

// A variant with its stock levels, for the editor, a take-off and a crosslist,
// and the rest of its page for the editor (productFields).
const DETAIL_VARIANT_FIELDS = `id
      ${VARIANT_FIELDS}
      compareAtPrice
      taxable
      inventoryPolicy
      barcodes(first: 1) { nodes { value } }
      inventoryItem {
        id
        tracked
        trackedEditable { locked }
        sku
        unitCost { amount }
        requiresShipping
        measurement { weight { value unit } }
        countryCodeOfOrigin
        harmonizedSystemCode
        inventoryLevels(first: 2) {
          nodes { location { id } quantities(names: ["available"]) { quantity } }
        }
      }`;

// About 160 points: one variant with its stock levels, up to 50 photos and 25
// collections.
const PRODUCT_FIELDS = `legacyResourceId
    title
    description
    descriptionHtml
    status
    onlineStoreUrl
    totalInventory
    tracksInventory
    vendor
    productType
    category { id fullName }
    tags
    handle
    seo { title description }
    collections(first: 25) { nodes { id title ruleSet { appliedDisjunctively } } }
    createdAt
    updatedAt
    priceRangeV2 { minVariantPrice { amount currencyCode } }
    variantsCount { count }
    mediaCount { count }
    media(first: 50) { nodes { id ... on MediaImage { image { url } } } }`;

const PRODUCT_QUERY = `query ($id: ID!) {
  product(id: $id) {
    ${PRODUCT_FIELDS}
    variants(first: 1) { nodes { ${DETAIL_VARIANT_FIELDS} } }
  }
}`;

const VARIANT_QUERY = `query ($id: ID!, $variantId: ID!) {
  product(id: $id) { ${PRODUCT_FIELDS} }
  productVariant(id: $variantId) {
    product { id }
    ${DETAIL_VARIANT_FIELDS}
  }
}`;

// The sales channels the product is on, published or scheduled. Only asked with PUBLISH_SCOPE
// granted: without it the field is refused and the whole read with it.
const CHANNEL_FIELDS = `resourcePublicationsV2(first: 50, catalogType: APP, onlyPublished: false) {
      nodes { publication { id } }
    }`;

const PRODUCT_QUERY_CHANNELS = `query ($id: ID!) {
  product(id: $id) {
    ${PRODUCT_FIELDS}
    ${CHANNEL_FIELDS}
    variants(first: 1) { nodes { ${DETAIL_VARIANT_FIELDS} } }
  }
}`;

const VARIANT_QUERY_CHANNELS = `query ($id: ID!, $variantId: ID!) {
  product(id: $id) {
    ${PRODUCT_FIELDS}
    ${CHANNEL_FIELDS}
  }
  productVariant(id: $variantId) {
    product { id }
    ${DETAIL_VARIANT_FIELDS}
  }
}`;

/** The product, about the variant named (a GID), else its only one. */
async function readProduct(auth: Auth, id: string, variantId: string | null = null) {
  const channels = granted(auth.scope, PUBLISH_SCOPE);
  const data = await adminGraphql(
    auth.shop,
    auth.token,
    variantId
      ? channels
        ? VARIANT_QUERY_CHANNELS
        : VARIANT_QUERY
      : channels
        ? PRODUCT_QUERY_CHANNELS
        : PRODUCT_QUERY,
    variantId ? { id, variantId } : { id },
  );
  if (!data?.product) {
    throw new ShopifyError('This product is no longer in your Shopify store', 'not_found', 404);
  }
  if (!variantId) return productDetail(auth.shop, data.product);
  if (data.productVariant?.product?.id !== id) {
    throw new ShopifyError('This variant is no longer in your Shopify store', 'not_found', 404);
  }
  return productDetail(auth.shop, data.product, data.productVariant);
}

const optionalVariant = (variantId: unknown): string | null =>
  variantId == null ? null : variantGid(variantId);

// category, tags and options are for a crosslist out of the store; fields for
// the editor.
const forEditor = (d) => ({
  listing: d.listing,
  descriptionHtml: d.descriptionHtml,
  quantity: d.quantity,
  editable: d.editable,
  variant: d.variant,
  category: d.category,
  tags: d.tags,
  options: d.options,
  fields: d.fields,
});

async function product(admin, userId: string, productId: unknown, variantId: unknown) {
  const id = productGid(productId);
  const vid = optionalVariant(variantId);
  return forEditor(await readProduct(await accessTokenFor(admin, userId), id, vid));
}

const UPDATE_MUTATION = `mutation ($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id }
    userErrors { field message }
  }
}`;

const PRICE_MUTATION = `mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    product { id }
    userErrors { field message }
  }
}`;

const PUBLISH_MUTATION = `mutation ($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
  }
}`;

const UNPUBLISH_MUTATION = `mutation ($id: ID!, $input: [PublicationInput!]!) {
  publishableUnpublish(id: $id, input: $input) {
    userErrors { field message }
  }
}`;

// About 10 points: the store's sales channels, each named by its app.
const CHANNELS_QUERY = `{
  publications(first: 50, catalogType: APP) {
    nodes { id catalog { ... on AppCatalog { apps(first: 1) { nodes { handle title } } } } }
  }
}`;

/** The store's sales channels, or null when it hasn't granted PUBLISH_SCOPE. */
async function salesChannelsOf(auth: Auth): Promise<SalesChannel[] | null> {
  if (!granted(auth.scope, PUBLISH_SCOPE)) return null;
  const data = await adminGraphql(auth.shop, auth.token, CHANNELS_QUERY);
  return salesChannels(data?.publications?.nodes ?? []);
}

const PRODUCT_CHANNELS_QUERY = `query ($id: ID!) {
  product(id: $id) { ${CHANNEL_FIELDS} }
}`;

/** Puts product `id` on these channels and takes it off those. */
async function moveChannels(auth: Auth, id: string, publish: string[], unpublish: string[]) {
  const input = (ids: string[]) => ids.map((publicationId) => ({ publicationId }));
  if (publish.length) {
    await mutate(auth, PUBLISH_MUTATION, { id, input: input(publish) }, 'publishablePublish');
  }
  if (unpublish.length) {
    await mutate(auth, UNPUBLISH_MUTATION, { id, input: input(unpublish) }, 'publishableUnpublish');
  }
}

/**
 * A product SaleLinx makes or posts goes on the Online Store, as one made in Shopify's admin
 * does: the API puts it on no channel, so it was Active but on no page of the store. Only a
 * product on no channel at all: one the seller put on some has their choice kept. Never fails
 * what it follows (the product is made or posted either way), and does nothing until the store
 * has granted PUBLISH_SCOPE.
 */
async function onlineStoreIfNowhere(auth: Auth, id: string, current: string[] | null) {
  try {
    if (current?.length) return;
    const channels = await salesChannelsOf(auth);
    const store = channels?.find((c) => c.onlineStore);
    if (!store) return;
    let on = current;
    if (on === null) {
      const data = await adminGraphql(auth.shop, auth.token, PRODUCT_CHANNELS_QUERY, { id });
      on = (data?.product?.resourcePublicationsV2?.nodes ?? []).map((n) => n?.publication?.id);
    }
    if (on?.length) return;
    await moveChannels(auth, id, [store.id], []);
  } catch (err) {
    console.warn('[shopify] online store publish failed:', err instanceof Error ? err.message : err);
  }
}

// changeFromQuantity makes it a compare-and-set: a sale between the read and
// this write makes Shopify refuse rather than the edit wiping the sale out.
const STOCK_MUTATION = `mutation ($input: InventorySetQuantitiesInput!, $key: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $key) {
    inventoryAdjustmentGroup { id }
    userErrors { field message }
  }
}`;

// productSet replaces a list it's given, so `files` is the product's whole
// photo set, and nothing else is sent with it.
const PHOTOS_MUTATION = `mutation ($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
  productSet(identifier: $identifier, input: $input, synchronous: true) {
    product { id }
    userErrors { field message }
  }
}`;

async function mutate(auth, query: string, variables, key: string) {
  const data = await adminGraphql(auth.shop, auth.token, query, variables);
  const refused = refusal(data?.[key]?.userErrors);
  if (refused) throw refused;
}

/**
 * The editor's save. Checks what the product allows first (a variant for a
 * price or any variant field, its stock tracked at one location for a quantity,
 * photos the editor saw in full), then sends each kind of change as its own
 * call: the product's fields (productUpdate, which joins and leaves collections
 * too), the variant's (productVariantsBulkUpdate, with its inventory item), the
 * stock and the photos. The product's fields change for every variant, the
 * variant's only for it. Answers with the product as it reads afterwards, for the
 * extension's row.
 */
async function updateProduct(
  admin,
  userId: string,
  productId: unknown,
  variantId: unknown,
  rawChanges: unknown,
) {
  const id = productGid(productId);
  const vid = optionalVariant(variantId);
  const changes = productEdit(rawChanges);
  const auth = await accessTokenFor(admin, userId);
  const before = await readProduct(auth, id, vid);
  const refuse = (message: string) => new ShopifyError(message, 'not_editable', 422);
  if (changes.price !== undefined && !before.editable.price) {
    throw refuse('This product has variants: set their prices in Shopify');
  }
  if (changes.quantity !== undefined && !before.editable.quantity) {
    throw refuse('SaleLinx can only set the stock of a variant tracked at one location');
  }
  if (changes.photos !== undefined && !before.editable.photos) {
    throw refuse("This product has media SaleLinx can't show: change its photos in Shopify");
  }
  const variantFields = variantFieldsInput(changes);
  if (Object.keys(variantFields).length > 0 && !before.editable.variant) {
    throw refuse('This product has variants: edit each one from its own row');
  }
  if (
    changes.tracked !== undefined &&
    changes.tracked !== before.fields.tracked &&
    !before.editable.tracked
  ) {
    throw refuse("Shopify doesn't let this variant's stock tracking change");
  }
  if (changes.channels !== undefined && before.fields.channels === null) {
    throw refuse(
      "Your store hasn't let SaleLinx set sales channels yet: open SaleLinx from your Shopify admin",
    );
  }

  const fields: Record<string, unknown> = productFieldsInput(changes, before.fields);
  if (changes.title !== undefined) fields.title = changes.title.trim();
  if (changes.description !== undefined) fields.descriptionHtml = textToHtml(changes.description);
  if (changes.vendor !== undefined) fields.vendor = changes.vendor.trim();
  if (changes.productType !== undefined) fields.productType = changes.productType.trim();
  // The old address keeps working: Shopify forwards it to the new one.
  if (fields.handle !== undefined) {
    if (fields.handle === before.fields.handle) delete fields.handle;
    else fields.redirectNewHandle = true;
  }
  if (changes.collections !== undefined) {
    const { join, leave } = collectionMoves(changes.collections, before.fields.collections);
    if (join.length) fields.collectionsToJoin = join;
    if (leave.length) fields.collectionsToLeave = leave;
  }
  if (Object.keys(fields).length > 0) {
    await mutate(auth, UPDATE_MUTATION, { product: { id, ...fields } }, 'productUpdate');
  }
  if (changes.price !== undefined) variantFields.price = changes.price.toFixed(2);
  if (Object.keys(variantFields).length > 0) {
    await mutate(
      auth,
      PRICE_MUTATION,
      { productId: id, variants: [{ id: before.variantId, ...variantFields }] },
      'productVariantsBulkUpdate',
    );
  }
  if (
    changes.quantity !== undefined &&
    before.stock &&
    changes.quantity !== before.stock.quantity
  ) {
    const { inventoryItemId, locationId, quantity } = before.stock;
    await mutate(
      auth,
      STOCK_MUTATION,
      {
        input: {
          name: 'available',
          reason: 'correction',
          quantities: [
            {
              inventoryItemId,
              locationId,
              quantity: changes.quantity,
              changeFromQuantity: quantity,
            },
          ],
        },
        key: crypto.randomUUID(),
      },
      'inventorySetQuantities',
    );
  }
  if (changes.photos !== undefined && !samePhotos(changes.photos, before.media)) {
    await mutate(
      auth,
      PHOTOS_MUTATION,
      {
        identifier: { id },
        input: { files: photoFiles(changes.photos, before.media) },
      },
      'productSet',
    );
  }
  if (changes.channels !== undefined && before.fields.channels) {
    const { publish, unpublish } = channelMoves(changes.channels, before.fields.channels);
    await moveChannels(auth, id, publish, unpublish);
  }
  return forEditor(await readProduct(auth, id, vid));
}

/**
 * A linked listing sold elsewhere: one off this variant's stock (oneOffPlan).
 * `key` names the sale, so a retry of the same one can't take a second unit
 * off. Answers with what happened and the product as it reads afterwards:
 * 'counted' (some left, still for sale), 'sold' (none left), 'archived'
 * (the only variant, untracked stock), 'manual' (no variant named on a product
 * with several, several locations, or one of several untracked variants: left
 * alone) or 'gone' (not for sale anyway).
 */
async function takeOneOff(
  admin,
  userId: string,
  productId: unknown,
  variantId: unknown,
  key: unknown,
) {
  const id = productGid(productId);
  const vid = optionalVariant(variantId);
  if (typeof key !== 'string' || !/^[\w:.-]{1,200}$/.test(key)) {
    throw new ShopifyError('Bad key', 'bad_request', 400);
  }
  const auth = await accessTokenFor(admin, userId);
  const before = await readProduct(auth, id, vid);
  const plan = oneOffPlan(before);
  if (plan.kind === 'gone' || plan.kind === 'manual') {
    return { result: plan.kind, ...forEditor(before) };
  }
  if (plan.kind === 'archive') {
    await mutate(auth, STATUS_MUTATION, { product: { id, status: 'ARCHIVED' } }, 'productUpdate');
  } else {
    await mutate(
      auth,
      STOCK_MUTATION,
      {
        input: {
          name: 'available',
          reason: 'correction',
          quantities: [
            {
              inventoryItemId: plan.inventoryItemId,
              locationId: plan.locationId,
              quantity: plan.from - 1,
              changeFromQuantity: plan.from,
            },
          ],
        },
        key,
      },
      'inventorySetQuantities',
    );
  }
  const after = await readProduct(auth, id, vid);
  const result =
    plan.kind === 'archive' ? 'archived' : (after.quantity ?? 0) > 0 ? 'counted' : 'sold';
  return { result, ...forEditor(after) };
}

// No id: the store's primary location, where a crosslisted product's stock goes.
const LOCATION_QUERY = '{ location { id } }';

const TAXONOMY_QUERY = `query ($search: String!) {
  taxonomy {
    categories(search: $search, first: 25) { nodes { id name fullName isArchived } }
  }
}`;

/** Shopify's own category closest to the source (pickTaxonomyCategory), or null. Never fails the
 *  create: without one the product has its type and no category, as a hand-made one starts. */
async function findCategory(
  auth,
  product: { productType: string; categoryPath: string; title: string },
): Promise<{ id: string; name: string } | null> {
  const source = `${product.categoryPath} ${product.productType} ${product.title}`;
  try {
    for (const term of taxonomySearchTerms(product.productType, product.categoryPath)) {
      const data = await adminGraphql(auth.shop, auth.token, TAXONOMY_QUERY, { search: term });
      const nodes = data?.taxonomy?.categories?.nodes ?? [];
      const id = pickTaxonomyCategory(nodes, term, source);
      if (id) return { id, name: String(nodes.find((n) => n.id === id)?.fullName ?? '') };
    }
  } catch (err) {
    console.warn('[shopify] category search failed:', err instanceof Error ? err.message : err);
  }
  return null;
}

const text = (v: unknown, max: number): string => {
  if (v == null) return '';
  if (typeof v !== 'string' || v.length > max) {
    throw new ShopifyError('Bad request', 'bad_request', 400);
  }
  return v.trim();
};

/** Shopify's categories whose path holds `search`, for the editor's category box. */
async function searchCategories(admin, userId: string, search: unknown) {
  const q = text(search, 100);
  if (q.length < 2) return { categories: [] };
  const auth = await accessTokenFor(admin, userId);
  const data = await adminGraphql(auth.shop, auth.token, TAXONOMY_QUERY, { search: q });
  return {
    categories: (data?.taxonomy?.categories?.nodes ?? [])
      .filter((n) => n?.id && !n.isArchived)
      .map((n) => ({ id: n.id, name: String(n.name ?? ''), fullName: String(n.fullName ?? '') })),
  };
}

/** The category a crosslist would get (findCategory), so the editor can show it before the
 *  create. */
async function matchCategory(admin, userId: string, body) {
  const auth = await accessTokenFor(admin, userId);
  const category = await findCategory(auth, {
    productType: text(body?.productType, 255),
    categoryPath: text(body?.categoryPath, 500),
    title: text(body?.title, 255),
  });
  return { category };
}

// About 250 points: the store's manual collections, which a product can join.
// Smart ones choose their products by their own rules.
const COLLECTIONS_QUERY = `{
  collections(first: 250, sortKey: TITLE, query: "collection_type:custom") {
    nodes { id title }
  }
}`;

async function manualCollections(admin, userId: string) {
  const auth = await accessTokenFor(admin, userId);
  const data = await adminGraphql(auth.shop, auth.token, COLLECTIONS_QUERY);
  return {
    collections: (data?.collections?.nodes ?? [])
      .filter((c) => typeof c?.id === 'string')
      .map((c) => ({ id: c.id, title: String(c.title ?? '') })),
  };
}

const CREATE_MUTATION = `mutation ($input: ProductSetInput!) {
  productSet(input: $input, synchronous: true) {
    product { id }
    userErrors { field message }
  }
}`;

/**
 * A crosslist into the store (newProduct): one product, its stock at the
 * store's primary location, its photos fetched by Shopify from where the
 * source keeps them. The caller has checked the crosslist allowance. Answers
 * with the product as it reads afterwards, for the extension's row.
 */
async function createProduct(admin, userId: string, raw: unknown) {
  const product = newProduct(raw);
  const auth = await accessTokenFor(admin, userId);
  const { location } = await adminGraphql(auth.shop, auth.token, LOCATION_QUERY);
  if (!location?.id) {
    throw new ShopifyError('Your Shopify store has no location to hold stock', 'shopify', 422);
  }
  // The seller's pick (null: none), else the closest to the source.
  const category =
    product.fields.categoryId !== undefined
      ? product.fields.categoryId
      : ((await findCategory(auth, product))?.id ?? null);
  const data = await adminGraphql(auth.shop, auth.token, CREATE_MUTATION, {
    input: newProductInput(product, location.id, category),
  });
  const refused = refusal(data?.productSet?.userErrors);
  if (refused) throw refused;
  const id = data?.productSet?.product?.id;
  if (!id) throw new ShopifyError('Shopify did not create the product', 'shopify', 502);
  // The channels the seller picked, else the Online Store. A draft goes on them too, as in
  // Shopify's admin: it shows there once it is Active, posted here or in Shopify.
  if (product.fields.channels === undefined) await onlineStoreIfNowhere(auth, id, []);
  else if (granted(auth.scope, PUBLISH_SCOPE)) {
    try {
      await moveChannels(auth, id, product.fields.channels, []);
    } catch (err) {
      // The product is made: a channel it missed is set in the editor or in Shopify.
      console.warn('[shopify] channel publish failed:', err instanceof Error ? err.message : err);
    }
  }
  return forEditor(await readProduct(auth, id));
}

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

const STAGED_MUTATION = `mutation ($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { field message }
  }
}`;

/** A photo the editor added, put where Shopify can take it from: the answer's
 *  url goes in the photo list the save sends. */
async function uploadPhoto(admin, userId: string, dataUrl: unknown) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(
    typeof dataUrl === 'string' ? dataUrl : '',
  );
  if (!m) throw new ShopifyError('Expected an image data URL', 'bad_request', 400);
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new ShopifyError('Photo is too large', 'bad_request', 400);
  }
  const filename = `photo.${m[1].split('/')[1].replace('jpeg', 'jpg')}`;
  const auth = await accessTokenFor(admin, userId);
  const { stagedUploadsCreate: res } = await adminGraphql(auth.shop, auth.token, STAGED_MUTATION, {
    input: [
      {
        resource: 'IMAGE',
        filename,
        mimeType: m[1],
        httpMethod: 'POST',
        fileSize: String(bytes.length),
      },
    ],
  });
  const refused = refusal(res?.userErrors);
  if (refused) throw refused;
  const target = res?.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl) {
    throw new ShopifyError('Shopify gave no upload address', 'shopify', 502);
  }
  const form = new FormData();
  for (const p of target.parameters ?? []) form.append(p.name, p.value);
  form.append('file', new Blob([bytes], { type: m[1] }), filename);
  const up = await fetch(target.url, { method: 'POST', body: form });
  if (!up.ok) throw new ShopifyError(`Photo upload failed (${up.status})`, 'shopify', 502);
  return { url: target.resourceUrl };
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
      case 'authorizeUrl': {
        if (typeof body.state !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.state)) {
          return json(400, { error: 'Missing state', code: 'bad_request' });
        }
        if (typeof body.extensionId !== 'string' || !/^[a-p]{32}$/.test(body.extensionId)) {
          return json(400, {
            error: 'Missing extensionId',
            code: 'bad_request',
          });
        }
        const shop = await verifiedShop(body.query, env('SHOPIFY_CLIENT_SECRET'));
        const redirectUri = `https://${body.extensionId}.chromiumapp.org/shopify`;
        return json(200, {
          url: authorizeUrl(shop, env('SHOPIFY_CLIENT_ID'), redirectUri, body.state),
        });
      }

      case 'link': {
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        return json(200, await link(admin, userScoped, user.id, body.query ?? {}));
      }

      // The app stays installed in the store until the seller removes it there;
      // without the tokens SaleLinx can no longer reach it.
      case 'unlink': {
        await admin.from('shopify_tokens').delete().eq('user_id', user.id);
        return json(200, { ok: true });
      }

      case 'account': {
        const auth = await accessTokenFor(admin, user.id);
        const { shop: me } = await adminGraphql(auth.shop, auth.token, SHOP_QUERY);
        return json(200, {
          shopName: me.name ?? null,
          shopDomain: me.myshopifyDomain ?? auth.shop,
          currency: me.currencyCode ?? null,
        });
      }

      case 'listings':
        return json(200, await listings(admin, user.id, body.cursor));

      case 'setStatus':
        return json(200, await setStatus(admin, user.id, body.productId, body.status));

      case 'deleteProduct':
        return json(200, await deleteProduct(admin, user.id, body.productId, body.variantId));

      case 'product':
        return json(200, await product(admin, user.id, body.productId, body.variantId));

      case 'updateProduct':
        return json(
          200,
          await updateProduct(admin, user.id, body.productId, body.variantId, body.changes),
        );

      case 'uploadPhoto':
        return json(200, await uploadPhoto(admin, user.id, body.dataUrl));

      case 'takeOneOff':
        return json(
          200,
          await takeOneOff(admin, user.id, body.productId, body.variantId, body.key),
        );

      case 'categories':
        return json(200, await searchCategories(admin, user.id, body.search));

      case 'matchCategory':
        return json(200, await matchCategory(admin, user.id, body));

      case 'collections':
        return json(200, await manualCollections(admin, user.id));

      // null: the store hasn't granted PUBLISH_SCOPE yet.
      case 'channels':
        return json(200, { channels: await salesChannelsOf(await accessTokenFor(admin, user.id)) });

      // Posts a crosslist itself, so it is held to the same paywall as
      // resolve-category and the ebay function's add: nothing else on the
      // server gates a Shopify crosslist. Checked before any Shopify call.
      case 'createProduct': {
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const gate = await checkCrosslistAllowed(userScoped, user.id, 'shopify');
        if (!gate.ok) return json(gate.status, gate.body);
        return json(200, await createProduct(admin, user.id, body.product));
      }

      default:
        return json(400, { error: `Unknown action: ${String(body?.action)}` });
    }
  } catch (err) {
    if (err instanceof ShopifyError) {
      console.warn(`[shopify] user=${user.id} action=${body?.action} code=${err.code}`);
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error(
      `[shopify] user=${user.id} action=${body?.action}`,
      err instanceof Error ? err.message : err,
    );
    return json(502, { error: 'Shopify request failed', code: 'unavailable' });
  }
});
