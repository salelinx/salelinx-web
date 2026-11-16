// The Shopify app's page in a store's admin (the website's app/embed/shopify): what its product
// list reads from Shopify and what it answers. shopify-public's /app runs it.

import type { EbayRow } from './link-groups.ts';

/** Products a page of the list holds. */
export const PAGE_PRODUCTS = 20;

/** Variants read with each product: a reseller's product has a few, and more are a later page's. */
export const PAGE_VARIANTS = 20;

// 20 products with a photo and 20 variants each ask about 460 points of the store's bucket, well
// under Shopify's 1,000-point cap on one query. Newest changes first, as in Shopify's own list.
export const PAGE_PRODUCTS_QUERY = `query ($cursor: String, $query: String) {
  shop { currencyCode }
  products(first: ${PAGE_PRODUCTS}, after: $cursor, query: $query, sortKey: UPDATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    nodes {
      legacyResourceId
      title
      status
      variantsCount { count }
      media(first: 1) { nodes { ... on MediaImage { image { url } } } }
      variants(first: ${PAGE_VARIANTS}) {
        nodes {
          legacyResourceId
          title
          price
          inventoryQuantity
          inventoryItem { tracked }
        }
      }
    }
  }
}`;

/**
 * Shopify's search syntax for words typed in the list's search: each must start a word of the
 * title. Characters the syntax gives a meaning to are dropped, so typing can't turn into a filter.
 */
export function productSearchQuery(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const words = text
    .slice(0, 100)
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '').replace(/^[-']+/, ''))
    .filter(Boolean)
    .slice(0, 6);
  return words.length ? words.map((w) => `title:${w}*`).join(' ') : null;
}

/** Where the list says a variant is on eBay: live, sold, an eBay draft, or ended. */
export type EbayState = 'active' | 'sold' | 'draft' | 'ended';

export interface PageVariant {
  /** Its row in My Listings and the cloud: `shopify_<product id>_<variant id>`. */
  rowId: string;
  variantId: string;
  /** Shopify's name for it ("M / Black"); null on a product with one variant. */
  title: string | null;
  price: number | null;
  /** Units available; null when its stock isn't tracked. */
  quantity: number | null;
  ebay: { state: EbayState; url: string | null } | null;
}

export interface PageProduct {
  productId: string;
  title: string;
  status: string;
  image: string | null;
  /** Variants beyond the ones read. */
  moreVariants: number;
  variants: PageVariant[];
}

// An eBay listing's own page, the only kind of address the list links to.
const EBAY_ITEM_URL = /^https:\/\/(www\.)?ebay\.[a-z.]{2,10}\/itm\//;

export function ebayState(status: string | null): EbayState {
  if (status === 'active' || status === 'reserved') return 'active';
  if (status === 'sold' || status === 'draft') return status;
  return 'ended';
}

export const variantRowId = (productId: string, variantId: string): string =>
  `shopify_${productId}_${variantId}`;

/** One product node of PAGE_PRODUCTS_QUERY, with each variant's eBay listing by row id. */
// deno-lint-ignore no-explicit-any
export function pageProduct(p: any, ebay: Map<string, EbayRow> = new Map()): PageProduct | null {
  const productId = String(p?.legacyResourceId ?? '');
  if (!/^\d{1,20}$/.test(productId)) return null;
  const nodes = Array.isArray(p.variants?.nodes) ? p.variants.nodes : [];
  const count = Number(p.variantsCount?.count) || nodes.length;
  const variants: PageVariant[] = [];
  for (const v of nodes) {
    const variantId = String(v?.legacyResourceId ?? '');
    if (!/^\d{1,20}$/.test(variantId)) continue;
    const rowId = variantRowId(productId, variantId);
    const price = Number(v.price);
    const tracked = v.inventoryItem?.tracked === true;
    const quantity = Number(v.inventoryQuantity);
    const linked = ebay.get(rowId);
    variants.push({
      rowId,
      variantId,
      title: count > 1 && v.title && v.title !== 'Default Title' ? String(v.title) : null,
      price: v.price != null && Number.isFinite(price) ? price : null,
      quantity: tracked && v.inventoryQuantity != null && Number.isFinite(quantity) ? quantity : null,
      ebay: linked
        ? {
            state: ebayState(linked.status),
            url: typeof linked.url === 'string' && EBAY_ITEM_URL.test(linked.url) ? linked.url : null,
          }
        : null,
    });
  }
  const image = (p.media?.nodes ?? []).find(
    (m: { image?: { url?: unknown } }) => typeof m?.image?.url === 'string' && m.image.url,
  )?.image.url;
  return {
    productId,
    title: String(p.title ?? ''),
    status: String(p.status ?? ''),
    image: image ?? null,
    moreVariants: Math.max(0, count - variants.length),
    variants,
  };
}
