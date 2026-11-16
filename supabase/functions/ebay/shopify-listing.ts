// Listing a Shopify store's product on eBay from the Shopify app's page in the store's admin (the
// website's app/embed/shopify), without the extension. The page has no SaleLinx login, only App
// Bridge's ID token for the store, so the ebay function acts for the account the store is
// connected to, and only through SHOPIFY_PAGE_ACTIONS. These are the parts with no I/O, tested
// under Vitest (tests/shopify-listing.test.ts). See docs/EDGE-FUNCTIONS.md "eBay from Shopify".

/**
 * What the app's page may ask the ebay function for. Never `link` or `consentUrl` (connecting
 * eBay takes the seller's own login, on the website's /ebay/connect) and never the plain `add`,
 * whose listing the caller builds: `shopifyListing` builds it from the store's own product.
 */
export const SHOPIFY_PAGE_ACTIONS = new Set([
  'categories',
  'aspects',
  'conditions',
  'shippingServices',
  'shopifyItem',
  'shopifyListing',
]);

/** One variant with what an eBay listing takes from its product: up to 12 photos, the variant's own first. */
export const SHOPIFY_VARIANT_QUERY = `query ($id: ID!) {
  shop { currencyCode }
  productVariant(id: $id) {
    legacyResourceId
    title
    price
    inventoryQuantity
    inventoryItem { tracked }
    selectedOptions { name value }
    media(first: 1) { nodes { ... on MediaImage { image { url } } } }
    product {
      legacyResourceId
      title
      description
      vendor
      productType
      status
      variantsCount { count }
      media(first: 12) { nodes { ... on MediaImage { image { url } } } }
    }
  }
}`;

export const MAX_EBAY_PHOTOS = 12;

export interface ShopifyItem {
  productId: string;
  variantId: string;
  /** Its row in My Listings and the cloud. */
  rowId: string;
  title: string;
  /** The variant's name ("M / Black"), on a product with several. */
  variantTitle: string | null;
  description: string;
  vendor: string | null;
  productType: string | null;
  /** Shopify's ACTIVE, DRAFT or ARCHIVED. */
  status: string;
  price: number | null;
  /** The store's currency. */
  currency: string | null;
  /** Units available; null when its stock isn't tracked. */
  quantity: number | null;
  options: { name: string; value: string }[];
  photos: string[];
}

// deno-lint-ignore no-explicit-any
const imageUrls = (media: any): string[] =>
  (media?.nodes ?? [])
    .map((m: { image?: { url?: unknown } }) => m?.image?.url)
    .filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('https://'));

/** SHOPIFY_VARIANT_QUERY's answer, or null when the variant isn't that product's. */
// deno-lint-ignore no-explicit-any
export function shopifyItem(data: any, productId: string): ShopifyItem | null {
  const v = data?.productVariant;
  const p = v?.product;
  if (!v || !p || String(p.legacyResourceId) !== productId) return null;
  const variantId = String(v.legacyResourceId ?? '');
  if (!/^\d{1,20}$/.test(variantId)) return null;
  const count = Number(p.variantsCount?.count) || 1;
  const price = Number(v.price);
  const tracked = v.inventoryItem?.tracked === true;
  const quantity = Number(v.inventoryQuantity);
  const photos = [...new Set([...imageUrls(v.media), ...imageUrls(p.media)])].slice(0, MAX_EBAY_PHOTOS);
  return {
    productId,
    variantId,
    rowId: `shopify_${productId}_${variantId}`,
    title: String(p.title ?? ''),
    variantTitle: count > 1 && v.title && v.title !== 'Default Title' ? String(v.title) : null,
    description: String(p.description ?? ''),
    vendor: p.vendor || null,
    productType: p.productType || null,
    status: String(p.status ?? ''),
    price: v.price != null && Number.isFinite(price) ? price : null,
    currency: data?.shop?.currencyCode ?? null,
    quantity: tracked && v.inventoryQuantity != null && Number.isFinite(quantity) ? quantity : null,
    options: (Array.isArray(v.selectedOptions) ? v.selectedOptions : [])
      .filter((o) => typeof o?.name === 'string' && typeof o?.value === 'string')
      .map((o) => ({ name: o.name, value: o.value })),
    photos,
  };
}

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A product's plain-text description as simple eBay HTML: paragraphs, and line breaks inside them. */
export function textToEbayHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * A photo's address for eBay to fetch (the Media API's create_image_from_url): https only, and a
 * Shopify CDN image asked for at 1600px, big enough for eBay's zoom and far under its size cap.
 */
export function ebayPhotoSource(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.hostname === 'cdn.shopify.com' || u.hostname.endsWith('.myshopify.com')) {
    u.searchParams.set('width', '1600');
  }
  return u.toString();
}

const EBAY_HOSTS: Record<string, string> = {
  EBAY_GB: 'www.ebay.co.uk',
  EBAY_US: 'www.ebay.com',
  EBAY_DE: 'www.ebay.de',
  EBAY_FR: 'www.ebay.fr',
  EBAY_IT: 'www.ebay.it',
  EBAY_ES: 'www.ebay.es',
  EBAY_IE: 'www.ebay.ie',
  EBAY_AT: 'www.ebay.at',
  EBAY_NL: 'www.ebay.nl',
  EBAY_AU: 'www.ebay.com.au',
  EBAY_CA: 'www.ebay.ca',
};

export const ebayItemUrl = (marketplace: string, itemId: string): string =>
  `https://${EBAY_HOSTS[marketplace] ?? EBAY_HOSTS.EBAY_GB}/itm/${itemId}`;

export const EBAY_CURRENCY: Record<string, string> = {
  EBAY_GB: 'GBP',
  EBAY_US: 'USD',
  EBAY_DE: 'EUR',
  EBAY_FR: 'EUR',
  EBAY_IT: 'EUR',
  EBAY_ES: 'EUR',
  EBAY_IE: 'EUR',
  EBAY_AT: 'EUR',
  EBAY_NL: 'EUR',
  EBAY_AU: 'AUD',
  EBAY_CA: 'CAD',
};

/** Postage, returns and dispatch as the extension's setup holds it (EbayPostage). */
export interface Postage {
  service: string;
  cost: number;
  dispatchDays: number;
  /** 0 = no returns, as the extension keeps it. */
  returnsDays: number;
  returnsPaidBy: 'Buyer' | 'Seller';
}

/** How a listing is posted and where the item is: the seller's business policies, or postage. */
export interface ListingSetup {
  postcode: string;
  policies?: { shipping: string; returns: string; payment: string };
  postage?: Postage;
}

const RETURN_DAYS = new Set([14, 30, 60]);

/** Postage as typed on the page or saved by the extension, or null when it isn't usable. */
// deno-lint-ignore no-explicit-any
export function postageOf(raw: any): Postage | null {
  if (!raw || typeof raw !== 'object') return null;
  const service = typeof raw.service === 'string' ? raw.service : '';
  const cost = Number(raw.cost);
  if (!/^[A-Za-z0-9_]{1,80}$/.test(service) || !Number.isFinite(cost) || cost < 0 || cost > 10000) {
    return null;
  }
  const dispatch = Number(raw.dispatchDays);
  const returns = Number(raw.returnsDays);
  return {
    service,
    cost: Math.round(cost * 100) / 100,
    dispatchDays: Number.isInteger(dispatch) && dispatch >= 0 && dispatch <= 30 ? dispatch : 2,
    returnsDays: RETURN_DAYS.has(returns) ? returns : 0,
    returnsPaidBy: raw.returnsPaidBy === 'Seller' ? 'Seller' : 'Buyer',
  };
}

export const postcodeOf = (raw: unknown): string | null => {
  const p = typeof raw === 'string' ? raw.trim() : '';
  return p.length >= 2 && p.length <= 20 && /^[A-Za-z0-9 -]+$/.test(p) ? p : null;
};

/**
 * The eBay setup the extension saved for the account (user_settings.preferences.ebayPostage, the
 * extension's EbayListingSetup), when complete: a postcode and either all three business policies
 * or postage typed in SaleLinx.
 */
// deno-lint-ignore no-explicit-any
export function savedSetup(raw: any): ListingSetup | null {
  const postcode = postcodeOf(raw?.postcode);
  if (!postcode) return null;
  const postage = postageOf(raw?.postage);
  if (postage) return { postcode, postage };
  const id = (v: unknown) => (typeof v === 'string' && /^\d{1,20}$/.test(v) ? v : null);
  const [shipping, returns, payment] = [id(raw?.shipping), id(raw?.returns), id(raw?.payment)];
  return shipping && returns && payment ? { postcode, policies: { shipping, returns, payment } } : null;
}

/** The setup to save after a listing posted with postage typed on the page, as the extension keeps it. */
export const setupToSave = (postcode: string, postage: Postage) => ({
  shipping: '',
  returns: '',
  payment: '',
  postcode,
  postage,
});

const SPECIFIC_NAME_MAX = 65;
const SPECIFIC_VALUE_MAX = 65;
const SPECIFICS_MAX = 45;
const VALUES_MAX = 30;

/** Item specifics from the page: names to one or more values, trimmed to eBay's limits. */
// deno-lint-ignore no-explicit-any
export function specificsOf(raw: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [name, value] of Object.entries(raw)) {
    if (Object.keys(out).length >= SPECIFICS_MAX) break;
    const key = name.trim().slice(0, SPECIFIC_NAME_MAX);
    const values = [value]
      .flat()
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim().slice(0, SPECIFIC_VALUE_MAX))
      .filter(Boolean)
      .slice(0, VALUES_MAX);
    if (key && values.length) out[key] = values;
  }
  return out;
}

/** A cloud row's status from Shopify's product status and the variant's stock. */
export function shopifyRowStatus(status: string, quantity: number | null): string {
  if (status === 'DRAFT') return 'draft';
  if (status === 'ARCHIVED') return 'hidden';
  return quantity !== null && quantity <= 0 ? 'sold' : 'active';
}

export const GROUP_KEY_PREFIX = 'grp_';

/**
 * The link a new eBay listing makes with the Shopify variant it came from, as the extension's
 * crosslist link does (src/utils/cloud/link-group-writes.ts joinGroup): the eBay row joins the
 * variant's group, or the two start one keyed by the first id. Null when the variant's row holds
 * an old-style pointer, which only the extension's settle pass rewrites.
 */
export function linkKey(
  shopifyRowId: string,
  shopifyLinkId: string | null,
  ebayRowId: string,
): { key: string; setOnShopify: boolean } | null {
  if (shopifyLinkId) {
    return shopifyLinkId.startsWith(GROUP_KEY_PREFIX)
      ? { key: shopifyLinkId, setOnShopify: false }
      : null;
  }
  const anchor = [shopifyRowId, ebayRowId].sort()[0];
  return { key: `${GROUP_KEY_PREFIX}${anchor}`, setOnShopify: true };
}
