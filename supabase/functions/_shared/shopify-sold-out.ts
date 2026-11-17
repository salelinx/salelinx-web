// A Shopify variant selling out, seen on the server: shopify-public's inventory_levels/update webhook
// ends the eBay listing linked to it, so it happens with no browser open. The rules are the
// extension's takedown (salelinx-app src/features/linked-sale-takedown.ts, and docs/technical/
// LINKING.md "When a linked listing sells"), for eBay only: Depop and Vinted need the seller's tab,
// so the extension still takes those down when its poll sees the sale.

import { GROUP_KEY_PREFIX, SAFE_LISTING_ID } from './link-groups.ts';
import { variantRowId } from './shopify-app-page.ts';

/** The variants holding an inventory item, with what says whether each has sold out. */
export const SOLD_OUT_QUERY = `query SoldOut($id: ID!) {
  inventoryItem(id: $id) {
    tracked
    variants(first: 10) {
      nodes {
        legacyResourceId
        inventoryQuantity
        product { legacyResourceId status }
      }
    }
  }
}`;

/**
 * The webhook's inventory item as a GraphQL id, or null for anything else. Read from the level's
 * admin_graphql_api_id, a string: the plain inventory_item_id is a JSON number, which loses digits
 * past 2^53 once parsed, and would name another item.
 */
// deno-lint-ignore no-explicit-any
export function inventoryItemGid(payload: any): string | null {
  const level = String(payload?.admin_graphql_api_id ?? '');
  const fromLevel = /^gid:\/\/shopify\/InventoryLevel\/\d+\?(?:.*&)?inventory_item_id=(\d{1,20})(?:&|$)/.exec(level);
  const plain = payload?.inventory_item_id;
  const id =
    fromLevel?.[1] ??
    (typeof plain === 'string' && /^\d{1,20}$/.test(plain)
      ? plain
      : Number.isSafeInteger(plain) && plain > 0
        ? String(plain)
        : null);
  return id ? `gid://shopify/InventoryItem/${id}` : null;
}

/** Stock left at the location that changed means the variant hasn't sold out, whatever the others
 *  hold. Shopify's filter only sends 0 or below (shopify.app.toml); this holds without it. */
// deno-lint-ignore no-explicit-any
export function mightBeSoldOut(payload: any): boolean {
  const available = payload?.available;
  return !(typeof available === 'number' && available > 0);
}

/**
 * The cloud row ids of the item's variants that have sold out: on sale (an active product), stock
 * tracked, none left at any location. What the extension's poll reads as Sold (shopifyRowStatus);
 * a draft or archived product wasn't for sale, so it didn't sell.
 */
// deno-lint-ignore no-explicit-any
export function soldOutRowIds(data: any): string[] {
  const item = data?.inventoryItem;
  if (item?.tracked !== true) return [];
  const nodes = Array.isArray(item.variants?.nodes) ? item.variants.nodes : [];
  return nodes
    .filter(
      // deno-lint-ignore no-explicit-any
      (v: any) =>
        v?.product?.status === 'ACTIVE' &&
        typeof v.inventoryQuantity === 'number' &&
        v.inventoryQuantity <= 0,
    )
    // deno-lint-ignore no-explicit-any
    .map((v: any) => variantRowId(String(v.product.legacyResourceId), String(v.legacyResourceId)))
    .filter((id: string) => /^shopify_\d{1,20}_\d{1,20}$/.test(id));
}

/** A cloud row as the takedown reads it. */
export interface MemberRow {
  id: string;
  platform: string;
  link_id: string | null;
  status: string | null;
  platform_listing_id: string | null;
  restock_enabled: boolean | null;
  restock_quantity: number | null;
}

export const MEMBER_COLUMNS =
  'id, platform, link_id, status, platform_listing_id, restock_enabled, restock_quantity';

/**
 * The PostgREST `or` filter for a row's link group, read as the extension's findLinkedMembers reads
 * it: a group anchored at the row, an old-style partner pointing back at it, and the row's own key
 * (the group's other holders and its anchor, or an old-style partner).
 */
export function groupFilter(rowId: string, linkId: string | null): string | null {
  if (!SAFE_LISTING_ID.test(rowId)) return null;
  const ors = [`link_id.eq.${GROUP_KEY_PREFIX}${rowId}`, `link_id.eq.${rowId}`];
  if (linkId && SAFE_LISTING_ID.test(linkId)) {
    if (linkId.startsWith(GROUP_KEY_PREFIX)) {
      ors.push(`link_id.eq.${linkId}`, `id.eq.${linkId.slice(GROUP_KEY_PREFIX.length)}`);
    } else {
      ors.push(`id.eq.${linkId}`);
    }
  }
  return ors.join(',');
}

/** The group without the row itself, or a deleted member: it keeps its place, as only the seller
 *  unlinks, but has nothing left to act on. */
export function groupMembers(rowId: string, rows: MemberRow[]): MemberRow[] {
  return rows.filter((r) => r.id !== rowId && r.status !== 'deleted');
}

/** The extension's hasStockLeft: a Restocker count above one behind the group (the lower count, if
 *  they disagree) means more are in stock, so every listing stays up. */
export function hasStockLeft(rows: MemberRow[]): boolean {
  const tracked = rows.filter((r) => r.restock_enabled === true && Number(r.restock_quantity) > 0);
  if (tracked.length === 0) return false;
  return Math.min(...tracked.map((r) => Number(r.restock_quantity))) > 1;
}

/** The group's eBay listings to end: live ones, going by the cloud, and never a dev fake. */
export function ebayToEnd(members: MemberRow[]): MemberRow[] {
  return members.filter(
    (m) =>
      m.platform === 'ebay' &&
      m.status === 'active' &&
      !m.id.startsWith('fake_dev_') &&
      /^\d{1,20}$/.test(String(m.platform_listing_id ?? '')),
  );
}

/**
 * What eBay's own word on the listing (GetItem) says to do: one that already ended is left. Unlike
 * the extension's takeDownOne, one showing more than one in stock still ends: Shopify's count is
 * the group's stock (salelinx-app SHOPIFY.md "Linking"), and the app page's List on eBay copies it
 * into the eBay quantity, which no Shopify sale counts down, so more on eBay is that old copy.
 */
export function ebayVerdict(item: { status: string }): 'gone' | 'end' {
  return item.status === 'active' ? 'end' : 'gone';
}
