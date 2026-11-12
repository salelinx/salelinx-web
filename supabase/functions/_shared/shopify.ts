// Shopify Admin API helpers shared by the shopify and shopify-public functions.
//
// Nothing here reads Deno.env: callers pass the app's keys in, so
// tests/shopify.test.ts can run the signature checks under vitest.

import { timingSafeEqual } from './security.ts';

export const API_VERSION = '2026-10';

// What a store is asked to approve. Adding one later makes every linked store
// approve again, so ask for what crosslisting and the sync need up front.
export const SCOPES = 'write_products,write_inventory,read_locations';

// Shopify's own rule for a store's permanent address.
const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

// How old a signed request may be. The extension forwards Shopify's redirects
// within seconds; the slack is for a slow popup or clock drift.
const MAX_AGE_SECONDS = 5 * 60;

export class ShopifyError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 502,
  ) {
    super(message);
  }
}

export const isShopDomain = (shop: unknown): shop is string =>
  typeof shop === 'string' && SHOP_RE.test(shop);

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** The message Shopify signs on a redirect: every param but `hmac` (and the
 *  retired `signature`), sorted by name, in query-string form. */
export function queryMessage(query: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(query).sort()) {
    if (key !== 'hmac' && key !== 'signature') params.append(key, query[key]);
  }
  return params.toString();
}

/**
 * Check a redirect Shopify signed (the App URL on install, and the OAuth
 * callback) and return the store it names. The query arrives from the
 * extension, which copied it out of its popup, so everything is checked here:
 * the signature, its age and the store's address.
 */
export async function verifiedShop(
  query: unknown,
  secret: string,
  now = Date.now(),
): Promise<string> {
  if (!query || typeof query !== 'object')
    throw new ShopifyError('Missing query', 'bad_request', 400);
  const q = query as Record<string, unknown>;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (typeof v !== 'string') throw new ShopifyError('Bad query', 'bad_request', 400);
    flat[k] = v;
  }
  if (!flat.hmac) throw new ShopifyError('Unsigned request', 'bad_signature', 400);
  const expected = hex(await hmacSha256(secret, queryMessage(flat)));
  if (!(await timingSafeEqual(expected, flat.hmac.toLowerCase()))) {
    throw new ShopifyError('Bad signature', 'bad_signature', 400);
  }
  const ts = Number(flat.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > MAX_AGE_SECONDS) {
    throw new ShopifyError('Request expired', 'expired', 400);
  }
  if (!isShopDomain(flat.shop)) throw new ShopifyError('Unknown store', 'bad_request', 400);
  return flat.shop;
}

/** A webhook's signature: base64 HMAC-SHA256 of the raw body. */
export async function verifyWebhook(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  return timingSafeEqual(base64(await hmacSha256(secret, rawBody)), header);
}

/** Shopify's OAuth consent page for one store. `redirectUri` must be on the
 *  app's allowed list, or Shopify shows an error instead. */
export function authorizeUrl(
  shop: string,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString();
  return url.toString();
}

export interface ShopifyTokens {
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/**
 * The token endpoint, for both the first exchange (`code`, with `expiring=1`)
 * and a refresh (`grant_type=refresh_token`). Apps made after April 2026 only
 * get expiring tokens: 60 minutes for access, 90 days for the refresh token.
 */
export async function tokenRequest(
  shop: string,
  params: Record<string, string>,
): Promise<ShopifyTokens> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.access_token !== 'string') {
    // A refused code or refresh token: the store has to approve again.
    const code = res.status >= 400 && res.status < 500 ? 'reauth' : 'shopify';
    throw new ShopifyError(
      body.error_description ?? `Shopify token error ${res.status}`,
      code,
      code === 'reauth' ? 409 : 502,
    );
  }
  return body as ShopifyTokens;
}

/** What a query cost and what the store's bucket has left, from Shopify's
 *  `extensions.cost`. */
export interface GraphqlCost {
  requested: number;
  available: number;
  restoreRate: number;
}

/** One Admin GraphQL call. Errors come back as ShopifyError codes the
 *  extension can act on: `reauth`, `busy` or `shopify`. `onCost` gets the
 *  query's cost, for a caller pacing several calls. */
export async function adminGraphql<T>(
  shop: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  onCost?: (cost: GraphqlCost) => void,
): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  // 401: the token was revoked, which uninstalling the app does.
  if (res.status === 401) throw new ShopifyError('Shopify refused the connection', 'reauth', 409);
  // 402: the store's plan lapsed. 423: Shopify locked the store.
  if (res.status === 402 || res.status === 423) {
    throw new ShopifyError('This Shopify store is unavailable', 'shop_unavailable', 409);
  }
  if (res.status === 429) throw new ShopifyError('Shopify is busy', 'busy', 429);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new ShopifyError(`Shopify error ${res.status}`, 'shopify');
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    if (
      body.errors.some(
        (e: { extensions?: { code?: string } }) => e.extensions?.code === 'THROTTLED',
      )
    ) {
      throw new ShopifyError('Shopify is busy', 'busy', 429);
    }
    throw new ShopifyError(String(body.errors[0]?.message ?? 'Shopify error'), 'shopify');
  }
  const cost = body.extensions?.cost;
  if (onCost && cost?.throttleStatus) {
    onCost({
      requested: Number(cost.requestedQueryCost) || 0,
      available: Number(cost.throttleStatus.currentlyAvailable) || 0,
      restoreRate: Number(cost.throttleStatus.restoreRate) || 50,
    });
  }
  return body.data as T;
}

/** A product as the extension's My Listings takes it. Status is Shopify's
 *  own (ACTIVE, DRAFT, ARCHIVED, UNLISTED): the extension maps it. */
export interface ShopifyListingSummary {
  productId: string;
  title: string;
  description: string;
  status: string;
  price: number | null;
  currency: string | null;
  totalInventory: number | null;
  tracksInventory: boolean;
  variants: number;
  /** Its variants, each a row of its own in My Listings: every one in `listings`, the one asked
   *  about in `product`. */
  variantList: ShopifyVariantSummary[];
  photos: string[];
  vendor: string | null;
  productType: string | null;
  /** The product in the store's admin, where the seller manages it. */
  url: string;
  /** The product on the online store, when it is published there. */
  storeUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** One variant of a product. Price and stock are its own; everything else is the product's. */
export interface ShopifyVariantSummary {
  variantId: string;
  /** Shopify's name for it, its option values joined ("M / Black"); "Default Title" when the
   *  product has no options. */
  title: string;
  options: { name: string; value: string }[];
  price: number | null;
  /** Units available across its locations; null when its stock isn't tracked. */
  quantity: number | null;
  tracked: boolean;
  /** Its own photo, when the seller gave it one. */
  photo: string | null;
}

/** "Size: M" pairs, as Shopify names them. */
// deno-lint-ignore no-explicit-any
function optionsOf(selected: any): { name: string; value: string }[] {
  return (Array.isArray(selected) ? selected : [])
    .filter(
      (o: { name?: unknown; value?: unknown }) =>
        typeof o?.name === 'string' && typeof o?.value === 'string',
    )
    .map((o: { name: string; value: string }) => ({ name: o.name, value: o.value }));
}

/** One variant node (VARIANT_FIELDS in the shopify function), or null without an id. */
// deno-lint-ignore no-explicit-any
export function variantSummary(v: any): ShopifyVariantSummary | null {
  const raw = v?.legacyResourceId ?? (typeof v?.id === 'string' ? v.id.split('/').pop() : null);
  if (raw == null || raw === '') return null;
  const price = Number(v.price);
  const tracked = v.inventoryItem?.tracked === true;
  const quantity = Number(v.inventoryQuantity);
  const photo = (v.media?.nodes ?? []).find(
    (m: { image?: { url?: unknown } }) => typeof m?.image?.url === 'string' && m.image.url,
  )?.image.url;
  return {
    variantId: String(raw),
    title: String(v.title ?? ''),
    options: optionsOf(v.selectedOptions),
    price: Number.isFinite(price) && v.price != null ? price : null,
    quantity: tracked && v.inventoryQuantity != null && Number.isFinite(quantity) ? quantity : null,
    tracked,
    photo: photo ?? null,
  };
}

/** One node of the products query in the shopify function. Its `variantList` is the variants the
 *  query read: the first, which is all of them unless the product has several (the function then
 *  reads the rest). */
// deno-lint-ignore no-explicit-any
export function productSummary(shop: string, p: any): ShopifyListingSummary {
  const id = String(p.legacyResourceId);
  const price = Number(p.priceRangeV2?.minVariantPrice?.amount);
  return {
    productId: id,
    title: String(p.title ?? ''),
    description: String(p.description ?? ''),
    status: String(p.status ?? ''),
    price: Number.isFinite(price) ? price : null,
    currency: p.priceRangeV2?.minVariantPrice?.currencyCode ?? null,
    totalInventory: typeof p.totalInventory === 'number' ? p.totalInventory : null,
    tracksInventory: p.tracksInventory === true,
    variants: Number(p.variantsCount?.count) || 1,
    variantList: (p.variants?.nodes ?? [])
      .map(variantSummary)
      .filter((v: ShopifyVariantSummary | null): v is ShopifyVariantSummary => v !== null),
    photos: (p.media?.nodes ?? [])
      .map((m: { image?: { url?: string } }) => m?.image?.url)
      .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0),
    vendor: p.vendor || null,
    productType: p.productType || null,
    url: `https://${shop}/admin/products/${id}`,
    storeUrl: p.onlineStoreUrl ?? null,
    createdAt: p.createdAt ?? null,
    updatedAt: p.updatedAt ?? null,
  };
}

/** `gid://shopify/Shop/123` -> `123`. */
export const shopIdFromGid = (gid: string): string => gid.split('/').pop() ?? gid;

/** A product's numeric id, as the extension holds it, made into its GID. */
export function productGid(productId: unknown): string {
  if (typeof productId !== 'string' || !/^\d{1,20}$/.test(productId)) {
    throw new ShopifyError('Bad product id', 'bad_request', 400);
  }
  return `gid://shopify/Product/${productId}`;
}

/** A variant's numeric id, as the extension holds it, made into its GID. */
export function variantGid(variantId: unknown): string {
  if (typeof variantId !== 'string' || !/^\d{1,20}$/.test(variantId)) {
    throw new ShopifyError('Bad variant id', 'bad_request', 400);
  }
  return `gid://shopify/ProductVariant/${variantId}`;
}

/** Shopify's first refusal, or nothing. `not_found` for a product that is gone. */
export function refusal(userErrors: { message?: string }[] | undefined): ShopifyError | null {
  const message = userErrors?.[0]?.message;
  if (!message) return null;
  const gone = /not exist|not found|couldn.t find/i.test(message);
  return new ShopifyError(message, gone ? 'not_found' : 'shopify', gone ? 404 : 422);
}

// ── Editing a product ──────────────────────────────────────────────────────

/** The editor's changes to a product, checked. Price and quantity are the one variant's. */
export interface ProductEdit {
  title?: string;
  /** Plain text, as the editor holds it. */
  description?: string;
  vendor?: string;
  productType?: string;
  price?: number;
  quantity?: number;
  /** The photos in order: the product's own image addresses and new ones. */
  photos?: string[];
}

const MAX_PHOTOS = 250;

/** The `changes` the extension sent, or a `bad_request` naming the first field that's wrong. */
export function productEdit(raw: unknown): ProductEdit {
  const bad = (field: string) => new ShopifyError(`Bad ${field}`, 'bad_request', 400);
  if (!raw || typeof raw !== 'object') throw bad('changes');
  const c = raw as Record<string, unknown>;
  const out: ProductEdit = {};
  const text = (field: 'title' | 'description' | 'vendor' | 'productType', max: number) => {
    const v = c[field];
    if (v === undefined) return;
    if (typeof v !== 'string' || v.length > max) throw bad(field);
    out[field] = v;
  };
  text('title', 255);
  text('description', 60_000);
  text('vendor', 255);
  text('productType', 255);
  if (out.title !== undefined && !out.title.trim()) throw bad('title');
  if (c.price !== undefined) {
    const p = c.price;
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p >= 1e9) throw bad('price');
    out.price = Math.round(p * 100) / 100;
  }
  if (c.quantity !== undefined) {
    const q = c.quantity;
    if (typeof q !== 'number' || !Number.isInteger(q) || q < 0 || q > 1_000_000) {
      throw bad('quantity');
    }
    out.quantity = q;
  }
  if (c.photos !== undefined) {
    const list = c.photos;
    if (
      !Array.isArray(list) ||
      list.length > MAX_PHOTOS ||
      !list.every((u) => typeof u === 'string' && u.length <= 2048 && /^https:\/\//.test(u))
    ) {
      throw bad('photos');
    }
    out.photos = list as string[];
  }
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The editor's plain-text description as Shopify's HTML: a paragraph per blank-line block, a
 *  line break per line. Whatever formatting the old description had is replaced. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** An image address without its query, which Shopify uses for a cache-busting version. */
const bare = (url: string) => url.split('?')[0];

/** `photos` as productSet's files: a photo the product already has keeps its media id, so
 *  Shopify keeps it rather than copying it; anything else is fetched from its address. */
export function photoFiles(
  photos: string[],
  media: { id: string; url: string }[],
): ({ id: string } | { originalSource: string; contentType: 'IMAGE' })[] {
  const byUrl = new Map(media.map((m) => [bare(m.url), m.id]));
  const used = new Set<string>();
  return photos.map((url) => {
    const id = byUrl.get(bare(url));
    if (id && !used.has(id)) {
      used.add(id);
      return { id };
    }
    return { originalSource: url, contentType: 'IMAGE' as const };
  });
}

/** True when `photos` is the product's media, same photos in the same order. */
export function samePhotos(photos: string[], media: { url: string }[]): boolean {
  return (
    photos.length === media.length && photos.every((url, i) => bare(url) === bare(media[i].url))
  );
}

// ── A crosslist into the store ─────────────────────────────────────────────

/** A listing crosslisted into the store, as the extension builds it from the source. */
export interface NewProduct {
  title: string;
  /** Plain text, made into HTML here. */
  description: string;
  /** The brand. */
  vendor: string;
  /** The category, in words. */
  productType: string;
  /** The source's category path ("Women > Outerwear > Jackets"), to find Shopify's own. */
  categoryPath: string;
  price: number;
  quantity: number;
  /** The one value of a Size option; empty for none. */
  size: string;
  /** Condition and colours. */
  tags: string[];
  /** Fetched by Shopify from where the source keeps them. */
  photos: string[];
  /** DRAFT unless the seller chose to post straight away. */
  status: 'DRAFT' | 'ACTIVE';
}

const MAX_TAGS = 250;

/** The `product` the extension sent, or a `bad_request` naming the first field that's wrong. */
export function newProduct(raw: unknown): NewProduct {
  const bad = (field: string) => new ShopifyError(`Bad ${field}`, 'bad_request', 400);
  if (!raw || typeof raw !== 'object') throw bad('product');
  const c = raw as Record<string, unknown>;
  const text = (field: string, max: number): string => {
    const v = c[field] ?? '';
    if (typeof v !== 'string' || v.length > max) throw bad(field);
    return v.trim();
  };
  const title = text('title', 255);
  if (!title) throw bad('title');
  const price = c.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price >= 1e9) {
    throw bad('price');
  }
  const quantity = c.quantity ?? 1;
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 1_000_000
  ) {
    throw bad('quantity');
  }
  const tags = c.tags ?? [];
  if (
    !Array.isArray(tags) ||
    tags.length > MAX_TAGS ||
    !tags.every((t) => typeof t === 'string' && t.length <= 255)
  ) {
    throw bad('tags');
  }
  const photos = c.photos ?? [];
  if (
    !Array.isArray(photos) ||
    photos.length > MAX_PHOTOS ||
    !photos.every((u) => typeof u === 'string' && u.length <= 2048 && /^https:\/\//.test(u))
  ) {
    throw bad('photos');
  }
  const status = c.status;
  if (status !== 'DRAFT' && status !== 'ACTIVE') throw bad('status');
  return {
    title,
    description: text('description', 60_000),
    vendor: text('vendor', 255),
    productType: text('productType', 255),
    categoryPath: text('categoryPath', 500),
    price: Math.round(price * 100) / 100,
    quantity,
    size: text('size', 255),
    // A comma would split one tag into two.
    tags: [...new Set((tags as string[]).map((t) => t.replace(/,/g, ' ').trim()).filter(Boolean))],
    photos: photos as string[],
    status,
  };
}

/** productSet's input for a new product: one variant, with the size as its Size option (Shopify's
 *  own default Title when there is none), its stock tracked at `locationId`, and Shopify's own
 *  category when one was found (pickTaxonomyCategory). */
export function newProductInput(p: NewProduct, locationId: string, category?: string | null) {
  const [optionName, value] = p.size ? ['Size', p.size] : ['Title', 'Default Title'];
  return {
    title: p.title,
    descriptionHtml: textToHtml(p.description),
    ...(p.vendor ? { vendor: p.vendor } : {}),
    ...(p.productType ? { productType: p.productType } : {}),
    ...(category ? { category } : {}),
    status: p.status,
    tags: p.tags,
    productOptions: [{ name: optionName, position: 1, values: [{ name: value }] }],
    variants: [
      {
        optionValues: [{ optionName, name: value }],
        price: p.price.toFixed(2),
        inventoryItem: { tracked: true },
        inventoryQuantities: [{ locationId, name: 'available', quantity: p.quantity }],
      },
    ],
    files: p.photos.map((url) => ({ originalSource: url, contentType: 'IMAGE' })),
  };
}

// Shopify's Category is one of its own standard categories, picked by id; the product type is
// free text. A crosslist searches the list for the product type, then the step above it, and
// takes the closest match, or none.

const STOP_WORDS = new Set(['and', 'the', 'other', 'of', 'for', 'with']);

/** One form for singular and plural: "Jackets" and "jacket" are both "jacket". */
function stem(w: string): string {
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

function matchWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
      .map(stem),
  );
}

/** What to search Shopify's categories for, in order: the product type, then the last two steps
 *  of the source's path, leaving out a catch-all "Other ...". Two at most. */
export function taxonomySearchTerms(productType: string, categoryPath: string): string[] {
  const steps = categoryPath
    .split('>')
    .map((s) => s.trim())
    .filter((s) => s && !/^other\b/i.test(s));
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of [productType.trim(), ...steps.slice(-2).reverse()]) {
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    terms.push(term);
  }
  return terms.slice(0, 2);
}

export interface TaxonomyNode {
  id: string;
  name: string;
  fullName: string;
  isArchived?: boolean;
}

/**
 * The search result that best fits the source, or null. Its own name must hold the searched word
 * (the search matches anywhere in the path). Each word of its path the source shares counts for
 * it; each it doesn't, against it, more so in its own name, so "Coats & Jackets" beats "Bomber
 * Jackets" under it and the baby range beside it.
 */
export function pickTaxonomyCategory(
  nodes: TaxonomyNode[],
  term: string,
  sourceText: string,
): string | null {
  const want = matchWords(term);
  const have = matchWords(`${sourceText} ${term}`);
  let best: { id: string; score: number } | null = null;
  for (const n of nodes) {
    if (n.isArchived || !n.id) continue;
    const name = matchWords(n.name ?? '');
    if (![...want].some((w) => name.has(w))) continue;
    let score = 0;
    for (const w of matchWords(n.fullName ?? '')) score += have.has(w) ? 2 : -0.25;
    for (const w of name) if (!have.has(w)) score -= 0.5;
    if (score > 0 && (!best || score > best.score)) best = { id: n.id, score };
  }
  return best?.id ?? null;
}

/** One product read for the editor (the shopify function's PRODUCT_QUERY). What the extension
 *  gets is `listing` and the `editable` flags; the ids stay here for the save. */
export interface ProductDetail {
  listing: ShopifyListingSummary;
  /** `listing.description` is Shopify's text version, all on one line. */
  descriptionHtml: string;
  /** The variant's units available, when SaleLinx can set them: tracked, at one location. */
  quantity: number | null;
  editable: { price: boolean; quantity: boolean; photos: boolean };
  /** The variant the read is about (its GID): the one named, else the product's only one. Null
   *  for a product with several and none named. */
  variantId: string | null;
  variant: ShopifyVariantSummary | null;
  /** That variant's stock is tracked. */
  tracked: boolean;
  stock: { inventoryItemId: string; locationId: string; quantity: number } | null;
  media: { id: string; url: string }[];
  /** Shopify's own category, as its full path; null when none is set. */
  category: string | null;
  tags: string[];
  /** That variant's options ("Size: M"); none without one. */
  options: { name: string; value: string }[];
}

/** `named` is the variant asked about (the query's `productVariant`, checked to be this
 *  product's); without one the read is about the product's only variant, if it has one. */
// deno-lint-ignore no-explicit-any
export function productDetail(shop: string, p: any, named?: any): ProductDetail {
  const summary = productSummary(shop, p);
  const count = Number(p.variantsCount?.count);
  const node = named ?? (count === 1 ? p.variants?.nodes?.[0] : null);
  const chosen = typeof node?.id === 'string' ? node : null;
  const item = chosen?.inventoryItem;
  const levels = item?.inventoryLevels?.nodes ?? [];
  const available = Number(levels[0]?.quantities?.[0]?.quantity);
  const stock =
    chosen && item?.tracked === true && levels.length === 1 && Number.isFinite(available)
      ? { inventoryItemId: item.id, locationId: levels[0].location?.id, quantity: available }
      : null;
  const nodes = p.media?.nodes ?? [];
  const media = nodes
    .filter((m: { id?: string; image?: { url?: string } }) => m?.id && m.image?.url)
    .map((m: { id: string; image: { url: string } }) => ({ id: m.id, url: m.image.url }));
  // A video, or a photo Shopify is still processing, isn't one SaleLinx can show, and a photo
  // save would drop it: the photos are only editable when the editor sees every one.
  const photos =
    media.length === nodes.length && Number(p.mediaCount?.count ?? nodes.length) === nodes.length;
  // The product's totalInventory and the variant's inventoryQuantity catch up with a stock change
  // a moment later, so a read straight after one (the editor's save, a linked sale's takeOneOff)
  // still has the old count and would read as Sold. The level is the count itself: with one
  // location it is the variant's, and with one variant the product's too.
  const own = chosen ? variantSummary(chosen) : null;
  const variant = own && stock ? { ...own, quantity: stock.quantity } : own;
  const base = count === 1 && stock ? { ...summary, totalInventory: stock.quantity } : summary;
  return {
    listing: { ...base, variantList: variant ? [variant] : [] },
    descriptionHtml: String(p.descriptionHtml ?? ''),
    quantity: stock?.quantity ?? null,
    editable: { price: chosen !== null, quantity: stock !== null && !!stock.locationId, photos },
    variantId: chosen ? chosen.id : null,
    variant,
    tracked: item?.tracked === true,
    stock: stock?.locationId ? stock : null,
    media,
    category: typeof p.category?.fullName === 'string' ? p.category.fullName : null,
    tags: Array.isArray(p.tags) ? p.tags.filter((t: unknown) => typeof t === 'string') : [],
    options: variant?.options ?? [],
  };
}

/** What a sale of a linked listing elsewhere does to this variant (the seller's rule, 2026-11-11):
 *  one off its stock, so a variant with some left stays for sale. */
export type OneOffPlan =
  /** Not for sale: a draft, archived, or no stock left. */
  | { kind: 'gone' }
  /** No variant named on a product with several, stock at several locations, or untracked stock
   *  on one of several variants: which one sold, or what to do, is the seller's call. */
  | { kind: 'manual' }
  /** The product's only variant, stock not tracked: Shopify would never sell it out, so the
   *  product is archived. */
  | { kind: 'archive' }
  | { kind: 'take'; inventoryItemId: string; locationId: string; from: number };

export function oneOffPlan(d: ProductDetail): OneOffPlan {
  if (d.listing.status !== 'ACTIVE') return { kind: 'gone' };
  if (!d.variantId) return { kind: 'manual' };
  // Archiving is the whole product's status: it would take the other variants off sale too.
  if (!d.tracked) return d.listing.variants > 1 ? { kind: 'manual' } : { kind: 'archive' };
  if (!d.stock) return { kind: 'manual' };
  if (d.stock.quantity <= 0) return { kind: 'gone' };
  const { inventoryItemId, locationId, quantity } = d.stock;
  return { kind: 'take', inventoryItemId, locationId, from: quantity };
}
