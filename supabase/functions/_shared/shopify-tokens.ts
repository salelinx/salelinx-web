// A store's Admin API tokens (public.shopify_tokens, service role only), shared by the shopify
// function, which finds them by SaleLinx user, and shopify-public, whose app page finds them by
// store. A store has its row from the first time it opens the app, before it is connected to any
// account (user_id null).
//
// Shopify retires a refresh token the moment it issues the next one, and a token exchange retires
// every other, so only the call that claims refreshing_until may refresh or exchange; any other
// waits for its result.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { ShopifyError, type ShopifyTokens, tokenRequest } from './shopify.ts';

/** The app's keys, passed in so nothing here reads Deno.env. */
export interface ShopifyCreds {
  clientId: string;
  secret: string;
}

/** A store's access token and the scopes it granted (Shopify's comma list). */
export interface Auth {
  shop: string;
  token: string;
  scope: string | null;
}

/** Which row: the extension's calls know the user, the app page the store. */
export interface TokenKey {
  column: 'user_id' | 'shop_domain';
  value: string;
}

// A refresh normally takes well under a second; a claim older than this is
// from a call that died mid-refresh, and the next caller may take over.
const REFRESH_LOCK_MS = 30_000;

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function tokenColumns(t: ShopifyTokens) {
  return {
    scope: t.scope,
    access_token: t.access_token,
    access_expires_at: inSeconds(t.expires_in ?? 3600),
    refresh_token: t.refresh_token,
    refresh_expires_at: inSeconds(t.refresh_token_expires_in ?? 90 * 86400),
    updated_at: new Date().toISOString(),
  };
}

/** Takes the row's lock; the row's refresh token when this call holds it, else null. */
export async function claimLock(admin, key: TokenKey): Promise<{ refresh_token: string } | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('shopify_tokens')
    .update({ refreshing_until: new Date(Date.now() + REFRESH_LOCK_MS).toISOString() })
    .eq(key.column, key.value)
    .or(`refreshing_until.is.null,refreshing_until.lt."${now}"`)
    .select('refresh_token');
  if (error) throw new ShopifyError('Token lookup failed', 'unavailable', 500);
  return data?.[0] ?? null;
}

export async function releaseLock(admin, key: TokenKey): Promise<void> {
  await admin.from('shopify_tokens').update({ refreshing_until: null }).eq(key.column, key.value);
}

async function refresh(
  admin,
  key: TokenKey,
  creds: ShopifyCreds,
  shop: string,
  refreshToken: string,
  scope: string | null,
): Promise<Auth> {
  try {
    const fresh = await tokenRequest(shop, {
      client_id: creds.clientId,
      client_secret: creds.secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const { error } = await admin
      .from('shopify_tokens')
      .update({
        ...tokenColumns({ ...fresh, refresh_token: fresh.refresh_token ?? refreshToken }),
        refreshing_until: null,
      })
      .eq(key.column, key.value);
    // Shopify has already retired the old refresh token, so this store is lost until it opens
    // the app again (a token exchange).
    if (error) console.error('[shopify] refreshed token not saved');
    return { shop, token: fresh.access_token, scope: fresh.scope ?? scope };
  } catch (err) {
    await releaseLock(admin, key);
    throw err;
  }
}

/**
 * A working access token, refreshed when it has under a minute left. `not_linked` when there is
 * no row: an uninstall deleted it, or the account never connected a store.
 */
export async function accessToken(admin, key: TokenKey, creds: ShopifyCreds): Promise<Auth> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row, error } = await admin
      .from('shopify_tokens')
      .select('shop_domain, access_token, access_expires_at, scope')
      .eq(key.column, key.value)
      .maybeSingle();
    if (error) throw new ShopifyError('Token lookup failed', 'unavailable', 500);
    if (!row) throw new ShopifyError('Shopify is not connected', 'not_linked', 409);
    if (new Date(row.access_expires_at).getTime() - Date.now() > 60_000) {
      return { shop: row.shop_domain, token: row.access_token, scope: row.scope ?? null };
    }
    const claimed = await claimLock(admin, key);
    if (claimed) {
      return refresh(admin, key, creds, row.shop_domain, claimed.refresh_token, row.scope ?? null);
    }
    await sleep(500);
  }
  throw new ShopifyError('Shopify is busy, try again', 'busy', 503);
}

/**
 * The store's tokens for an App Bridge ID token (token exchange, an expiring offline token). A
 * refused exchange means the ID token went stale on the way, so it is `invalid_session`, which
 * the page answers with a fresh one.
 */
export async function exchangeIdToken(
  shop: string,
  idToken: string,
  creds: ShopifyCreds,
): Promise<ShopifyTokens> {
  try {
    return await tokenRequest(shop, {
      client_id: creds.clientId,
      client_secret: creds.secret,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: idToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: '1',
    });
  } catch (err) {
    if (err instanceof ShopifyError && err.code === 'reauth') {
      throw new ShopifyError('Invalid session (exchange)', 'invalid_session', 401);
    }
    throw err;
  }
}
