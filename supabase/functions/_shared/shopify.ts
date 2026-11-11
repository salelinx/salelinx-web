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

/** One Admin GraphQL call. Errors come back as ShopifyError codes the
 *  extension can act on: `reauth`, `busy` or `shopify`. */
export async function adminGraphql<T>(
  shop: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
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
  return body.data as T;
}

/** `gid://shopify/Shop/123` -> `123`. */
export const shopIdFromGid = (gid: string): string => gid.split('/').pop() ?? gid;
