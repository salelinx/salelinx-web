// The ebay function's way into eBay: each user's OAuth tokens and the Trading API. Its own file so
// shopify-public can end a listing when a Shopify variant sells out (an inventory webhook, with no
// extension or page open), with the same tokens and calls as the ebay function.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { EbayError, parseTrading } from './trading.ts';

export const SANDBOX = Deno.env.get('EBAY_ENV') === 'sandbox';
export const API_HOST = SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

// sell.inventory and sell.account are for crosslisting, asked for now so
// linked users do not have to consent a second time when it ships.
export const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
].join(' ');

const TRADING_VERSION = '1451';

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new EbayError(`${name} not configured`, 'not_configured', 500);
  return v;
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export async function tokenRequest(params: Record<string, string>) {
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

export const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

export async function accessTokenFor(admin, userId: string): Promise<{ token: string; siteId: number }> {
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

export async function trading(call: string, auth: { token: string; siteId: number }, inner: string) {
  return parseTrading(call, await tradingText(call, auth, inner));
}

export async function tradingText(call: string, auth: { token: string; siteId: number }, inner: string) {
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
