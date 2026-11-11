// Signature checks for the Shopify functions (_shared/shopify.ts). The query
// fixture is the worked example in Shopify's OAuth docs (client secret
// "hush"), so a pass means the message is built the way Shopify builds it.

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const {
  authorizeUrl,
  isShopDomain,
  oneOffPlan,
  photoFiles,
  productDetail,
  productEdit,
  productGid,
  productSummary,
  queryMessage,
  refusal,
  samePhotos,
  shopIdFromGid,
  textToHtml,
  verifiedShop,
  verifyWebhook,
} = await import('../supabase/functions/_shared/shopify');

const SECRET = 'hush';
const DOCS_QUERY = {
  code: '0907a61c0c8d55e99db179b68161bc00',
  hmac: '700e2dadb827fcc8609e9d5ce208b2e9cdaab9df07390d2cbca10d7c328fc4bf',
  shop: 'some-shop.myshopify.com',
  state: '0.6784241404160823',
  timestamp: '1337178173',
};
const DOCS_NOW = 1337178173 * 1000;

function signed(query: Record<string, string>, secret = SECRET) {
  const hmac = createHmac('sha256', secret).update(queryMessage(query)).digest('hex');
  return { ...query, hmac };
}

describe('queryMessage', () => {
  it('sorts the params and leaves out hmac and signature', () => {
    expect(
      queryMessage({
        timestamp: '1',
        shop: 'a.myshopify.com',
        hmac: 'x',
        signature: 'y',
      }),
    ).toBe('shop=a.myshopify.com&timestamp=1');
  });
});

describe('verifiedShop', () => {
  it("accepts Shopify's documented example", async () => {
    await expect(verifiedShop(DOCS_QUERY, SECRET, DOCS_NOW)).resolves.toBe(
      'some-shop.myshopify.com',
    );
  });

  it('accepts an App URL install redirect', async () => {
    const now = 1794334871 * 1000;
    const query = signed({
      host: 'YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvc2FsZWxpbngtdGVzdC1zdG9yZQ',
      shop: 'salelinx-test-store.myshopify.com',
      timestamp: '1794334871',
    });
    await expect(verifiedShop(query, SECRET, now)).resolves.toBe(
      'salelinx-test-store.myshopify.com',
    );
  });

  it('refuses a changed param', async () => {
    await expect(
      verifiedShop({ ...DOCS_QUERY, shop: 'other-shop.myshopify.com' }, SECRET, DOCS_NOW),
    ).rejects.toMatchObject({ code: 'bad_signature' });
  });

  it('refuses the wrong secret and a missing hmac', async () => {
    await expect(verifiedShop(DOCS_QUERY, 'other', DOCS_NOW)).rejects.toMatchObject({
      code: 'bad_signature',
    });
    const unsigned = Object.fromEntries(Object.entries(DOCS_QUERY).filter(([k]) => k !== 'hmac'));
    await expect(verifiedShop(unsigned, SECRET, DOCS_NOW)).rejects.toMatchObject({
      code: 'bad_signature',
    });
  });

  it('refuses a redirect older than five minutes', async () => {
    await expect(verifiedShop(DOCS_QUERY, SECRET, DOCS_NOW + 6 * 60_000)).rejects.toMatchObject({
      code: 'expired',
    });
  });

  it('refuses a signed address that is not a myshopify.com store', async () => {
    const query = signed({ shop: 'evil.example.com', timestamp: '1337178173' });
    await expect(verifiedShop(query, SECRET, DOCS_NOW)).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('refuses a query that is not flat strings', async () => {
    await expect(
      verifiedShop({ ...DOCS_QUERY, shop: ['a'] }, SECRET, DOCS_NOW),
    ).rejects.toMatchObject({
      code: 'bad_request',
    });
    await expect(verifiedShop(null, SECRET, DOCS_NOW)).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});

describe('verifyWebhook', () => {
  const body = '{"shop_id":954889,"shop_domain":"some-shop.myshopify.com"}';
  const header = createHmac('sha256', SECRET).update(body).digest('base64');

  it('accepts the base64 HMAC of the raw body', async () => {
    expect(await verifyWebhook(body, header, SECRET)).toBe(true);
  });

  it('refuses a changed body, a wrong secret and no header', async () => {
    expect(await verifyWebhook(body.replace('954889', '1'), header, SECRET)).toBe(false);
    expect(await verifyWebhook(body, header, 'other')).toBe(false);
    expect(await verifyWebhook(body, null, SECRET)).toBe(false);
  });
});

describe('helpers', () => {
  it('checks store addresses', () => {
    expect(isShopDomain('salelinx-test-store.myshopify.com')).toBe(true);
    expect(isShopDomain('-bad.myshopify.com')).toBe(false);
    expect(isShopDomain('shop.myshopify.com.evil.com')).toBe(false);
    expect(isShopDomain('shop.myshopify.com/admin')).toBe(false);
  });

  it('builds the consent page for one store', () => {
    const url = new URL(
      authorizeUrl('a.myshopify.com', 'cid', 'https://abc.chromiumapp.org/shopify', 'st'),
    );
    expect(url.origin + url.pathname).toBe('https://a.myshopify.com/admin/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cid',
      scope: 'write_products,write_inventory,read_locations',
      redirect_uri: 'https://abc.chromiumapp.org/shopify',
      state: 'st',
    });
  });

  it('takes the number from a Shop GID', () => {
    expect(shopIdFromGid('gid://shopify/Shop/954889')).toBe('954889');
  });
});

describe('productSummary', () => {
  const node = {
    legacyResourceId: '8812',
    title: 'Denim jacket',
    description: 'Worn twice',
    status: 'ACTIVE',
    onlineStoreUrl: null,
    totalInventory: 0,
    tracksInventory: true,
    vendor: '',
    productType: 'Jackets',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    priceRangeV2: { minVariantPrice: { amount: '24.50', currencyCode: 'GBP' } },
    variantsCount: { count: 1 },
    media: {
      nodes: [{ image: { url: 'https://cdn.shopify.com/a.jpg' } }, {}, { image: null }],
    },
  };

  it('reads the price, stock and photos, and links the product in the admin', () => {
    const s = productSummary('test-shop.myshopify.com', node);
    expect(s).toMatchObject({
      productId: '8812',
      status: 'ACTIVE',
      price: 24.5,
      currency: 'GBP',
      totalInventory: 0,
      tracksInventory: true,
      variants: 1,
      vendor: null,
      productType: 'Jackets',
      url: 'https://test-shop.myshopify.com/admin/products/8812',
      storeUrl: null,
    });
    // A video or 3D model has no image: it is left out.
    expect(s.photos).toEqual(['https://cdn.shopify.com/a.jpg']);
  });

  it('leaves a missing price and stock unknown rather than zero', () => {
    const s = productSummary('test-shop.myshopify.com', {
      ...node,
      priceRangeV2: null,
      totalInventory: null,
    });
    expect(s.price).toBeNull();
    expect(s.totalInventory).toBeNull();
  });
});

describe('product changes', () => {
  it('turns a numeric product id into its GID and refuses anything else', () => {
    expect(productGid('8812')).toBe('gid://shopify/Product/8812');
    for (const bad of ['', 'gid://shopify/Product/1', '12a', 12, null]) {
      expect(() => productGid(bad)).toThrow('Bad product id');
    }
  });

  it("reads Shopify's first refusal, telling a product that is gone from the rest", () => {
    expect(refusal(undefined)).toBeNull();
    expect(refusal([])).toBeNull();
    expect(refusal([{ message: 'Product does not exist' }])?.code).toBe('not_found');
    const other = refusal([{ message: "Title can't be blank" }]);
    expect(other?.code).toBe('shopify');
    expect(other?.message).toBe("Title can't be blank");
  });
});

describe('productEdit', () => {
  it('keeps the fields it knows, rounding the price to pence', () => {
    expect(productEdit({ title: 'Hat', price: 9.999, quantity: 2, other: 1 })).toEqual({
      title: 'Hat',
      price: 10,
      quantity: 2,
    });
  });

  it('refuses a blank title, a bad price or quantity, and photos that are not https', () => {
    expect(() => productEdit({ title: '  ' })).toThrow('Bad title');
    expect(() => productEdit({ price: 0 })).toThrow('Bad price');
    expect(() => productEdit({ quantity: 1.5 })).toThrow('Bad quantity');
    expect(() => productEdit({ photos: ['http://x/a.jpg'] })).toThrow('Bad photos');
    expect(() => productEdit(null)).toThrow('Bad changes');
  });

  it('lets a quantity of 0 through', () => {
    expect(productEdit({ quantity: 0 })).toEqual({ quantity: 0 });
  });
});

describe('textToHtml', () => {
  it('makes a paragraph per block and a line break per line, escaped', () => {
    expect(textToHtml('One <b>\nTwo\r\n\r\nThree & four')).toBe(
      '<p>One &lt;b&gt;<br>Two</p><p>Three &amp; four</p>',
    );
  });

  it('gives nothing for an empty description', () => {
    expect(textToHtml('  \n ')).toBe('');
  });
});

describe('photo sets', () => {
  const media = [
    {
      id: 'gid://shopify/MediaImage/1',
      url: 'https://cdn.shopify.com/a.jpg?v=1',
    },
    {
      id: 'gid://shopify/MediaImage/2',
      url: 'https://cdn.shopify.com/b.jpg?v=2',
    },
  ];

  it('keeps known photos by id, whatever their version, and fetches new ones', () => {
    expect(
      photoFiles(
        [
          'https://cdn.shopify.com/b.jpg?v=9',
          'https://staged.example/new',
          'https://cdn.shopify.com/a.jpg',
        ],
        media,
      ),
    ).toEqual([
      { id: 'gid://shopify/MediaImage/2' },
      { originalSource: 'https://staged.example/new', contentType: 'IMAGE' },
      { id: 'gid://shopify/MediaImage/1' },
    ]);
  });

  it('copies a photo that appears twice rather than using one media id twice', () => {
    const twice = photoFiles([media[0].url, media[0].url], media);
    expect(twice[1]).toEqual({
      originalSource: media[0].url,
      contentType: 'IMAGE',
    });
  });

  it('tells an unchanged set from a reordered one', () => {
    expect(samePhotos([media[0].url, media[1].url], media)).toBe(true);
    expect(samePhotos([media[1].url, media[0].url], media)).toBe(false);
    expect(samePhotos([media[0].url], media)).toBe(false);
  });
});

describe('productDetail', () => {
  const node = (over: Record<string, unknown> = {}) => ({
    legacyResourceId: '7',
    title: 'Hat',
    status: 'ACTIVE',
    variantsCount: { count: 1 },
    variants: {
      nodes: [
        {
          id: 'gid://shopify/ProductVariant/70',
          inventoryItem: {
            id: 'gid://shopify/InventoryItem/700',
            tracked: true,
            inventoryLevels: {
              nodes: [
                {
                  location: { id: 'gid://shopify/Location/1' },
                  quantities: [{ quantity: 3 }],
                },
              ],
            },
          },
        },
      ],
    },
    mediaCount: { count: 1 },
    media: {
      nodes: [
        {
          id: 'gid://shopify/MediaImage/1',
          image: { url: 'https://cdn/a.jpg' },
        },
      ],
    },
    ...over,
  });

  it('takes the stock level as the total, which Shopify updates a moment after a change', () => {
    // Straight after a restock to 1 the product's totalInventory can still say 0, which reads as
    // Sold: the level is what the change wrote.
    const d = productDetail(
      's.myshopify.com',
      node({ status: 'ACTIVE', totalInventory: 0, tracksInventory: true }),
    );
    expect(d.listing.totalInventory).toBe(3);
    const variants = productDetail(
      's.myshopify.com',
      node({ variantsCount: { count: 3 }, totalInventory: 7, tracksInventory: true }),
    );
    expect(variants.listing.totalInventory).toBe(7);
  });

  it('lets the editor set price, stock and photos on a simple product', () => {
    const d = productDetail('s.myshopify.com', node());
    expect(d.editable).toEqual({ price: true, quantity: true, photos: true });
    expect(d.quantity).toBe(3);
    expect(d.stock).toEqual({
      inventoryItemId: 'gid://shopify/InventoryItem/700',
      locationId: 'gid://shopify/Location/1',
      quantity: 3,
    });
  });

  it('leaves price and stock alone on a product with variants', () => {
    const d = productDetail('s.myshopify.com', node({ variantsCount: { count: 3 } }));
    expect(d.editable.price).toBe(false);
    expect(d.editable.quantity).toBe(false);
    expect(d.quantity).toBeNull();
  });

  it('leaves stock alone when untracked or kept at two locations', () => {
    const untracked = node();
    untracked.variants.nodes[0].inventoryItem.tracked = false;
    expect(productDetail('s', untracked).editable.quantity).toBe(false);
    const two = node();
    const levels = two.variants.nodes[0].inventoryItem.inventoryLevels.nodes;
    levels.push({ ...levels[0], location: { id: 'gid://shopify/Location/2' } });
    expect(productDetail('s', two).editable.quantity).toBe(false);
  });

  it('leaves photos alone with a video, a photo still processing, or more than it read', () => {
    const video = node({
      mediaCount: { count: 2 },
      media: {
        nodes: [
          {
            id: 'gid://shopify/MediaImage/1',
            image: { url: 'https://cdn/a.jpg' },
          },
          { id: 'gid://shopify/Video/2' },
        ],
      },
    });
    expect(productDetail('s', video).editable.photos).toBe(false);
    expect(productDetail('s', node({ mediaCount: { count: 60 } })).editable.photos).toBe(false);
  });
});

describe('oneOffPlan', () => {
  const detail = (over: Record<string, unknown> = {}) => ({
    ...productDetail('s', {
      legacyResourceId: '7',
      status: 'ACTIVE',
      variantsCount: { count: 1 },
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/70',
            inventoryItem: {
              id: 'gid://shopify/InventoryItem/700',
              tracked: true,
              inventoryLevels: {
                nodes: [
                  { location: { id: 'gid://shopify/Location/1' }, quantities: [{ quantity: 3 }] },
                ],
              },
            },
          },
        ],
      },
    }),
    ...over,
  });

  it('takes one off a tracked product with one variant', () => {
    expect(oneOffPlan(detail())).toEqual({
      kind: 'take',
      inventoryItemId: 'gid://shopify/InventoryItem/700',
      locationId: 'gid://shopify/Location/1',
      from: 3,
    });
  });

  it('leaves a product that is not for sale, or has none left', () => {
    const d = detail();
    expect(oneOffPlan({ ...d, listing: { ...d.listing, status: 'DRAFT' } }).kind).toBe('gone');
    expect(oneOffPlan({ ...d, stock: { ...d.stock!, quantity: 0 } }).kind).toBe('gone');
  });

  it('archives one whose stock is not tracked', () => {
    expect(oneOffPlan(detail({ tracked: false, stock: null })).kind).toBe('archive');
  });

  it('leaves variants and several locations to the seller', () => {
    expect(oneOffPlan(detail({ variantId: null, tracked: false, stock: null })).kind).toBe(
      'manual',
    );
    expect(oneOffPlan(detail({ stock: null })).kind).toBe('manual');
  });
});
