// Supabase Edge Function: ebay
// ------------------------------------------------------------------------
// The extension's only route to eBay. Holds the app secret and each user's
// OAuth tokens (public.ebay_tokens, service role only) and speaks the Trading
// API on the user's behalf, returning plain JSON.
//
// Auth: the signed-in user's Supabase JWT in Authorization, or, from the
// Shopify app's page in a store's admin, App Bridge's ID token for the store:
// that acts for the account the store is connected to, through
// SHOPIFY_PAGE_ACTIONS only (shopify-listing.ts).
//
// Request body: { action, ...params }
//   consentUrl { state, client? }            -> { url } (eBay's sign-in always asks for the account: prompt=login)
//   link       { code, client? }             -> { userId, username, marketplace, siteKept }
//                (marketplace is the site listings go to; siteKept when a reconnect kept the seller's pick;
//                client 'web' is the website's eBay page, which eBay returns to instead of an extension)
//   unlink     {}                            -> { ok }
//   account    {}                            -> { accountType, marketplace } (accountType 'INDIVIDUAL' or 'BUSINESS')
//   setMarketplace { marketplace }           -> { marketplace } (the eBay site listings go to, e.g. 'EBAY_GB')
//   listings   { page }                      -> { listings, hasMore }
//   item       { itemId }                    -> { item }
//   revise     { itemId, changes, auction? } -> { ok }
//   uploadPhoto { dataUrl }                  -> { url } (for a listing, through the Media API)
//   uploadMessagePhoto { dataUrl }           -> { url } (for a reply, through the Media API)
//   end        { itemId, auction? }          -> { ok }
//   relist     { itemId, auction? }          -> { itemId } (the new listing's id; auction: true
//                                              uses eBay's auction calls, see listingCall)
//   add        { item }                      -> { itemId } (AddFixedPriceItem; item.templateItemId copies that listing's postage and returns)
//              item.auction ({ buyItNow, reserve, duration }) lists it as an auction from item.price
//   shippingServices {}                      -> { services } ({ id, name }[], domestic, listable)
//   policies   {}                            -> { shipping, returns, payment } ({ id, name }[] each)
//   aspects    { categoryId }                -> { aspects } (Taxonomy item specifics)
//   categories { q }                         -> { categories } (Taxonomy suggestions)
//   conditions { categoryId }                -> { conditions } (allowed condition ids)
//   traffic    { itemIds }                   -> { views: { [itemId]: n } } (last 90 days)
//   offers     {}                            -> { offers } (buyers' Best Offers still waiting on the seller)
//   respondOffer { itemId, offerId, response, price?, currency?, quantity? } -> { ok } (Accept, Decline or Counter)
//   offerEligible {}                         -> { listingIds } (listings with watchers eBay will take a seller offer on)
//   sendOffer  { listingId, discountPercentage | price, currency?, message? } -> { sent } (buyers it reached;
//              gated on auto_offer; refusals come back as negotiation.ts's codes)
//   shopifyItem { productId, variantId }     -> { item, marketplace, currency, setup, listed } (the
//                                              Shopify app's page: a store's variant, read from the store)
//   shopifyListing { productId, variantId, verifyOnly?, title, categoryId, conditionId, specifics,
//                    price, quantity, postage?, postcode? }
//                                            -> a fee check's verdict, or { itemId, url, linked } (the
//                                              Shopify app's page: lists the variant, counts it as a
//                                              crosslist and links it in the cloud)
//   conversations { maxAgeDays }           -> { conversations } (buyers' messages, messages.ts)
//   sendMessage { reply, text, photos? }     -> { ok } (reply: { itemId, parentMessageId, recipientId },
//                                              or { itemId, recipientId, subject } to start one with an order's buyer;
//                                              photos: addresses from uploadMessagePhoto)
//
// Errors: { error, code } with code 'not_linked' or 'reauth' when the user
// must connect eBay again, 'quota' when the app's daily eBay call limit is used
// up, 'ebay' for an eBay-side refusal. A real add (not verifyOnly) can also be
// refused with 403 'upgrade_required' or 'limit_reached' by the crosslist
// paywall in _shared/crosslist-gate.ts, before anything reaches eBay. Uploading a
// reply's photo (uploadMessagePhoto) answers 403 'upgrade_required' on a plan
// without Messages, 429 'rate_limited' at a pace only a script reaches, and
// 'bad_request' for anything but a JPEG (message-photos.ts).
//
// Secrets: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME (dev extension),
// EBAY_RUNAME_STORE (Chrome Web Store extension), EBAY_RUNAMES (optional JSON
// of extension id -> RuName for other dev copies, checked first),
// EBAY_RUNAME_WEB (the website's eBay page, /ebay/connect),
// SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (the Shopify app's page),
// EBAY_ENV ('sandbox' for the sandbox hosts, anything else is production).

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';
import { checkCrosslistAllowed, monthKey } from '../_shared/crosslist-gate.ts';
import { checkFeatureAllowed } from '../_shared/feature-gate.ts';
import {
  countMessagePhoto,
  decodeMessagePhoto,
  isEbayPhotoUrl,
  photoHostOf,
} from './message-photos.ts';
import {
  EbayError,
  esc,
  itemFromResponse,
  listingCall,
  listingsFromResponse,
  parseTrading,
  trafficQuery,
  viewsFromTrafficReport,
  aspectsFromResponse,
  conditionsFromResponse,
  categorySuggestionsFromResponse,
  reviseFields,
  addItemXml,
  policiesFromPreferences,
  shippingFromItemXml,
  shippingServicesFromDetails,
  verifyFromResponse,
  linkSiteId,
  bestOffersFromResponse,
  respondOfferXml,
  openOrdersFromResponse,
  markShippedXml,
  QUOTA_MESSAGE,
} from './trading.ts';
import {
  answersMissing,
  answersQuery,
  conversationsFromResponse,
  hasUnanswered,
  inboxHeadersQuery,
  memberMessagesQuery,
  partnerXml,
  replyXml,
  withAnswers,
  withReadState,
} from './messages.ts';
import { eligibleIdsFromResponse, offerErrorCode, sendOfferBody } from './negotiation.ts';
import {
  API_HOST,
  SANDBOX,
  SCOPES,
  accessTokenFor,
  env,
  inSeconds,
  tokenRequest,
  trading,
  tradingText,
} from './api.ts';
import { ShopifyError, adminGraphql, verifyIdToken } from '../_shared/shopify.ts';
import { accessToken as shopifyAccessToken } from '../_shared/shopify-tokens.ts';
import { isShopifyIdToken } from '../_shared/shopify-app-page.ts';
import { linkedEbayRows } from '../_shared/link-groups.ts';
import {
  EBAY_CURRENCY,
  MAX_EBAY_PHOTOS,
  SHOPIFY_PAGE_ACTIONS,
  SHOPIFY_VARIANT_QUERY,
  ebayItemUrl,
  ebayPhotoSource,
  linkKey,
  postageOf,
  postcodeOf,
  savedSetup,
  setupToSave,
  shopifyItem,
  shopifyRowStatus,
  specificsOf,
  textToEbayHtml,
} from './shopify-listing.ts';

const CORS_HEADERS = sharedCorsHeaders();

const AUTH_HOST = SANDBOX ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';
const APIZ_HOST = SANDBOX ? 'https://apiz.sandbox.ebay.com' : 'https://apiz.ebay.com';
const APIM_HOST = SANDBOX ? 'https://apim.sandbox.ebay.com' : 'https://apim.ebay.com';

const SITE_IDS: Record<string, number> = {
  EBAY_US: 0, EBAY_CA: 2, EBAY_GB: 3, EBAY_AU: 15, EBAY_AT: 16, EBAY_FR: 71,
  EBAY_DE: 77, EBAY_IT: 101, EBAY_NL: 146, EBAY_ES: 186, EBAY_IE: 205,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const STORE_EXTENSION_ID = 'oichfmfogobecihmhlgkfcfbdceomenj';

// eBay only redirects to a RuName's accept URL, which names one extension id, or the website's own
// eBay page (client 'web': app/[locale]/ebay/connect, which the Shopify app's page sends a seller to).
function runame(extensionId: unknown, client?: unknown): string {
  if (client === 'web') return env('EBAY_RUNAME_WEB');
  const mapped = JSON.parse(Deno.env.get('EBAY_RUNAMES') || '{}')[String(extensionId)];
  if (typeof mapped === 'string') return mapped;
  return env(extensionId === STORE_EXTENSION_ID ? 'EBAY_RUNAME_STORE' : 'EBAY_RUNAME');
}

// ── Trading API ────────────────────────────────────────────────────────────

const PAGE_SIZE = 200;

async function listings(auth, page: number) {
  const pagination = `<Pagination><EntriesPerPage>${PAGE_SIZE}</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`;
  const body = await trading(
    'GetMyeBaySelling',
    auth,
    `<ActiveList><Include>true</Include><IncludeWatchCount>true</IncludeWatchCount>${pagination}</ActiveList>` +
      `<SoldList><Include>true</Include><DurationInDays>60</DurationInDays>${pagination}</SoldList>` +
      `<UnsoldList><Include>true</Include><DurationInDays>60</DurationInDays>${pagination}</UnsoldList>` +
      `<DetailLevel>ReturnAll</DetailLevel>`,
  );
  return listingsFromResponse(body, page);
}

async function item(auth, itemId: string) {
  const body = await trading(
    'GetItem',
    auth,
    `<ItemID>${esc(itemId)}</ItemID><DetailLevel>ReturnAll</DetailLevel>` +
      `<IncludeItemSpecifics>true</IncludeItemSpecifics><IncludeWatchCount>true</IncludeWatchCount>`,
  );
  return itemFromResponse(body);
}

async function revise(auth, itemId: string, c, auction: unknown) {
  const fields = reviseFields(c);
  if (!fields) return;
  await trading(listingCall('revise', auction), auth, `<Item><ItemID>${esc(itemId)}</ItemID>${fields}</Item>`);
}

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const OFFER_ELIGIBLE_MAX = 1000;
const TRAFFIC_BATCH = 200;

const MARKETPLACE_BY_SITE = Object.fromEntries(Object.entries(SITE_IDS).map(([m, id]) => [id, m]));

// Negotiation API: not a Trading call, so it leaves the shared daily quota alone.
async function negotiation(auth, path: string, payload?: unknown) {
  const res = await fetch(`${API_HOST}/sell/negotiation/v1${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB',
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) throw new EbayError(QUOTA_MESSAGE, 'quota', 429);
  if (!res.ok) {
    const err = body?.errors?.[0];
    throw new EbayError(err?.message ?? `eBay request failed (${res.status})`, offerErrorCode(err?.errorId), 502);
  }
  return body;
}

async function rest(auth, path: string) {
  const res = await fetch(`${API_HOST}${path}`, { headers: { Authorization: `Bearer ${auth.token}` } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) throw new EbayError(QUOTA_MESSAGE, 'quota', 429);
  if (!res.ok) {
    throw new EbayError(body?.errors?.[0]?.message ?? `eBay request failed (${res.status})`, 'ebay', 502);
  }
  return body;
}

// Who a message's sender or recipient has to be for it to be the seller's own.
async function ebayIdentity(admin, userId: string) {
  const { data } = await admin
    .from('linked_accounts')
    .select('platform_user_id, platform_username')
    .eq('user_id', userId)
    .eq('platform', 'ebay')
    .maybeSingle();
  return { userId: data?.platform_user_id, username: data?.platform_username };
}

function photoBlob(dataUrl: string): Blob {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(dataUrl ?? '');
  if (!m) throw new EbayError('Expected an image data URL', 'bad_request');
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  if (bytes.length > MAX_PHOTO_BYTES) throw new EbayError('Photo is too large', 'bad_request');
  return new Blob([bytes], { type: m[1] });
}

/** A listing's photo. eBay retired the Trading API's upload (UploadSiteHostedPictures) on
 *  2026-09-30, so these go through the Media API as a reply's do; its address works in PictureURL. */
async function uploadPhoto(auth, dataUrl: string): Promise<string> {
  return createImage(auth, photoBlob(dataUrl));
}

/** Hosts a photo on eBay through the Media API and gives its address. It isn't a Trading call, so it
 *  leaves the shared daily quota alone, and sell.inventory is all it needs, which every token has had
 *  from the start. */
async function createImage(auth, photo: Blob): Promise<string> {
  const form = new FormData();
  form.append('image', photo, 'photo');
  const res = await fetch(`${APIM_HOST}/commerce/media/v1_beta/image/create_image_from_file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) throw new EbayError(QUOTA_MESSAGE, 'quota', 429);
  if (!res.ok || !body?.imageUrl) {
    throw new EbayError(body?.errors?.[0]?.message ?? `eBay photo upload failed (${res.status})`, 'ebay', 502);
  }
  return String(body.imageUrl);
}

/** A photo for a message, under the stricter checks in message-photos.ts. */
async function uploadMessagePhoto(auth, dataUrl: string): Promise<string> {
  const url = await createImage(auth, decodeMessagePhoto(dataUrl));
  // sendMessage only takes eBay's own addresses, so one it wouldn't is worth saying here: by host only.
  if (!isEbayPhotoUrl(url)) {
    throw new EbayError(`eBay gave a photo address we don't accept (${photoHostOf(url)})`, 'ebay', 502);
  }
  return url;
}

// ── Linking ────────────────────────────────────────────────────────────────

async function link(admin, userScoped, userId: string, code: string, extensionId: unknown, client: unknown) {
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: runame(extensionId, client),
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

  // Reconnecting the same eBay account keeps the site the seller picked; the registration site
  // is only the start (linkSiteId).
  const { data: prior } = await admin
    .from('ebay_tokens')
    .select('ebay_user_id, site_id')
    .eq('user_id', userId)
    .maybeSingle();
  const { siteId, kept } = linkSiteId(SITE_IDS, me.registrationMarketplaceId, prior, me.userId);

  const { error: tokErr } = await admin.from('ebay_tokens').upsert(
    {
      user_id: userId,
      ebay_user_id: me.userId,
      site_id: siteId,
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
  return {
    userId: me.userId,
    username: me.username ?? null,
    marketplace: MARKETPLACE_BY_SITE[siteId] ?? 'EBAY_GB',
    siteKept: kept,
  };
}

// ── The Shopify app's page ─────────────────────────────────────────────────

/** The account the store an App Bridge ID token names is connected to. */
async function shopifyPageCaller(admin, token: string) {
  const shop = await verifyIdToken(token, env('SHOPIFY_CLIENT_ID'), env('SHOPIFY_CLIENT_SECRET'));
  const { data, error } = await admin
    .from('shopify_tokens')
    .select('user_id, shop_id')
    .eq('shop_domain', shop)
    .maybeSingle();
  if (error) throw new EbayError('Store lookup failed', 'unavailable', 500);
  if (!data?.user_id) {
    throw new EbayError('Connect the store to a SaleLinx account first', 'store_not_connected', 409);
  }
  return { userId: data.user_id, shop, shopId: String(data.shop_id) };
}

/** The variant the page names, read from the store itself: the page only says which one. */
async function readShopifyItem(admin, page, body) {
  const productId = String(body.productId ?? '');
  const variantId = String(body.variantId ?? '');
  if (!/^\d{1,20}$/.test(productId) || !/^\d{1,20}$/.test(variantId)) {
    throw new EbayError('Missing product', 'bad_request', 400);
  }
  const creds = { clientId: env('SHOPIFY_CLIENT_ID'), secret: env('SHOPIFY_CLIENT_SECRET') };
  const auth = await shopifyAccessToken(admin, { column: 'shop_domain', value: page.shop }, creds);
  const data = await adminGraphql(auth.shop, auth.token, SHOPIFY_VARIANT_QUERY, {
    id: `gid://shopify/ProductVariant/${variantId}`,
  });
  const item = shopifyItem(data, productId);
  if (!item) throw new EbayError('That product is not in the store', 'not_found', 404);
  return item;
}

/** The variant's linked eBay listing, in any state, or null. */
async function ebayPartnerOf(admin, userId: string, rowId: string) {
  try {
    return (await linkedEbayRows(admin, userId, [rowId])).get(rowId) ?? null;
  } catch {
    throw new EbayError('Listings lookup failed', 'unavailable', 500);
  }
}

/**
 * How the listing is posted, found as the extension finds it (create-ebay.ts ebayListingSetup):
 * the setup it saved for the account, else postage copied from one of the seller's live eBay
 * listings, else nothing, and the page asks for postage.
 */
async function shopifyListingSetup(admin, userId: string) {
  const { data: settings } = await admin
    .from('user_settings')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  const saved = savedSetup(settings?.preferences?.ebayPostage);
  if (saved) return { kind: 'saved', ...saved };
  const me = await ebayIdentity(admin, userId);
  let query = admin
    .from('listings')
    .select('platform_listing_id, title')
    .eq('user_id', userId)
    .eq('platform', 'ebay')
    .eq('status', 'active');
  if (me.userId) query = query.eq('platform_user_id', me.userId);
  const { data: template } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (template && /^\d{1,20}$/.test(String(template.platform_listing_id))) {
    return {
      kind: 'template',
      templateItemId: String(template.platform_listing_id),
      templateTitle: template.title ?? null,
    };
  }
  return { kind: 'none' };
}

/** Hosts a photo on eBay from its address, which eBay fetches itself (the Media API, not Trading). */
async function createImageFromUrl(auth, imageUrl: string): Promise<string> {
  const res = await fetch(`${APIM_HOST}/commerce/media/v1_beta/image/create_image_from_url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  let body = await res.json().catch(() => ({}));
  if (res.status === 429) throw new EbayError(QUOTA_MESSAGE, 'quota', 429);
  // The image's address, or where to read it: eBay names the new image in Location.
  const location = res.headers.get('Location');
  if (res.ok && !body?.imageUrl && location?.startsWith(`${APIM_HOST}/commerce/media/`)) {
    const read = await fetch(location, { headers: { Authorization: `Bearer ${auth.token}` } });
    body = await read.json().catch(() => ({}));
  }
  if (!res.ok || !body?.imageUrl) {
    throw new EbayError(body?.errors?.[0]?.message ?? `eBay photo upload failed (${res.status})`, 'ebay', 502);
  }
  return String(body.imageUrl);
}

/** Counts a listing from the page as a crosslist, as the extension counts its own afterwards. */
async function countShopifyCrosslist(admin, userId: string) {
  const { error } = await admin.rpc('increment_usage_counter_for', {
    p_user_id: userId,
    p_feature: 'crosslist',
    p_period_key: monthKey(),
  });
  if (error) console.warn(`[ebay] user=${userId} action=shopifyListing code=count_failed`);
}

/** Keeps postage typed on the page as the account's eBay setup, as the extension saves its own. */
async function saveShopifyPostage(admin, userId: string, postcode: string, postage) {
  const { data, error } = await admin
    .from('user_settings')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return;
  const preferences = { ...(data?.preferences ?? {}), ebayPostage: setupToSave(postcode, postage) };
  await admin.from('user_settings').upsert({ user_id: userId, preferences }, { onConflict: 'user_id' });
}

/**
 * Saves the new eBay listing to the cloud linked to the Shopify variant it came from, as the
 * extension's crosslist does, so My Listings shows them linked and a sale takes the other down.
 * The variant's own row is written only when it has none: the extension's save fills it in later,
 * and a save never writes link_id. False when it couldn't link (an old-style link, the row cap).
 */
async function linkShopifyListing(admin, userId: string, page, item, ebay): Promise<boolean> {
  const { data: existing, error } = await admin
    .from('listings')
    .select('id, link_id')
    .eq('user_id', userId)
    .eq('id', item.rowId)
    .maybeSingle();
  if (error) return false;
  const ebayRowId = `ebay_${ebay.itemId}`;
  const link = linkKey(item.rowId, existing?.link_id ?? null, ebayRowId);
  if (!link) return false;
  const now = Date.now();
  const times = { last_synced_at: now, created_at: now, updated_at: now };
  const { error: ebayErr } = await admin.from('listings').upsert(
    {
      ...times,
      id: ebayRowId,
      user_id: userId,
      platform: 'ebay',
      platform_listing_id: ebay.itemId,
      platform_user_id: ebay.ebayUserId ?? null,
      title: ebay.title,
      description: '',
      price: ebay.price,
      currency: ebay.currency,
      photos: ebay.photos,
      status: 'active',
      url: ebay.url,
      link_id: link.key,
    },
    { onConflict: 'user_id,id' },
  );
  if (ebayErr) {
    console.warn(`[ebay] user=${userId} action=shopifyListing code=link_failed`);
    return false;
  }
  const { error: rowErr } = existing
    ? link.setOnShopify
      ? await admin
          .from('listings')
          .update({ link_id: link.key })
          .eq('user_id', userId)
          .eq('id', item.rowId)
      : { error: null }
    : await admin.from('listings').insert({
        ...times,
        id: item.rowId,
        user_id: userId,
        platform: 'shopify',
        platform_listing_id: `${item.productId}_${item.variantId}`,
        platform_user_id: page.shopId,
        title: item.title,
        description: item.description,
        price: item.price ?? 0,
        currency: item.currency ?? 'GBP',
        photos: item.photos,
        status: shopifyRowStatus(item.status, item.quantity),
        brand: item.vendor,
        size: item.variantTitle,
        category: item.productType,
        url: `https://${page.shop}/admin/products/${item.productId}/variants/${item.variantId}`,
        link_id: link.key,
      });
  if (rowErr) console.warn(`[ebay] user=${userId} action=shopifyListing code=link_failed`);
  return !rowErr;
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
  // The Shopify app's page in a store's admin has no SaleLinx login, only App Bridge's ID token for
  // the store. It acts for the account the store is connected to, through SHOPIFY_PAGE_ACTIONS only:
  // never linking, which takes the seller's own login (the website's /ebay/connect).
  let user;
  let shopifyPage = null;
  if (isShopifyIdToken(jwt)) {
    try {
      shopifyPage = await shopifyPageCaller(admin, jwt);
    } catch (err) {
      const known = err instanceof EbayError || err instanceof ShopifyError;
      return json(known ? err.status : 502, {
        error: known ? err.message : 'Store lookup failed',
        code: known ? err.code : 'unavailable',
      });
    }
    user = { id: shopifyPage.userId };
  } else {
    const { data, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !data?.user) return json(401, { error: userErr?.message ?? 'Invalid session' });
    user = data.user;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  if (shopifyPage && !SHOPIFY_PAGE_ACTIONS.has(body?.action)) {
    return json(403, { error: 'Not available from Shopify', code: 'not_allowed' });
  }

  try {
    switch (body?.action) {
      case 'consentUrl': {
        if (typeof body.state !== 'string' || !body.state) return json(400, { error: 'Missing state' });
        const url = new URL(`${AUTH_HOST}/oauth2/authorize`);
        url.search = new URLSearchParams({
          client_id: env('EBAY_CLIENT_ID'),
          redirect_uri: runame(body.extensionId, body.client),
          response_type: 'code',
          scope: SCOPES,
          state: body.state,
          // Always ask which eBay account. Without it eBay approves whoever is signed in to
          // ebay.com, and that session is separate from ebay.co.uk's, so a seller signed in to
          // another account on their own site still got the old one linked.
          prompt: 'login',
        }).toString();
        return json(200, { url: url.toString() });
      }

      case 'link': {
        if (typeof body.code !== 'string' || !body.code) return json(400, { error: 'Missing code' });
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        return json(200, await link(admin, userScoped, user.id, body.code, body.extensionId, body.client));
      }

      case 'account': {
        const auth = await accessTokenFor(admin, user.id);
        const res = await fetch(`${APIZ_HOST}/commerce/identity/v1/user/`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!res.ok) throw new EbayError(`eBay identity lookup failed (${res.status})`, 'ebay', 502);
        const me = await res.json();
        return json(200, {
          accountType: me.accountType === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL',
          marketplace: MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB',
        });
      }

      // Whether eBay has finished registering the account as a seller. Until it has, eBay refuses
      // every listing with a message that doesn't say what is missing (640 on eBay UK).
      case 'privileges': {
        const res = await rest(await accessTokenFor(admin, user.id), '/sell/account/v1/privilege');
        const done = res.sellerRegistrationCompleted;
        return json(200, { registered: typeof done === 'boolean' ? done : null });
      }

      case 'setMarketplace': {
        const marketplace = body.marketplace;
        if (typeof marketplace !== 'string' || !Object.hasOwn(SITE_IDS, marketplace)) {
          return json(400, { error: 'Unknown eBay site' });
        }
        const { data, error } = await admin
          .from('ebay_tokens')
          .update({ site_id: SITE_IDS[marketplace], updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select('user_id');
        if (error) throw new EbayError('Could not save the eBay site', 'unavailable', 500);
        if (!data?.length) throw new EbayError('eBay is not connected', 'not_linked', 409);
        return json(200, { marketplace });
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
        await revise(await accessTokenFor(admin, user.id), body.itemId, body.changes ?? {}, body.auction);
        return json(200, { ok: true });
      }

      case 'uploadPhoto': {
        return json(200, { url: await uploadPhoto(await accessTokenFor(admin, user.id), body.dataUrl) });
      }

      case 'uploadMessagePhoto': {
        // Both before the photo is decoded or eBay is called, so a refused upload costs next to nothing.
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const gate = await checkFeatureAllowed(userScoped, user.id, 'messages', 'ebay');
        if (!gate.ok) return json(gate.status, gate.body);
        await countMessagePhoto(userScoped, user.id);
        return json(200, { url: await uploadMessagePhoto(await accessTokenFor(admin, user.id), body.dataUrl) });
      }

      case 'aspects': {
        const categoryId = String(body.categoryId ?? '');
        if (!/^\d+$/.test(categoryId)) return json(400, { error: 'Missing categoryId' });
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const tree = await rest(auth, `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplace}`);
        const aspects = await rest(
          auth,
          `/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_item_aspects_for_category?category_id=${categoryId}`,
        );
        return json(200, { aspects: aspectsFromResponse(aspects) });
      }

      case 'categories': {
        const q = typeof body.q === 'string' ? body.q.trim().slice(0, 100) : '';
        if (q.length < 2) return json(200, { categories: [] });
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const tree = await rest(auth, `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplace}`);
        const found = await rest(
          auth,
          `/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(q)}`,
        );
        return json(200, { categories: categorySuggestionsFromResponse(found) });
      }

      case 'conditions': {
        const categoryId = String(body.categoryId ?? '');
        if (!/^\d+$/.test(categoryId)) return json(400, { error: 'Missing categoryId' });
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const policies = await rest(
          auth,
          `/sell/metadata/v1/marketplace/${marketplace}/get_item_condition_policies?filter=${encodeURIComponent(`categoryIds:{${categoryId}}`)}`,
        );
        return json(200, { conditions: conditionsFromResponse(policies) });
      }

      case 'traffic': {
        const ids = Array.isArray(body.itemIds) ? body.itemIds.filter((i) => typeof i === 'string') : [];
        if (ids.length === 0) return json(200, { views: {} });
        const auth = await accessTokenFor(admin, user.id);
        const views: Record<string, number> = {};
        for (let i = 0; i < ids.length; i += TRAFFIC_BATCH) {
          const res = await fetch(
            `${API_HOST}/sell/analytics/v1/traffic_report?${trafficQuery(ids.slice(i, i + TRAFFIC_BATCH), new Date())}`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          const report = await res.json().catch(() => ({}));
          if (!res.ok) {
            // A token from before the analytics scope was asked for is refused here.
            const code = res.status === 403 ? 'scope' : 'ebay';
            throw new EbayError(report?.errors?.[0]?.message ?? `Traffic report failed (${res.status})`, code, res.status === 403 ? 403 : 502);
          }
          Object.assign(views, viewsFromTrafficReport(report));
        }
        return json(200, { views });
      }

      case 'add': {
        // A real add posts the crosslist itself, so it is held to the same
        // paywall as resolve-category: without this, anyone could post to eBay
        // past their plan by calling this action directly. A verify-only fee
        // check creates nothing and stays open. Checked before any eBay call,
        // so a refused request spends none of the shared daily quota.
        if (body.verifyOnly !== true) {
          const userScoped = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${jwt}` } },
          });
          const gate = await checkCrosslistAllowed(userScoped, user.id, 'ebay');
          if (!gate.ok) return json(gate.status, gate.body);
        }
        const auth = await accessTokenFor(admin, user.id);
        const item = { ...(body.item ?? {}) };
        // No business policies: copy postage, returns and location from one of the seller's listings.
        if (typeof item.templateItemId === 'string' && /^\d+$/.test(item.templateItemId)) {
          const text = await tradingText(
            'GetItem',
            auth,
            `<ItemID>${item.templateItemId}</ItemID><DetailLevel>ReturnAll</DetailLevel>`,
          );
          const template = parseTrading('GetItem', text).Item ?? {};
          item.copiedShipping = shippingFromItemXml(text);
          item.postcode = item.postcode || template.PostalCode || '';
        }
        const built = addItemXml(item, MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB');
        if (built.error) return json(400, { error: built.error, code: 'bad_request' });
        // A test run: eBay checks everything a real listing would go through, and nothing goes live.
        if (body.verifyOnly === true) {
          return json(
            200,
            verifyFromResponse(await tradingText(listingCall('verify', !!item.auction), auth, built.xml)),
          );
        }
        const res = await trading(listingCall('add', !!item.auction), auth, built.xml);
        return json(200, { itemId: String(res.ItemID) });
      }

      case 'shopifyItem': {
        const item = await readShopifyItem(admin, shopifyPage, body);
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const [setup, partner] = await Promise.all([
          shopifyListingSetup(admin, user.id),
          ebayPartnerOf(admin, user.id, item.rowId),
        ]);
        return json(200, {
          item,
          marketplace,
          currency: EBAY_CURRENCY[marketplace] ?? 'GBP',
          setup: {
            kind: setup.kind,
            postcode: setup.postcode ?? null,
            templateTitle: setup.templateTitle ?? null,
          },
          listed: !!partner,
        });
      }

      case 'shopifyListing': {
        const item = await readShopifyItem(admin, shopifyPage, body);
        // One eBay listing a variant: a second couldn't join its link group.
        if (await ebayPartnerOf(admin, user.id, item.rowId)) {
          return json(409, { error: 'This product is already on eBay', code: 'already_on_ebay' });
        }
        const verifyOnly = body.verifyOnly === true;
        const setup = await shopifyListingSetup(admin, user.id);
        let typed = null;
        if (setup.kind === 'none') {
          const postage = postageOf(body.postage);
          const postcode = postcodeOf(body.postcode);
          if (!postage || !postcode) {
            return json(400, { error: 'Enter your postage first', code: 'postage_needed' });
          }
          typed = { postage, postcode };
        }
        const price = Number(body.price);
        if (!(price > 0) || price > 1_000_000) {
          return json(400, { error: 'Missing price', code: 'bad_request' });
        }
        // Checked before any eBay call, so a refused request spends none of the shared quota.
        if (!verifyOnly) {
          const gate = await checkCrosslistAllowed(admin, user.id, 'ebay');
          if (!gate.ok) return json(gate.status, gate.body);
        }
        const auth = await accessTokenFor(admin, user.id);
        const marketplace = MARKETPLACE_BY_SITE[auth.siteId] ?? 'EBAY_GB';
        const currency = EBAY_CURRENCY[marketplace] ?? 'GBP';
        const sources = item.photos.map(ebayPhotoSource).filter(Boolean).slice(0, MAX_EBAY_PHOTOS);
        // A fee check sends the store's own addresses, as the extension's does, and drops eBay's
        // complaints about them; a real listing hosts each on eBay first, three at a time.
        let photos = sources;
        if (!verifyOnly) {
          photos = [];
          for (let i = 0; i < sources.length; i += 3) {
            const done = await Promise.all(
              sources.slice(i, i + 3).map((u) => createImageFromUrl(auth, u).catch(() => null)),
            );
            photos.push(...done.filter(Boolean));
          }
          if (photos.length === 0) {
            return json(502, { error: 'No photos could be added to eBay', code: 'photos' });
          }
        }
        const quantity = Number(body.quantity);
        const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : item.title;
        const conditionId = Number(body.conditionId);
        const listing = {
          title: title.slice(0, 80),
          description: textToEbayHtml(item.description || item.title),
          categoryId: String(body.categoryId ?? ''),
          ...(Number.isInteger(conditionId) && conditionId > 0 ? { conditionId } : {}),
          specifics: specificsOf(body.specifics),
          price: Math.round(price * 100) / 100,
          quantity: Number.isInteger(quantity) && quantity > 0 && quantity <= 10_000 ? quantity : 1,
          photos,
          postcode: typed?.postcode ?? setup.postcode ?? '',
          ...(typed
            ? { postage: typed.postage }
            : setup.postage
              ? { postage: setup.postage }
              : setup.policies
                ? { policies: setup.policies }
                : {}),
        };
        // No saved setup: postage, returns and location from one of the seller's listings, as `add` does.
        if (setup.kind === 'template') {
          const text = await tradingText(
            'GetItem',
            auth,
            `<ItemID>${setup.templateItemId}</ItemID><DetailLevel>ReturnAll</DetailLevel>`,
          );
          const template = parseTrading('GetItem', text).Item ?? {};
          listing.copiedShipping = shippingFromItemXml(text);
          listing.postcode = template.PostalCode || '';
        }
        const built = addItemXml(listing, marketplace);
        if (built.error) return json(400, { error: built.error, code: 'bad_request' });
        if (verifyOnly) {
          const verdict = verifyFromResponse(await tradingText(listingCall('verify', false), auth, built.xml));
          const errors = verdict.errors.filter((e) => !/picture|photo|image/i.test(e));
          return json(200, { ...verdict, ok: errors.length === 0, errors, currency });
        }
        const res = await trading(listingCall('add', false), auth, built.xml);
        const itemId = String(res.ItemID);
        const url = ebayItemUrl(marketplace, itemId);
        // It is live: nothing after this may fail the answer.
        const me = await ebayIdentity(admin, user.id).catch(() => ({}));
        const [, linked] = await Promise.all([
          countShopifyCrosslist(admin, user.id).catch(() => {}),
          linkShopifyListing(admin, user.id, shopifyPage, item, {
            itemId,
            url,
            title: listing.title,
            price: listing.price,
            currency,
            photos,
            ebayUserId: me.userId,
          }).catch(() => false),
          typed ? saveShopifyPostage(admin, user.id, typed.postcode, typed.postage).catch(() => {}) : null,
        ]);
        return json(200, { itemId, url, linked });
      }

      case 'conversations': {
        const auth = await accessTokenFor(admin, user.id);
        const me = await ebayIdentity(admin, user.id);
        const now = new Date();
        const days = body.maxAgeDays;
        const answer = await trading('GetMemberMessages', auth, memberMessagesQuery(days, now));
        // These add to the list and cost the buyers' messages nothing if they fail, so neither fails
        // it. Only a failure's code goes back, for the extension's log.
        const partial = {};
        const extra = (name, call, query) =>
          trading(call, auth, query).catch((e) => {
            partial[name] = e?.code ?? 'failed';
            return null;
          });
        const [answered, inbox] = await Promise.all([
          answersMissing(answer) ? extra('answers', 'GetMemberMessages', answersQuery(days, now)) : null,
          hasUnanswered(answer) ? extra('readState', 'GetMyMessages', inboxHeadersQuery(days, now)) : null,
        ]);
        const merged = withReadState(withAnswers(answer, answered), inbox);
        return json(200, { conversations: conversationsFromResponse(merged, me), partial });
      }

      case 'sendMessage': {
        // Checked first, so a refused reply spends none of the shared daily quota.
        const first = !body.reply?.parentMessageId;
        const xml = first
          ? partnerXml(body.reply, body.text, body.photos)
          : replyXml(body.reply, body.text, body.photos);
        await trading(
          first ? 'AddMemberMessageAAQToPartner' : 'AddMemberMessageRTQ',
          await accessTokenFor(admin, user.id),
          xml,
        );
        return json(200, { ok: true });
      }

      case 'shippingServices': {
        const res = await trading(
          'GeteBayDetails',
          await accessTokenFor(admin, user.id),
          '<DetailName>ShippingServiceDetails</DetailName>',
        );
        return json(200, { services: shippingServicesFromDetails(res) });
      }

      case 'policies': {
        const res = await trading(
          'GetUserPreferences',
          await accessTokenFor(admin, user.id),
          '<ShowSellerProfilePreferences>true</ShowSellerProfilePreferences>',
        );
        return json(200, policiesFromPreferences(res));
      }

      case 'offers': {
        const res = await trading(
          'GetBestOffers',
          await accessTokenFor(admin, user.id),
          '<BestOfferStatus>Active</BestOfferStatus><DetailLevel>ReturnAll</DetailLevel>' +
            '<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>',
        );
        return json(200, { offers: bestOffersFromResponse(res) });
      }

      case 'offerEligible': {
        const auth = await accessTokenFor(admin, user.id);
        const listingIds: string[] = [];
        for (let offset = 0; offset < OFFER_ELIGIBLE_MAX; offset += PAGE_SIZE) {
          const page = await negotiation(auth, `/find_eligible_items?limit=${PAGE_SIZE}&offset=${offset}`);
          listingIds.push(...eligibleIdsFromResponse(page));
          if (!page?.next) break;
        }
        return json(200, { listingIds });
      }

      case 'sendOffer': {
        const built = sendOfferBody(body);
        if (built.error) return json(400, { error: built.error, code: 'bad_request' });
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const gate = await checkFeatureAllowed(userScoped, user.id, 'auto_offer', 'ebay');
        if (!gate.ok) return json(gate.status, gate.body);
        const res = await negotiation(
          await accessTokenFor(admin, user.id),
          '/send_offer_to_interested_buyers',
          built.body,
        );
        return json(200, { sent: res.offers?.length ?? 0 });
      }

      case 'orders': {
        const now = new Date();
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const res = await trading(
          'GetOrders',
          await accessTokenFor(admin, user.id),
          `<CreateTimeFrom>${from.toISOString()}</CreateTimeFrom><CreateTimeTo>${now.toISOString()}</CreateTimeTo>` +
            '<OrderRole>Seller</OrderRole><OrderStatus>Completed</OrderStatus>' +
            '<Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>1</PageNumber></Pagination>',
        );
        return json(200, { orders: openOrdersFromResponse(res) });
      }

      case 'markShipped': {
        const built = markShippedXml(body);
        if (built.error) return json(400, { error: built.error, code: 'bad_request' });
        await trading('CompleteSale', await accessTokenFor(admin, user.id), built.xml);
        return json(200, { ok: true });
      }

      case 'respondOffer': {
        const built = respondOfferXml(body);
        if (built.error) return json(400, { error: built.error, code: 'bad_request' });
        await trading('RespondToBestOffer', await accessTokenFor(admin, user.id), built.xml);
        return json(200, { ok: true });
      }

      case 'relist': {
        if (typeof body.itemId !== 'string') return json(400, { error: 'Missing itemId' });
        const res = await trading(
          listingCall('relist', body.auction),
          await accessTokenFor(admin, user.id),
          `<Item><ItemID>${esc(body.itemId)}</ItemID></Item>`,
        );
        return json(200, { itemId: String(res.ItemID) });
      }

      case 'end': {
        if (typeof body.itemId !== 'string') return json(400, { error: 'Missing itemId' });
        await trading(
          listingCall('end', body.auction),
          await accessTokenFor(admin, user.id),
          `<ItemID>${esc(body.itemId)}</ItemID><EndingReason>NotAvailable</EndingReason>`,
        );
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: `Unknown action: ${String(body?.action)}` });
    }
  } catch (err) {
    if (err instanceof EbayError || err instanceof ShopifyError) {
      console.warn(`[ebay] user=${user.id} action=${body?.action} code=${err.code}`);
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error(`[ebay] user=${user.id} action=${body?.action}`, err instanceof Error ? err.message : err);
    return json(502, { error: 'eBay request failed', code: 'unavailable' });
  }
});
