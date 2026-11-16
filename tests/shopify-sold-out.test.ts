import { describe, expect, it } from 'vitest';
import {
  type MemberRow,
  ebayToEnd,
  ebayVerdict,
  groupFilter,
  groupMembers,
  hasStockLeft,
  inventoryItemGid,
  mightBeSoldOut,
  soldOutRowIds,
} from '../supabase/functions/_shared/shopify-sold-out';

const row = (over: Partial<MemberRow>): MemberRow => ({
  id: 'ebay_1',
  platform: 'ebay',
  link_id: 'grp_ebay_1',
  status: 'active',
  platform_listing_id: '1',
  restock_enabled: false,
  restock_quantity: 0,
  ...over,
});

describe("Shopify's inventory webhook", () => {
  it('names the inventory item it is about, with every digit, and nothing else', () => {
    // Shopify's own sample: parsed, the plain id has lost its last digits.
    const sample = JSON.parse(
      '{"inventory_item_id":271878346596884015,"location_id":24826418,"available":0,' +
        '"admin_graphql_api_id":"gid://shopify/InventoryLevel/24826418?inventory_item_id=271878346596884015"}',
    );
    expect(inventoryItemGid(sample)).toBe('gid://shopify/InventoryItem/271878346596884015');
    expect(inventoryItemGid({ inventory_item_id: 43729076 })).toBe(
      'gid://shopify/InventoryItem/43729076',
    );
    expect(inventoryItemGid({ inventory_item_id: 271878346596884015 })).toBeNull();
    expect(inventoryItemGid({ inventory_item_id: '1) { x }' })).toBeNull();
    expect(
      inventoryItemGid({ admin_graphql_api_id: 'gid://shopify/InventoryLevel/1?inventory_item_id=2&x' }),
    ).toBe('gid://shopify/InventoryItem/2');
    expect(inventoryItemGid({ admin_graphql_api_id: 'gid://evil/x?inventory_item_id=2' })).toBeNull();
    expect(inventoryItemGid({})).toBeNull();
  });

  it('skips a location with stock left without asking Shopify', () => {
    expect(mightBeSoldOut({ available: 3 })).toBe(false);
    expect(mightBeSoldOut({ available: 0 })).toBe(true);
    expect(mightBeSoldOut({ available: -1 })).toBe(true);
    expect(mightBeSoldOut({ available: null })).toBe(true);
  });
});

describe('soldOutRowIds', () => {
  const data = (tracked: boolean, nodes: unknown[]) => ({
    inventoryItem: { tracked, variants: { nodes } },
  });
  const variant = (id: string, quantity: number | null, status = 'ACTIVE') => ({
    legacyResourceId: id,
    inventoryQuantity: quantity,
    product: { legacyResourceId: '1', status },
  });

  it('reads a variant on sale with none left at any location as sold out', () => {
    expect(soldOutRowIds(data(true, [variant('11', 0), variant('12', -2)]))).toEqual([
      'shopify_1_11',
      'shopify_1_12',
    ]);
  });

  it('leaves one with stock left, or whose stock is not counted', () => {
    expect(soldOutRowIds(data(true, [variant('11', 2), variant('12', null)]))).toEqual([]);
    expect(soldOutRowIds(data(false, [variant('11', 0)]))).toEqual([]);
  });

  it("leaves a product that wasn't for sale, as the extension reads it", () => {
    for (const status of ['DRAFT', 'ARCHIVED', 'UNLISTED']) {
      expect(soldOutRowIds(data(true, [variant('11', 0, status)]))).toEqual([]);
    }
  });

  it('copes with an item Shopify no longer has', () => {
    expect(soldOutRowIds({ inventoryItem: null })).toEqual([]);
    expect(soldOutRowIds(undefined)).toEqual([]);
  });
});

describe("the sold-out variant's link group", () => {
  it('reads the group as the extension does', () => {
    expect(groupFilter('shopify_1_11', 'grp_ebay_5')).toBe(
      'link_id.eq.grp_shopify_1_11,link_id.eq.shopify_1_11,link_id.eq.grp_ebay_5,id.eq.ebay_5',
    );
    // An old-style pair, pointing either way.
    expect(groupFilter('shopify_1_11', 'ebay_5')).toBe(
      'link_id.eq.grp_shopify_1_11,link_id.eq.shopify_1_11,id.eq.ebay_5',
    );
    expect(groupFilter('shopify_1_11', 'a,b')).toBe(
      'link_id.eq.grp_shopify_1_11,link_id.eq.shopify_1_11',
    );
    expect(groupFilter('x,y', null)).toBeNull();
  });

  it('leaves out the variant itself and deleted members', () => {
    const rows = [
      row({ id: 'shopify_1_11', platform: 'shopify' }),
      row({ id: 'ebay_5' }),
      row({ id: 'depop_9', platform: 'depop', status: 'deleted' }),
    ];
    expect(groupMembers('shopify_1_11', rows).map((r) => r.id)).toEqual(['ebay_5']);
  });

  it('ends only live eBay listings', () => {
    const members = [
      row({ id: 'ebay_5', platform_listing_id: '5' }),
      row({ id: 'ebay_6', platform_listing_id: '6', status: 'hidden' }),
      row({ id: 'depop_9', platform: 'depop' }),
      row({ id: 'fake_dev_1', platform_listing_id: '7' }),
      row({ id: 'ebay_8', platform_listing_id: '8<x>' }),
    ];
    expect(ebayToEnd(members).map((r) => r.id)).toEqual(['ebay_5']);
  });

  it('leaves everything up while a Restocker count says more are in stock', () => {
    expect(hasStockLeft([row({})])).toBe(false);
    expect(hasStockLeft([row({ restock_enabled: true, restock_quantity: 3 })])).toBe(true);
    expect(hasStockLeft([row({ restock_enabled: true, restock_quantity: 1 })])).toBe(false);
    // The lower count, when they disagree.
    expect(
      hasStockLeft([
        row({ restock_enabled: true, restock_quantity: 3 }),
        row({ restock_enabled: true, restock_quantity: 1 }),
      ]),
    ).toBe(false);
  });

  it("goes by eBay's own word, ending a listing whatever quantity it shows", () => {
    expect(ebayVerdict({ status: 'active' })).toBe('end');
    expect(ebayVerdict({ status: 'sold' })).toBe('gone');
    expect(ebayVerdict({ status: 'hidden' })).toBe('gone');
  });
});
