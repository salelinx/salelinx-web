// The Shopify functions' helpers (_shared/shopify.ts): the signature checks on
// App Bridge's ID tokens, connect codes and webhooks, and the product mapping.

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const {
  DETAILS_SCOPES,
  PUBLISH_SCOPE,
  SCOPES,
  SOLID_PATTERN,
  canSetDetails,
  categoryDetails,
  detailEntries,
  entryFields,
  entryValues,
  appAdminUrl,
  missingScopes,
  channelMoves,
  connectCode,
  collectionMoves,
  granted,
  isShopDomain,
  maskEmail,
  readConnectCode,
  salesChannels,
  newProduct,
  newProductInput,
  pickTaxonomyCategory,
  taxonomySearchTerms,
  oneOffPlan,
  photoFiles,
  productDetail,
  productEdit,
  productFieldsInput,
  productGid,
  productSummary,
  refusal,
  samePhotos,
  shopIdFromGid,
  textToHtml,
  variantFieldsInput,
  variantGid,
  variantSummary,
  verifyIdToken,
  verifyWebhook,
} = await import('../supabase/functions/_shared/shopify');

const SECRET = 'hush';
const NOW = 1794334871 * 1000;

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** An ID token as App Bridge hands one over: HS256 with the app's secret. */
function idToken(
  claims: Record<string, unknown> = {},
  { secret = SECRET, alg = 'HS256' }: { secret?: string; alg?: string } = {},
) {
  const seconds = NOW / 1000;
  const head = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      iss: 'https://salelinx-test-store.myshopify.com/admin',
      dest: 'https://salelinx-test-store.myshopify.com',
      aud: 'cid',
      sub: '42',
      exp: seconds + 60,
      nbf: seconds - 1,
      iat: seconds - 1,
      jti: 'f8912129-1af6-4cad-9ca3-76b0f7621087',
      sid: 'aaea182f',
      ...claims,
    }),
  );
  const sig = b64url(createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

describe('verifyIdToken', () => {
  it('names the store a good token vouches for', async () => {
    await expect(verifyIdToken(idToken(), 'cid', SECRET, NOW)).resolves.toBe(
      'salelinx-test-store.myshopify.com',
    );
  });

  it('refuses a token signed with another secret, or not HS256', async () => {
    await expect(
      verifyIdToken(idToken({}, { secret: 'other' }), 'cid', SECRET, NOW),
    ).rejects.toMatchObject({ code: 'invalid_session', status: 401 });
    await expect(
      verifyIdToken(idToken({}, { alg: 'none' }), 'cid', SECRET, NOW),
    ).rejects.toMatchObject({ code: 'invalid_session' });
  });

  it('refuses a token past its minute, or not valid yet, past the clock slack', async () => {
    const seconds = NOW / 1000;
    await expect(
      verifyIdToken(idToken({ exp: seconds - 11 }), 'cid', SECRET, NOW),
    ).rejects.toMatchObject({ code: 'invalid_session' });
    await expect(
      verifyIdToken(idToken({ exp: seconds - 5 }), 'cid', SECRET, NOW),
    ).resolves.toBe('salelinx-test-store.myshopify.com');
    await expect(
      verifyIdToken(idToken({ nbf: seconds + 30 }), 'cid', SECRET, NOW),
    ).rejects.toMatchObject({ code: 'invalid_session' });
  });

  it("refuses another app's token and one whose stores don't match", async () => {
    await expect(verifyIdToken(idToken(), 'other-app', SECRET, NOW)).rejects.toMatchObject({
      code: 'invalid_session',
    });
    await expect(
      verifyIdToken(idToken({ dest: 'https://other.myshopify.com' }), 'cid', SECRET, NOW),
    ).rejects.toMatchObject({ code: 'invalid_session' });
    await expect(
      verifyIdToken(
        idToken({ iss: 'https://evil.example.com/admin', dest: 'https://evil.example.com' }),
        'cid',
        SECRET,
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'invalid_session' });
  });

  it('refuses a missing or broken token', async () => {
    for (const bad of [undefined, '', 'a.b', 'a.b.c', `${idToken()}x`]) {
      await expect(verifyIdToken(bad, 'cid', SECRET, NOW)).rejects.toMatchObject({
        code: 'invalid_session',
      });
    }
  });
});

describe('connect codes', () => {
  const store = {
    shopId: '85949972632',
    shopDomain: 'salelinx-test-store.myshopify.com',
    shopName: 'Boutique \u00e9t\u00e9',
  };

  it('names the store it was made for, for an hour', async () => {
    const code = await connectCode(store, SECRET, NOW);
    await expect(readConnectCode(code, SECRET, NOW + 59 * 60_000)).resolves.toEqual(store);
    await expect(readConnectCode(code, SECRET, NOW + 61 * 60_000)).rejects.toMatchObject({
      code: 'expired',
    });
  });

  it('carries the store in a body the website can read', async () => {
    const code = await connectCode(store, SECRET, NOW);
    const body = JSON.parse(Buffer.from(code.split('.')[0], 'base64url').toString('utf8'));
    expect(body).toMatchObject({ s: store.shopId, d: store.shopDomain, n: store.shopName });
  });

  it('refuses a changed body, another secret and a broken code', async () => {
    const code = await connectCode(store, SECRET, NOW);
    const [, sig] = code.split('.');
    const other = b64url(JSON.stringify({ s: '1', d: 'other.myshopify.com', n: null, e: 9e9 }));
    await expect(readConnectCode(`${other}.${sig}`, SECRET, NOW)).rejects.toMatchObject({
      code: 'bad_signature',
    });
    await expect(readConnectCode(code, 'other', NOW)).rejects.toMatchObject({
      code: 'bad_signature',
    });
    for (const bad of [undefined, '', 'abc', `${code}.x`, '.x']) {
      await expect(readConnectCode(bad, SECRET, NOW)).rejects.toMatchObject({
        code: 'bad_request',
      });
    }
  });
});

describe('maskEmail', () => {
  it('keeps the start and the domain', () => {
    expect(maskEmail('seller@example.com')).toBe('se\u2022\u2022\u2022@example.com');
    expect(maskEmail('ab@example.com')).toBe('a\u2022\u2022\u2022@example.com');
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('no-at-sign')).toBeNull();
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

  it('carries the variant the query read, as a row of its own', () => {
    const s = productSummary('test-shop.myshopify.com', {
      ...node,
      variants: {
        nodes: [
          {
            legacyResourceId: '4401',
            title: 'Default Title',
            price: '24.50',
            inventoryQuantity: 2,
            selectedOptions: [{ name: 'Title', value: 'Default Title' }],
            inventoryItem: { tracked: true },
            media: { nodes: [] },
          },
        ],
      },
    });
    expect(s.variantList).toEqual([
      {
        variantId: '4401',
        title: 'Default Title',
        options: [{ name: 'Title', value: 'Default Title' }],
        price: 24.5,
        quantity: 2,
        tracked: true,
        photo: null,
      },
    ]);
    expect(productSummary('test-shop.myshopify.com', node).variantList).toEqual([]);
  });
});

describe('variantSummary', () => {
  it("reads a variant's own price, stock, options and photo", () => {
    expect(
      variantSummary({
        legacyResourceId: '4402',
        title: 'M / Black',
        price: '20.00',
        inventoryQuantity: 3,
        selectedOptions: [
          { name: 'Size', value: 'M' },
          { name: 'Colour', value: 'Black' },
        ],
        inventoryItem: { tracked: true },
        media: { nodes: [{}, { image: { url: 'https://cdn/black.jpg' } }] },
      }),
    ).toEqual({
      variantId: '4402',
      title: 'M / Black',
      options: [
        { name: 'Size', value: 'M' },
        { name: 'Colour', value: 'Black' },
      ],
      price: 20,
      quantity: 3,
      tracked: true,
      photo: 'https://cdn/black.jpg',
    });
  });

  it('has no count for untracked stock, and needs an id', () => {
    const v = variantSummary({ id: 'gid://shopify/ProductVariant/9', inventoryQuantity: 0 });
    expect(v).toMatchObject({ variantId: '9', quantity: null, tracked: false, price: null });
    expect(variantSummary({ title: 'M' })).toBeNull();
  });
});

describe('variantGid', () => {
  it('takes only a numeric id', () => {
    expect(variantGid('4402')).toBe('gid://shopify/ProductVariant/4402');
    expect(() => variantGid('gid://shopify/ProductVariant/4402')).toThrow('Bad variant id');
    expect(() => variantGid(4402)).toThrow('Bad variant id');
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

describe('newProduct', () => {
  const base = { title: ' Denim jacket ', price: 38.499, status: 'DRAFT' };

  it('fills in what was left out, rounds the price and cleans the tags', () => {
    expect(
      newProduct({ ...base, tags: ['Very good', 'Blue, navy', 'Very good', ' '] }),
    ).toEqual({
      title: 'Denim jacket',
      description: '',
      vendor: '',
      productType: '',
      categoryPath: '',
      price: 38.5,
      quantity: 1,
      size: '',
      tags: ['Very good', 'Blue  navy'],
      photos: [],
      status: 'DRAFT',
      fields: {},
    });
  });

  it('takes the rest of the page, less the tags and options it sets itself', () => {
    const p = newProduct({
      ...base,
      fields: {
        compareAtPrice: 50,
        sku: ' DJ-1 ',
        categoryId: null,
        tags: ['x'],
        options: [{ name: 'Size', value: 'M' }],
      },
    });
    expect(p.fields).toEqual({ compareAtPrice: 50, sku: 'DJ-1', categoryId: null });
    expect(() => newProduct({ ...base, fields: { hsCode: '12' } })).toThrow('Bad hsCode');
    expect(() => newProduct({ ...base, fields: 'x' })).toThrow('Bad fields');
  });

  it('refuses what Shopify would, before any call', () => {
    expect(() => newProduct({ ...base, title: ' ' })).toThrow('Bad title');
    expect(() => newProduct({ ...base, price: 0 })).toThrow('Bad price');
    expect(() => newProduct({ ...base, quantity: 0 })).toThrow('Bad quantity');
    expect(() => newProduct({ ...base, status: 'ARCHIVED' })).toThrow('Bad status');
    expect(() => newProduct({ ...base, photos: ['http://x/a.jpg'] })).toThrow('Bad photos');
    expect(() => newProduct({ ...base, tags: 'Good' })).toThrow('Bad tags');
  });
});

describe('newProductInput', () => {
  const product = {
    title: 'Denim jacket',
    description: 'Cropped.\n\nLace panels.',
    vendor: 'Levi',
    productType: 'Jackets',
    categoryPath: 'Women > Outerwear > Jackets',
    price: 38.5,
    quantity: 2,
    size: 'M',
    tags: ['Very good', 'Blue'],
    photos: ['https://cdn/a.jpg'],
    status: 'ACTIVE' as const,
    fields: {},
  };

  it('puts the size in a Size option, with the stock at the location', () => {
    expect(newProductInput(product, 'gid://shopify/Location/1')).toEqual({
      title: 'Denim jacket',
      descriptionHtml: '<p>Cropped.</p><p>Lace panels.</p>',
      vendor: 'Levi',
      productType: 'Jackets',
      status: 'ACTIVE',
      tags: ['Very good', 'Blue'],
      productOptions: [{ name: 'Size', position: 1, values: [{ name: 'M' }] }],
      variants: [
        {
          optionValues: [{ optionName: 'Size', name: 'M' }],
          price: '38.50',
          inventoryItem: { tracked: true },
          inventoryQuantities: [
            { locationId: 'gid://shopify/Location/1', name: 'available', quantity: 2 },
          ],
        },
      ],
      files: [{ originalSource: 'https://cdn/a.jpg', contentType: 'IMAGE' }],
    });
  });

  it("uses Shopify's default variant without a size, and leaves out an empty brand", () => {
    const input = newProductInput({ ...product, size: '', vendor: '' }, 'loc');
    expect(input.productOptions).toEqual([
      { name: 'Title', position: 1, values: [{ name: 'Default Title' }] },
    ]);
    expect(input.variants[0].optionValues).toEqual([
      { optionName: 'Title', name: 'Default Title' },
    ]);
    expect(input).not.toHaveProperty('vendor');
    expect(input).not.toHaveProperty('category');
  });

  it("sets Shopify's own category when one was found", () => {
    expect(newProductInput(product, 'loc', 'gid://shopify/TaxonomyCategory/aa-1-10-2')).toMatchObject({
      category: 'gid://shopify/TaxonomyCategory/aa-1-10-2',
    });
  });

  it('carries the rest of the page onto the product and its variant', () => {
    const input = newProductInput(
      {
        ...product,
        fields: {
          compareAtPrice: 60,
          cost: 12,
          sku: 'DJ-1',
          barcode: '5012345678900',
          continueSelling: true,
          weight: { value: 0.8, unit: 'KILOGRAMS' },
          countryOfOrigin: 'GB',
          seoTitle: 'Levi denim jacket',
          handle: 'levi-denim-jacket',
          collections: ['gid://shopify/Collection/5'],
          categoryId: 'gid://shopify/TaxonomyCategory/aa-1',
        },
      },
      'loc',
      'gid://shopify/TaxonomyCategory/aa-2',
    );
    expect(input).toMatchObject({
      seo: { title: 'Levi denim jacket', description: '' },
      handle: 'levi-denim-jacket',
      collections: ['gid://shopify/Collection/5'],
      // The caller's category, the pick it was given or the match it found.
      category: 'gid://shopify/TaxonomyCategory/aa-2',
    });
    expect(input.variants[0]).toMatchObject({
      compareAtPrice: '60.00',
      inventoryPolicy: 'CONTINUE',
      barcodes: [{ value: '5012345678900' }],
      price: '38.50',
      inventoryItem: {
        tracked: true,
        cost: 12,
        sku: 'DJ-1',
        measurement: { weight: { value: 0.8, unit: 'KILOGRAMS' } },
        countryCodeOfOrigin: 'GB',
      },
    });
  });

  it('holds no stock at the location when tracking is off', () => {
    const input = newProductInput({ ...product, fields: { tracked: false } }, 'loc');
    expect(input.variants[0].inventoryItem).toEqual({ tracked: false });
    expect(input.variants[0]).not.toHaveProperty('inventoryQuantities');
  });
});

describe('the rest of the product page', () => {
  it('checks each field and clears with null', () => {
    expect(
      productEdit({
        compareAtPrice: null,
        cost: 4.567,
        taxable: false,
        weight: { value: 300, unit: 'GRAMS' },
        countryOfOrigin: 'IT',
        hsCode: '620342',
        categoryId: 'gid://shopify/TaxonomyCategory/aa-1-10-2',
        tags: ['Blue', 'Blue', 'a, b'],
        collections: ['gid://shopify/Collection/1', 'gid://shopify/Collection/1'],
        handle: 'blue-jeans',
        options: [{ name: 'Size', value: ' 32 ' }],
      }),
    ).toEqual({
      compareAtPrice: null,
      cost: 4.57,
      taxable: false,
      weight: { value: 300, unit: 'GRAMS' },
      countryOfOrigin: 'IT',
      hsCode: '620342',
      categoryId: 'gid://shopify/TaxonomyCategory/aa-1-10-2',
      tags: ['Blue', 'a  b'],
      collections: ['gid://shopify/Collection/1'],
      handle: 'blue-jeans',
      options: [{ name: 'Size', value: '32' }],
    });
    expect(() => productEdit({ taxable: 'yes' })).toThrow('Bad taxable');
    expect(() => productEdit({ weight: { value: 1, unit: 'STONE' } })).toThrow('Bad weight');
    expect(() => productEdit({ countryOfOrigin: 'gb' })).toThrow('Bad countryOfOrigin');
    expect(() => productEdit({ categoryId: 'aa-1' })).toThrow('Bad categoryId');
    expect(() => productEdit({ collections: ['gid://shopify/Product/1'] })).toThrow(
      'Bad collections',
    );
    expect(() => productEdit({ handle: 'has space' })).toThrow('Bad handle');
    expect(() => productEdit({ options: [{ name: 'Size', value: ' ' }] })).toThrow('Bad options');
  });

  it("makes a variant's changes into its bulk update, inventory item and all", () => {
    expect(
      variantFieldsInput({
        compareAtPrice: null,
        barcode: '',
        tracked: false,
        physical: false,
        weight: null,
        hsCode: '',
        options: [{ name: 'Size', value: 'L' }],
      }),
    ).toEqual({
      compareAtPrice: null,
      barcodes: [],
      optionValues: [{ optionName: 'Size', name: 'L' }],
      inventoryItem: {
        tracked: false,
        requiresShipping: false,
        measurement: { weight: { value: 0, unit: 'KILOGRAMS' } },
        harmonizedSystemCode: null,
      },
    });
    expect(variantFieldsInput({})).toEqual({});
  });

  it("keeps the other search line when one changes, and never sends an empty address", () => {
    expect(
      productFieldsInput({ seoTitle: 'New', handle: '' }, { seoTitle: 'Old', seoDescription: 'D' }),
    ).toEqual({ seo: { title: 'New', description: 'D' } });
    expect(productFieldsInput({ categoryId: null, tags: [] })).toEqual({ category: null, tags: [] });
  });

  it('joins and leaves manual collections only', () => {
    const current = [
      { id: 'a', smart: false },
      { id: 'b', smart: false },
      { id: 's', smart: true },
    ];
    expect(collectionMoves(['b', 'c', 's'], current)).toEqual({ join: ['c'], leave: ['a'] });
    expect(collectionMoves([], current)).toEqual({ join: [], leave: ['a', 'b'] });
  });
});

describe("Shopify's own category", () => {
  it('searches the product type, then the step above it', () => {
    expect(taxonomySearchTerms('Jackets', 'Women > Clothing > Outerwear > Jackets')).toEqual([
      'Jackets',
      'Outerwear',
    ]);
    expect(
      taxonomySearchTerms('T-shirts', 'Men > Tops & t-shirts > T-shirts > Other t-shirts'),
    ).toEqual(['T-shirts', 'Tops & t-shirts']);
    expect(taxonomySearchTerms('', '')).toEqual([]);
  });

  const node = (id: string, fullName: string) => ({
    id,
    fullName,
    name: fullName.split(' > ').pop()!,
  });
  const jackets = [
    node('bomber', 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets > Bomber Jackets'),
    node(
      'baby',
      'Apparel & Accessories > Clothing > Baby & Toddler Clothing > Baby & Toddler Outerwear > Baby & Toddler Coats & Jackets',
    ),
    node('coats', 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets'),
    node('life', 'Sporting Goods > Outdoor Recreation > Boating & Water Sports > Life Jackets'),
  ];

  it('takes the closest fit, not the first result', () => {
    const source = 'Women > Clothing > Outerwear > Jackets Upcycled cropped lace jacket';
    expect(pickTaxonomyCategory(jackets, 'Jackets', source)).toBe('coats');
  });

  it('finds a blouse under Shirts & Tops', () => {
    const nodes = [node('blouses', 'Apparel & Accessories > Clothing > Shirts & Tops > Blouses')];
    expect(pickTaxonomyCategory(nodes, 'Blouses', 'Womenswear > Tops > Blouses Silk blouse')).toBe(
      'blouses',
    );
  });

  it('takes none over a poor fit or an archived one', () => {
    const life = jackets.filter((n) => n.id === 'life');
    expect(pickTaxonomyCategory(life, 'Jackets', 'Women > Outerwear > Jackets')).toBeNull();
    const archived = [{ ...jackets[2], isArchived: true }];
    expect(pickTaxonomyCategory(archived, 'Jackets', 'Women > Outerwear > Jackets')).toBeNull();
  });

  it('goes by the product type alone when the source has no path', () => {
    expect(pickTaxonomyCategory(jackets, 'Jackets', '')).toBe('coats');
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

  it('reads the category, tags and the one variant\'s options for a crosslist out', () => {
    const one = node({
      category: { fullName: 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets' },
      tags: ['Very good', 'Blue'],
    });
    one.variants.nodes[0] = {
      ...one.variants.nodes[0],
      selectedOptions: [{ name: 'Size', value: 'M' }],
    } as never;
    const d = productDetail('s.myshopify.com', one);
    expect(d.category).toBe('Apparel & Accessories > Clothing > Outerwear > Coats & Jackets');
    expect(d.tags).toEqual(['Very good', 'Blue']);
    expect(d.options).toEqual([{ name: 'Size', value: 'M' }]);
    // Several variants: no one variant's options to give.
    const many = productDetail('s.myshopify.com', { ...one, variantsCount: { count: 3 } });
    expect(many.options).toEqual([]);
    expect(productDetail('s.myshopify.com', node()).category).toBeNull();
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
    expect(d.editable).toEqual({
      price: true,
      quantity: true,
      photos: true,
      variant: true,
      tracked: true,
    });
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

  it("is about the variant named on a product with several: its price, stock and options", () => {
    const named = {
      id: 'gid://shopify/ProductVariant/71',
      legacyResourceId: '71',
      title: 'L / Grey',
      price: '22.00',
      inventoryQuantity: 9,
      selectedOptions: [
        { name: 'Size', value: 'L' },
        { name: 'Colour', value: 'Grey' },
      ],
      media: { nodes: [{ image: { url: 'https://cdn/grey.jpg' } }] },
      inventoryItem: {
        id: 'gid://shopify/InventoryItem/710',
        tracked: true,
        inventoryLevels: {
          nodes: [{ location: { id: 'gid://shopify/Location/1' }, quantities: [{ quantity: 4 }] }],
        },
      },
    };
    const d = productDetail(
      's.myshopify.com',
      node({ variantsCount: { count: 3 }, totalInventory: 7, tracksInventory: true }),
      named,
    );
    expect(d.variantId).toBe('gid://shopify/ProductVariant/71');
    expect(d.editable).toEqual({
      price: true,
      quantity: true,
      photos: true,
      variant: true,
      tracked: true,
    });
    // The level, not inventoryQuantity, which lags a change as totalInventory does.
    expect(d.quantity).toBe(4);
    expect(d.variant).toMatchObject({ variantId: '71', quantity: 4, price: 22, photo: 'https://cdn/grey.jpg' });
    expect(d.options).toEqual([
      { name: 'Size', value: 'L' },
      { name: 'Colour', value: 'Grey' },
    ]);
    expect(d.listing.variantList).toEqual([d.variant]);
    // The product's own total stays the product's.
    expect(d.listing.totalInventory).toBe(7);
  });

  it('is about no variant on a product with several and none named', () => {
    const d = productDetail('s', node({ variantsCount: { count: 3 } }));
    expect(d.variant).toBeNull();
    expect(d.listing.variantList).toEqual([]);
    expect(d.editable.variant).toBe(false);
  });

  it("reads the rest of the page: the variant's pricing, stock and shipping, the product's organisation", () => {
    const full = node({
      category: { id: 'gid://shopify/TaxonomyCategory/aa-1', fullName: 'Apparel' },
      tags: ['Blue'],
      handle: 'hat',
      seo: { title: 'A hat', description: null },
      collections: {
        nodes: [
          { id: 'gid://shopify/Collection/1', title: 'Hats', ruleSet: null },
          { id: 'gid://shopify/Collection/2', title: 'New in', ruleSet: { appliedDisjunctively: false } },
        ],
      },
    });
    full.variants.nodes[0] = {
      ...full.variants.nodes[0],
      compareAtPrice: '30.00',
      taxable: false,
      inventoryPolicy: 'CONTINUE',
      barcodes: { nodes: [{ value: '123' }] },
      selectedOptions: [{ name: 'Size', value: 'M' }],
      inventoryItem: {
        ...full.variants.nodes[0].inventoryItem,
        trackedEditable: { locked: true },
        sku: 'H-1',
        unitCost: { amount: '4.5' },
        requiresShipping: false,
        measurement: { weight: { value: 250, unit: 'GRAMS' } },
        countryCodeOfOrigin: 'GB',
        harmonizedSystemCode: '650500',
      },
    } as never;
    const d = productDetail('s', full);
    expect(d.fields).toEqual({
      compareAtPrice: 30,
      cost: 4.5,
      taxable: false,
      sku: 'H-1',
      barcode: '123',
      tracked: true,
      continueSelling: true,
      physical: false,
      weight: 250,
      weightUnit: 'GRAMS',
      countryOfOrigin: 'GB',
      hsCode: '650500',
      category: { id: 'gid://shopify/TaxonomyCategory/aa-1', name: 'Apparel' },
      tags: ['Blue'],
      collections: [
        { id: 'gid://shopify/Collection/1', title: 'Hats', smart: false },
        { id: 'gid://shopify/Collection/2', title: 'New in', smart: true },
      ],
      seoTitle: 'A hat',
      seoDescription: '',
      handle: 'hat',
      options: [{ name: 'Size', value: 'M' }],
      channels: null,
      categoryDetails: null,
    });
    expect(d.editable.tracked).toBe(false);
    // A weight of 0 is Shopify's none.
    expect(productDetail('s', node()).fields.weight).toBeNull();
  });

  it('reads the sales channels only when they were asked for', () => {
    const on = node({
      resourcePublicationsV2: { nodes: [{ publication: { id: 'gid://shopify/Publication/1' } }] },
    });
    expect(productDetail('s', on).fields.channels).toEqual(['gid://shopify/Publication/1']);
    expect(productDetail('s', node({ resourcePublicationsV2: { nodes: [] } })).fields.channels).toEqual(
      [],
    );
    // Not asked (the store hasn't granted write_publications): not "on none".
    expect(productDetail('s', node()).fields.channels).toBeNull();
  });

  it('reads the category details only when they were asked for', () => {
    const v5 = 'gid://shopify/TaxonomyValue/5';
    const asked = node({
      categoryMetafields: {
        nodes: [
          {
            key: 'fabric',
            type: 'list.metaobject_reference',
            references: { nodes: [{ id: 'm1', fields: [{ key: 'taxonomy_reference', value: v5 }] }] },
          },
        ],
      },
    });
    const d = productDetail('s', asked);
    expect(d.fields.categoryDetails).toEqual({ fabric: [v5] });
    expect(d.detailEntries).toEqual({ fabric: { byValue: { [v5]: 'm1' }, other: [] } });
    const not = productDetail('s', node());
    expect(not.fields.categoryDetails).toBeNull();
    expect(not.detailEntries).toBeNull();
  });
});

describe('category details', () => {
  const v = (n: number) => `gid://shopify/TaxonomyValue/${n}`;
  const template = (key: string, name: string) => ({
    namespace: 'shopify',
    key,
    name,
    type: { name: 'list.metaobject_reference' },
  });

  it('asks for both metaobject scopes, and reads only with both', () => {
    expect(SCOPES.split(',')).toEqual(expect.arrayContaining(DETAILS_SCOPES));
    expect(canSetDetails(SCOPES)).toBe(true);
    expect(canSetDetails('write_products,write_metaobjects')).toBe(false);
    expect(canSetDetails(null)).toBe(false);
  });

  it("keys each of a category's details by its template, matched by name", () => {
    const details = categoryDetails(
      [
        { id: 'a1', name: 'Color', values: { nodes: [{ id: v(1), name: 'Black' }] } },
        // Pattern lives in the colour entries: no template, no detail.
        { id: 'a3', name: 'Pattern', values: { nodes: [{ id: v(2874), name: 'Solid' }] } },
        { id: 'a2777', name: 'Fabric', values: { nodes: [{ id: v(16980), name: 'Acrylic' }] } },
        // A generic attribute carries no name or values.
        { id: 'a9' },
      ],
      [template('color-pattern', 'Color'), template('fabric', 'fabric'), { key: 'x', name: 'Other' }],
    );
    expect(details).toEqual([
      { key: 'color-pattern', name: 'Color', values: [{ id: v(1), name: 'Black' }] },
      { key: 'fabric', name: 'Fabric', values: [{ id: v(16980), name: 'Acrylic' }] },
    ]);
  });

  it("gives an extended detail its base attribute's values, under its own name", () => {
    // From the API on 2026-11-13: each category lists the base attribute once, by its base name.
    const attr = (id: number, name: string, value: number) => ({
      id: `gid://shopify/TaxonomyAttribute/${id}`,
      name,
      values: { nodes: [{ id: v(value), name: String(value) }] },
    });
    const color = attr(1, 'Color', 1);
    const values = [{ id: v(1), name: '1' }];
    // Handbags: "Bag closure" is the template "Bag/Case closure".
    expect(categoryDetails([attr(2958, 'Bag closure', 7)], [template('bag-case-closure', 'Bag/Case closure')])).toEqual(
      [{ key: 'bag-case-closure', name: 'Bag/Case closure', values: [{ id: v(7), name: '7' }] }],
    );
    // Watches: no plain Color, three of its own.
    expect(
      categoryDetails(
        [color],
        [template('band-color', 'Band color'), template('case-color', 'Case color'), template('dial-color', 'Dial color')],
      ),
    ).toEqual([
      { key: 'band-color', name: 'Band color', values },
      { key: 'case-color', name: 'Case color', values },
      { key: 'dial-color', name: 'Dial color', values },
    ]);
    // Sunglasses: Color itself first, then the frame's.
    expect(
      categoryDetails(
        [color],
        [template('eyewear-frame-color', 'Eyewear frame color'), template('color-pattern', 'Color')],
      ).map((d) => d.key),
    ).toEqual(['color-pattern', 'eyewear-frame-color']);
  });

  it("reads the values an entry stands for, a colour's included", () => {
    expect(entryValues([{ key: 'label', value: 'Cotton' }, { key: 'taxonomy_reference', value: v(5) }])).toEqual([
      v(5),
    ]);
    expect(
      entryValues([
        { key: 'color_taxonomy_reference', value: JSON.stringify([v(1), v(3)]) },
        { key: 'pattern_taxonomy_reference', value: SOLID_PATTERN },
      ]),
    ).toEqual([v(1), v(3)]);
    expect(entryValues([{ key: 'taxonomy_reference', value: 'not json [' }])).toEqual([
      'not json [',
    ]);
    expect(entryValues(undefined)).toEqual([]);
  });

  it("maps a product's entries to their values, and keeps the rest for the save", () => {
    const entries = detailEntries([
      {
        key: 'fabric',
        type: 'list.metaobject_reference',
        references: {
          nodes: [
            { id: 'm1', fields: [{ key: 'taxonomy_reference', value: v(5) }] },
            // Made by hand in Shopify: no taxonomy value.
            { id: 'm2', fields: [{ key: 'label', value: 'Mystery blend' }] },
          ],
        },
      },
      {
        key: 'color-pattern',
        type: 'list.metaobject_reference',
        references: {
          nodes: [{ id: 'm3', fields: [{ key: 'color_taxonomy_reference', value: `["${v(1)}","${v(3)}"]` }] }],
        },
      },
      { key: 'something', type: 'single_line_text_field', value: 'x' },
    ]);
    expect(entries).toEqual({
      fabric: { byValue: { [v(5)]: 'm1' }, other: ['m2'] },
      'color-pattern': { byValue: {}, other: ['m3'] },
    });
  });

  it("makes an entry as its definition takes it: a colour is a solid swatch", () => {
    const colour = [
      { key: 'label', type: { name: 'single_line_text_field' } },
      { key: 'color_taxonomy_reference', type: { name: 'list.product_taxonomy_value_reference' } },
      { key: 'pattern_taxonomy_reference', type: { name: 'product_taxonomy_value_reference' } },
    ];
    expect(entryFields(colour, { id: v(1), name: 'Black' })).toEqual([
      { key: 'label', value: 'Black' },
      { key: 'color_taxonomy_reference', value: JSON.stringify([v(1)]) },
      { key: 'pattern_taxonomy_reference', value: SOLID_PATTERN },
    ]);
    const fabric = [
      { key: 'label', type: { name: 'single_line_text_field' } },
      { key: 'taxonomy_reference', type: { name: 'product_taxonomy_value_reference' } },
    ];
    expect(entryFields(fabric, { id: v(5), name: 'Cotton' })).toEqual([
      { key: 'label', value: 'Cotton' },
      { key: 'taxonomy_reference', value: v(5) },
    ]);
    expect(entryFields([{ key: 'label' }], { id: v(5), name: 'Cotton' })).toBeNull();
  });

  it('checks the details sent: keys, and taxonomy values only', () => {
    expect(productEdit({ categoryDetails: { fabric: [v(5), v(5)], neckline: [] } }).categoryDetails).toEqual({
      fabric: [v(5)],
      neckline: [],
    });
    expect(() => productEdit({ categoryDetails: { 'Bad Key': [v(5)] } })).toThrow(/categoryDetails/);
    expect(() => productEdit({ categoryDetails: { fabric: ['gid://shopify/Metaobject/1'] } })).toThrow(
      /categoryDetails/,
    );
    expect(() => productEdit({ categoryDetails: [] })).toThrow(/categoryDetails/);
  });
});

describe('sales channels', () => {
  it('asks for write_publications and reads whether a store granted it', () => {
    expect(SCOPES.split(',')).toContain(PUBLISH_SCOPE);
    expect(granted('write_products, write_publications', PUBLISH_SCOPE)).toBe(true);
    expect(granted('write_products,read_publications', PUBLISH_SCOPE)).toBe(false);
    expect(granted(null, PUBLISH_SCOPE)).toBe(false);
  });

  it('names what a store linked before has yet to approve, and where it approves it', () => {
    expect(
      missingScopes('write_products,write_inventory,read_locations,write_publications'),
    ).toEqual(DETAILS_SCOPES);
    expect(missingScopes(SCOPES)).toEqual([]);
    expect(appAdminUrl('a.myshopify.com', 'cid')).toBe('https://a.myshopify.com/admin/apps/cid');
  });

  it("names each channel by its app, the Online Store by its handle, and skips API tokens' storefronts", () => {
    const app = (handle: string | null, title: string) => ({
      catalog: { title: 'Channel Catalog 1 e5ef', apps: { nodes: [{ handle, title }] } },
    });
    expect(
      salesChannels([
        { id: 'gid://shopify/Publication/1', ...app('online_store', 'Online Store') },
        { id: 'gid://shopify/Publication/2', ...app('pos', 'Point of Sale') },
        { id: 'gid://shopify/Publication/3', ...app(null, 'development-token') },
        { id: 'gid://shopify/Publication/4', catalog: null },
      ]),
    ).toEqual([
      { id: 'gid://shopify/Publication/1', name: 'Online Store', onlineStore: true },
      { id: 'gid://shopify/Publication/2', name: 'Point of Sale', onlineStore: false },
    ]);
  });

  it('moves a product onto the channels added and off those taken away', () => {
    expect(channelMoves(['p1', 'p3'], ['p1', 'p2'])).toEqual({ publish: ['p3'], unpublish: ['p2'] });
    expect(channelMoves([], [])).toEqual({ publish: [], unpublish: [] });
  });

  it('checks the channels sent, as the whole set', () => {
    const ok = ['gid://shopify/Publication/1', 'gid://shopify/Publication/1'];
    expect(productEdit({ channels: ok }).channels).toEqual(['gid://shopify/Publication/1']);
    expect(productEdit({ channels: [] }).channels).toEqual([]);
    expect(() => productEdit({ channels: ['gid://shopify/Collection/1'] })).toThrow(/channels/);
    expect(() => productEdit({ channels: 'gid://shopify/Publication/1' })).toThrow(/channels/);
    // A new product keeps them for the create; productSet itself takes none.
    const p = newProduct({
      title: 'Hat',
      price: 5,
      status: 'DRAFT',
      fields: { channels: ['gid://shopify/Publication/1'] },
    });
    expect(p.fields.channels).toEqual(['gid://shopify/Publication/1']);
    expect(newProductInput(p, 'gid://shopify/Location/1')).not.toHaveProperty('channels');
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

  it('takes one off the variant named, and never archives a product with others', () => {
    const d = detail();
    const several = { ...d, listing: { ...d.listing, variants: 3 } };
    expect(oneOffPlan(several).kind).toBe('take');
    // Archiving is the whole product's status: its other variants would go off sale too.
    expect(oneOffPlan({ ...several, tracked: false, stock: null }).kind).toBe('manual');
  });
});
