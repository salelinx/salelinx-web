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
//                status ACTIVE, DRAFT or ARCHIVED: Post draft, Hide and Unhide
//   deleteProduct { productId } -> { ok }   for good; one already gone counts as deleted
//   product { productId } -> { listing, descriptionHtml, quantity, editable, category, tags, options }
//                (category: Shopify's own, as its path; options: the one variant's,
//                none with several; the three are for a crosslist out of the store)
//                one product for the editor: listing as `listings` gives it (up
//                to 50 photos; its description is Shopify's one-line text, so the
//                editor reads descriptionHtml), quantity the units available when
//                SaleLinx can set them, editable { price, quantity, photos }
//   updateProduct { productId, changes } -> as `product`, read after the save
//                changes: title, description (plain text), vendor, productType,
//                price, quantity, photos (addresses in order); a change the
//                product doesn't allow is refused with 'not_editable'
//   uploadPhoto { dataUrl } -> { url }   a new photo, staged in Shopify for the save
//   createProduct { product } -> as `product`, read after the create
//                a crosslist into the store, held to the crosslist allowance.
//                product: title, description (plain text), vendor, productType,
//                categoryPath (the source's, to find Shopify's own category),
//                price, quantity, size (a Size option), tags, photos (fetched
//                by Shopify), status DRAFT or ACTIVE; stock at the primary location
//   takeOneOff { productId, key } -> { result, listing, descriptionHtml, quantity, editable }
//                a linked listing sold elsewhere: one off the product's stock.
//                result 'counted', 'sold', 'archived', 'manual' or 'gone' (see takeOneOff)
//   listings { cursor? } -> { listings, cursor, hasMore }
//                up to 100 products a call, in Shopify's order; pass the
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
  ShopifyError,
  adminGraphql,
  authorizeUrl,
  newProduct,
  newProductInput,
  pickTaxonomyCategory,
  taxonomySearchTerms,
  photoFiles,
  productDetail,
  oneOffPlan,
  productEdit,
  productGid,
  productSummary,
  refusal,
  samePhotos,
  shopIdFromGid,
  textToHtml,
  tokenRequest,
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

async function refresh(admin, userId: string, shop: string, refreshToken: string) {
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
    return { shop, token: fresh.access_token };
  } catch (err) {
    await admin.from('shopify_tokens').update({ refreshing_until: null }).eq('user_id', userId);
    throw err;
  }
}

/**
 * A working access token, refreshed when it has under a minute left. Shopify
 * retires a refresh token the moment it issues the next one, so only the call
 * that claims refreshing_until refreshes; any other waits for its result.
 */
async function accessTokenFor(admin, userId: string): Promise<{ shop: string; token: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row, error } = await admin
      .from('shopify_tokens')
      .select('shop_domain, access_token, access_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new ShopifyError('Token lookup failed', 'unavailable', 500);
    if (!row) throw new ShopifyError('Shopify is not connected', 'not_linked', 409);
    if (new Date(row.access_expires_at).getTime() - Date.now() > 60_000) {
      return { shop: row.shop_domain, token: row.access_token };
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
    if (claimed?.length) return refresh(admin, userId, row.shop_domain, claimed[0].refresh_token);
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

// 25 products with 8 photos each asks about 550 points of the store's bucket,
// under Shopify's 1,000-point cap on one query and inside a Standard store's
// bucket, which refills at 100 points a second.
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
    }
  }
}`;

const PAGES_PER_CALL = 4;
// Keeps a call, waits included, well inside the extension's 30-second timeout.
const LISTINGS_BUDGET_MS = 15_000;

/**
 * A run of product pages. Between pages it waits for the store's bucket to
 * hold the next page's cost, so a big store is read without being throttled.
 * A throttle or failure after the first page ends the run early with the
 * cursor kept, and the extension asks again from there; one on the first page
 * is the call failing.
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
  for (let page = 0; page < PAGES_PER_CALL && hasMore; page++) {
    if (cost && cost.available < cost.requested) {
      const waitMs = ((cost.requested - cost.available) / cost.restoreRate) * 1000;
      if (Date.now() - started + waitMs > LISTINGS_BUDGET_MS) break;
      await sleep(waitMs);
    }
    let data;
    try {
      data = await adminGraphql(
        auth.shop,
        auth.token,
        PRODUCTS_QUERY,
        { cursor: after },
        (c) => (cost = c),
      );
    } catch (err) {
      if (page === 0) throw err;
      break;
    }
    const products = data?.products;
    for (const p of products?.nodes ?? []) out.push(productSummary(auth.shop, p));
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

/** For good: Shopify keeps no copy, and takes the variants and unshared media with it. */
async function deleteProduct(admin, userId: string, productId: unknown) {
  const id = productGid(productId);
  const auth = await accessTokenFor(admin, userId);
  const { productDelete: res } = await adminGraphql(auth.shop, auth.token, DELETE_MUTATION, { id });
  const refused = refusal(res?.userErrors);
  // Deleted already, in Shopify or by an earlier try: what was asked for is done.
  if (refused && refused.code !== 'not_found') throw refused;
  return { ok: true };
}

// ── Editing a product ──────────────────────────────────────────────────────

// About 120 points: one variant with its stock levels, and up to 50 photos.
const PRODUCT_QUERY = `query ($id: ID!) {
  product(id: $id) {
    legacyResourceId
    title
    description
    descriptionHtml
    status
    onlineStoreUrl
    totalInventory
    tracksInventory
    vendor
    productType
    category { fullName }
    tags
    createdAt
    updatedAt
    priceRangeV2 { minVariantPrice { amount currencyCode } }
    variantsCount { count }
    variants(first: 1) {
      nodes {
        id
        selectedOptions { name value }
        inventoryItem {
          id
          tracked
          inventoryLevels(first: 2) {
            nodes { location { id } quantities(names: ["available"]) { quantity } }
          }
        }
      }
    }
    mediaCount { count }
    media(first: 50) { nodes { id ... on MediaImage { image { url } } } }
  }
}`;

async function readProduct(auth, id: string) {
  const { product } = await adminGraphql(auth.shop, auth.token, PRODUCT_QUERY, {
    id,
  });
  if (!product) {
    throw new ShopifyError('This product is no longer in your Shopify store', 'not_found', 404);
  }
  return productDetail(auth.shop, product);
}

// category, tags and options are for a crosslist out of the store.
const forEditor = (d) => ({
  listing: d.listing,
  descriptionHtml: d.descriptionHtml,
  quantity: d.quantity,
  editable: d.editable,
  category: d.category,
  tags: d.tags,
  options: d.options,
});

async function product(admin, userId: string, productId: unknown) {
  const id = productGid(productId);
  return forEditor(await readProduct(await accessTokenFor(admin, userId), id));
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
 * The editor's save. Checks what the product allows first (one variant for a
 * price, tracked stock at one location for a quantity, photos the editor saw
 * in full), then sends each kind of change as its own call. Answers with the
 * product as it reads afterwards, for the extension's row.
 */
async function updateProduct(admin, userId: string, productId: unknown, rawChanges: unknown) {
  const id = productGid(productId);
  const changes = productEdit(rawChanges);
  const auth = await accessTokenFor(admin, userId);
  const before = await readProduct(auth, id);
  const refuse = (message: string) => new ShopifyError(message, 'not_editable', 422);
  if (changes.price !== undefined && !before.editable.price) {
    throw refuse('This product has variants: set their prices in Shopify');
  }
  if (changes.quantity !== undefined && !before.editable.quantity) {
    throw refuse(
      'SaleLinx can only set the stock of a product with one variant, tracked at one location',
    );
  }
  if (changes.photos !== undefined && !before.editable.photos) {
    throw refuse("This product has media SaleLinx can't show: change its photos in Shopify");
  }

  const fields: Record<string, string> = {};
  if (changes.title !== undefined) fields.title = changes.title.trim();
  if (changes.description !== undefined) fields.descriptionHtml = textToHtml(changes.description);
  if (changes.vendor !== undefined) fields.vendor = changes.vendor.trim();
  if (changes.productType !== undefined) fields.productType = changes.productType.trim();
  if (Object.keys(fields).length > 0) {
    await mutate(auth, UPDATE_MUTATION, { product: { id, ...fields } }, 'productUpdate');
  }
  if (changes.price !== undefined) {
    await mutate(
      auth,
      PRICE_MUTATION,
      {
        productId: id,
        variants: [{ id: before.variantId, price: changes.price.toFixed(2) }],
      },
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
  return forEditor(await readProduct(auth, id));
}

/**
 * A linked listing sold elsewhere: one off this product's stock (oneOffPlan).
 * `key` names the sale, so a retry of the same one can't take a second unit
 * off. Answers with what happened and the product as it reads afterwards:
 * 'counted' (some left, still for sale), 'sold' (none left), 'archived'
 * (untracked stock), 'manual' (several variants or locations, left alone) or
 * 'gone' (not for sale anyway).
 */
async function takeOneOff(admin, userId: string, productId: unknown, key: unknown) {
  const id = productGid(productId);
  if (typeof key !== 'string' || !/^[\w:.-]{1,200}$/.test(key)) {
    throw new ShopifyError('Bad key', 'bad_request', 400);
  }
  const auth = await accessTokenFor(admin, userId);
  const before = await readProduct(auth, id);
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
  const after = await readProduct(auth, id);
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
async function findCategory(auth, product): Promise<string | null> {
  const source = `${product.categoryPath} ${product.productType} ${product.title}`;
  try {
    for (const term of taxonomySearchTerms(product.productType, product.categoryPath)) {
      const data = await adminGraphql(auth.shop, auth.token, TAXONOMY_QUERY, { search: term });
      const id = pickTaxonomyCategory(data?.taxonomy?.categories?.nodes ?? [], term, source);
      if (id) return id;
    }
  } catch (err) {
    console.warn('[shopify] category search failed:', err instanceof Error ? err.message : err);
  }
  return null;
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
  const category = await findCategory(auth, product);
  const data = await adminGraphql(auth.shop, auth.token, CREATE_MUTATION, {
    input: newProductInput(product, location.id, category),
  });
  const refused = refusal(data?.productSet?.userErrors);
  if (refused) throw refused;
  const id = data?.productSet?.product?.id;
  if (!id) throw new ShopifyError('Shopify did not create the product', 'shopify', 502);
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
        return json(200, await deleteProduct(admin, user.id, body.productId));

      case 'product':
        return json(200, await product(admin, user.id, body.productId));

      case 'updateProduct':
        return json(200, await updateProduct(admin, user.id, body.productId, body.changes));

      case 'uploadPhoto':
        return json(200, await uploadPhoto(admin, user.id, body.dataUrl));

      case 'takeOneOff':
        return json(200, await takeOneOff(admin, user.id, body.productId, body.key));

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
