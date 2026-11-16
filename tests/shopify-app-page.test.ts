import { describe, expect, it } from 'vitest';
import {
  type EbayRow,
  ebayLookup,
  ebayPartners,
} from '../supabase/functions/_shared/link-groups';
import {
  ebayState,
  pageProduct,
  productSearchQuery,
} from '../supabase/functions/_shared/shopify-app-page';

describe('productSearchQuery', () => {
  it('matches the start of each word of the title', () => {
    expect(productSearchQuery('nike hoodie')).toBe('title:nike* title:hoodie*');
    expect(productSearchQuery('  Levi’s  501 ')).toBe('title:Levis* title:501*');
  });

  it("can't be turned into a filter or a connective", () => {
    expect(productSearchQuery('status:draft')).toBe('title:statusdraft*');
    expect(productSearchQuery('a OR b')).toBe('title:a* title:OR* title:b*');
    expect(productSearchQuery('(x) "y" \\z')).toBe('title:x* title:y* title:z*');
    expect(productSearchQuery('-hoodie')).toBe('title:hoodie*');
  });

  it('is nothing for nothing typed', () => {
    expect(productSearchQuery('')).toBeNull();
    expect(productSearchQuery('  :: ')).toBeNull();
    expect(productSearchQuery(undefined)).toBeNull();
  });
});

const ebayRow = (id: string, link_id: string | null, status = 'active'): EbayRow => ({
  id,
  link_id,
  status,
  url: `https://www.ebay.co.uk/itm/${id.slice(5)}`,
});

describe('a variant’s eBay listing, read the way the extension links them', () => {
  const shopify = 'shopify_1_11';

  it('finds a member of its group', () => {
    const rows = [{ id: shopify, link_id: 'grp_depop_9' }];
    expect(ebayLookup(rows).linkIds).toContain('grp_depop_9');
    const found = ebayPartners(rows, [ebayRow('ebay_5', 'grp_depop_9')]);
    expect(found.get(shopify)?.id).toBe('ebay_5');
  });

  it("finds the group's anchor, whatever the anchor's own row says", () => {
    const rows = [{ id: shopify, link_id: 'grp_ebay_5' }];
    expect(ebayLookup(rows).ids).toEqual(['ebay_5']);
    expect(ebayPartners(rows, [ebayRow('ebay_5', null)]).get(shopify)?.id).toBe('ebay_5');
  });

  it('finds an old-style partner, pointing either way', () => {
    expect(
      ebayPartners([{ id: shopify, link_id: 'ebay_5' }], [ebayRow('ebay_5', null)]).get(shopify)?.id,
    ).toBe('ebay_5');
    expect(
      ebayPartners([{ id: shopify, link_id: null }], [ebayRow('ebay_5', shopify)]).get(shopify)?.id,
    ).toBe('ebay_5');
  });

  it("ignores another group's listing", () => {
    const rows = [{ id: shopify, link_id: 'grp_depop_9' }];
    expect(ebayPartners(rows, [ebayRow('ebay_5', 'grp_depop_8')]).has(shopify)).toBe(false);
  });

  it('prefers the live listing', () => {
    const rows = [{ id: shopify, link_id: 'grp_depop_9' }];
    const found = ebayPartners(rows, [
      ebayRow('ebay_4', 'grp_depop_9', 'hidden'),
      ebayRow('ebay_5', 'grp_depop_9', 'active'),
    ]);
    expect(found.get(shopify)?.id).toBe('ebay_5');
  });

  it('never puts an unsafe id in a filter', () => {
    const { linkIds, ids } = ebayLookup([{ id: shopify, link_id: 'grp_ebay_5),id.neq.(x' }]);
    expect(linkIds).toEqual([shopify]);
    expect(ids).toEqual([]);
  });
});

describe('pageProduct', () => {
  const node = {
    legacyResourceId: '1',
    title: 'Hoodie',
    status: 'ACTIVE',
    variantsCount: { count: 3 },
    media: { nodes: [{}, { image: { url: 'https://cdn.shopify.com/a.jpg' } }] },
    variants: {
      nodes: [
        { legacyResourceId: '11', title: 'M', price: '20.00', inventoryQuantity: 2, inventoryItem: { tracked: true } },
        { legacyResourceId: '12', title: 'L', price: '22.50', inventoryQuantity: 5, inventoryItem: { tracked: false } },
      ],
    },
  };

  it('gives each variant its row id, price, stock and eBay listing', () => {
    const ebay = new Map([['shopify_1_11', ebayRow('ebay_5', 'grp_ebay_5', 'sold')]]);
    const p = pageProduct(node, ebay)!;
    expect(p).toMatchObject({ productId: '1', image: 'https://cdn.shopify.com/a.jpg', moreVariants: 1 });
    expect(p.variants[0]).toEqual({
      rowId: 'shopify_1_11',
      variantId: '11',
      title: 'M',
      price: 20,
      quantity: 2,
      ebay: { state: 'sold', url: 'https://www.ebay.co.uk/itm/5' },
    });
    expect(p.variants[1]).toMatchObject({ quantity: null, ebay: null });
  });

  it("names no variant on a product with one, and links only to eBay's own pages", () => {
    const single = { ...node, variantsCount: { count: 1 }, variants: { nodes: [{ ...node.variants.nodes[0], title: 'Default Title' }] } };
    const ebay = new Map([['shopify_1_11', { ...ebayRow('ebay_5', null), url: 'https://evil.example/itm/5' }]]);
    const v = pageProduct(single, ebay)!.variants[0];
    expect(v.title).toBeNull();
    expect(v.ebay).toEqual({ state: 'active', url: null });
  });

  it('skips a node without a usable id', () => {
    expect(pageProduct({ legacyResourceId: 'x' })).toBeNull();
  });
});

describe('ebayState', () => {
  it('reads the cloud row status the way the list shows it', () => {
    expect(ebayState('active')).toBe('active');
    expect(ebayState('sold')).toBe('sold');
    expect(ebayState('draft')).toBe('draft');
    expect(ebayState('hidden')).toBe('ended');
    expect(ebayState('deleted')).toBe('ended');
    expect(ebayState(null)).toBe('ended');
  });
});
