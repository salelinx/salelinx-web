// @ts-nocheck - this file runs under Deno, not the website's TS config.

// eBay's category for a listing, from its Taxonomy suggestions. Uses SaleLinx's
// application token, not the seller's: suggestions are public data, and this
// keeps the lookup behind resolve-category's crosslist gate.

import { categorySuggestionsFromResponse } from '../ebay/trading.ts';

const API_HOST = Deno.env.get('EBAY_ENV') === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const MARKETPLACES = new Set(['EBAY_GB', 'EBAY_US', 'EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_ES', 'EBAY_IE', 'EBAY_AU', 'EBAY_CA', 'EBAY_AT', 'EBAY_NL']);

let appToken: { token: string; until: number } | null = null;
const treeIds = new Map<string, string>();

async function token(): Promise<string> {
  if (appToken && appToken.until > Date.now()) return appToken.token;
  const basic = btoa(`${Deno.env.get('EBAY_CLIENT_ID')}:${Deno.env.get('EBAY_CLIENT_SECRET')}`);
  const res = await fetch(`${API_HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
  });
  if (!res.ok) throw new Error(`eBay app token ${res.status}`);
  const body = await res.json();
  appToken = { token: body.access_token, until: Date.now() + (body.expires_in - 120) * 1000 };
  return appToken.token;
}

async function get(path: string) {
  const res = await fetch(`${API_HOST}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw new Error(`eBay taxonomy ${res.status}`);
  return res.json();
}

/** Up to five leaf categories for the wording, best first. */
export async function ebayCategoriesFor(query: string, marketplace: unknown) {
  const market = typeof marketplace === 'string' && MARKETPLACES.has(marketplace) ? marketplace : 'EBAY_GB';
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!q) return [];
  let tree = treeIds.get(market);
  if (!tree) {
    tree = String((await get(`/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${market}`)).categoryTreeId);
    treeIds.set(market, tree);
  }
  const found = await get(`/commerce/taxonomy/v1/category_tree/${tree}/get_category_suggestions?q=${encodeURIComponent(q)}`);
  return categorySuggestionsFromResponse(found).slice(0, 5);
}
