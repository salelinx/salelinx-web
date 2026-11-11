// Signature checks for the Shopify functions (_shared/shopify.ts). The query
// fixture is the worked example in Shopify's OAuth docs (client secret
// "hush"), so a pass means the message is built the way Shopify builds it.

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const {
  authorizeUrl,
  isShopDomain,
  productGid,
  productSummary,
  queryMessage,
  refusal,
  shopIdFromGid,
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
    media: { nodes: [{ image: { url: 'https://cdn.shopify.com/a.jpg' } }, {}, { image: null }] },
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
