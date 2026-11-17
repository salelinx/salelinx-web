import { describe, expect, it } from 'vitest';
import {
  SHOPIFY_PAGE_ACTIONS,
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
} from '../supabase/functions/ebay/shopify-listing';
import { isShopifyIdToken } from '../supabase/functions/_shared/shopify-app-page';

describe("what the Shopify app's page may ask the ebay function for", () => {
  it('never linking, and never the plain add', () => {
    for (const action of ['link', 'consentUrl', 'add', 'unlink', 'revise', 'end', 'sendMessage']) {
      expect(SHOPIFY_PAGE_ACTIONS.has(action)).toBe(false);
    }
    expect(SHOPIFY_PAGE_ACTIONS.has('shopifyListing')).toBe(true);
  });
});

describe('isShopifyIdToken', () => {
  const jwt = (claims: object) =>
    `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

  it("knows App Bridge's token by the store that issued it", () => {
    expect(isShopifyIdToken(jwt({ iss: 'https://a-b.myshopify.com/admin' }))).toBe(true);
  });

  it('leaves a SaleLinx login and anything else to the usual check', () => {
    expect(isShopifyIdToken(jwt({ iss: 'https://x.supabase.co/auth/v1' }))).toBe(false);
    expect(isShopifyIdToken(jwt({ iss: 'https://evil.com/a.myshopify.com/admin' }))).toBe(false);
    expect(isShopifyIdToken('not.a-token')).toBe(false);
    expect(isShopifyIdToken(undefined)).toBe(false);
  });
});

describe('shopifyItem', () => {
  const data = {
    shop: { currencyCode: 'USD' },
    productVariant: {
      legacyResourceId: '11',
      title: 'M / Black',
      price: '25.00',
      inventoryQuantity: 3,
      inventoryItem: { tracked: true },
      selectedOptions: [
        { name: 'Size', value: 'M' },
        { name: 'Color', value: 'Black' },
      ],
      media: { nodes: [{ image: { url: 'https://cdn.shopify.com/v.jpg' } }] },
      product: {
        legacyResourceId: '1',
        title: 'Hoodie',
        description: 'Warm',
        vendor: 'Nike',
        productType: 'Hoodies',
        category: { name: 'Hoodies & Sweatshirts' },
        status: 'ACTIVE',
        variantsCount: { count: 2 },
        media: {
          nodes: [
            { image: { url: 'https://cdn.shopify.com/a.jpg' } },
            { image: { url: 'https://cdn.shopify.com/v.jpg' } },
            { image: { url: 'http://insecure.example/b.jpg' } },
          ],
        },
      },
    },
  };

  it("reads the variant with its product's details, its own photo first", () => {
    expect(shopifyItem(data, '1')).toEqual({
      productId: '1',
      variantId: '11',
      rowId: 'shopify_1_11',
      title: 'Hoodie',
      variantTitle: 'M / Black',
      description: 'Warm',
      vendor: 'Nike',
      productType: 'Hoodies',
      category: 'Hoodies & Sweatshirts',
      status: 'ACTIVE',
      price: 25,
      currency: 'USD',
      quantity: 3,
      options: [
        { name: 'Size', value: 'M' },
        { name: 'Color', value: 'Black' },
      ],
      photos: ['https://cdn.shopify.com/v.jpg', 'https://cdn.shopify.com/a.jpg'],
    });
  });

  it('reads no category for a product the store never gave one', () => {
    const product = { ...data.productVariant.product, category: null };
    const none = { ...data, productVariant: { ...data.productVariant, product } };
    expect(shopifyItem(none, '1')?.category).toBeNull();
  });

  it("refuses a variant of another product, so the page can't list someone else's", () => {
    expect(shopifyItem(data, '2')).toBeNull();
    expect(shopifyItem({ productVariant: null }, '1')).toBeNull();
  });
});

describe('a listing from the store', () => {
  it('turns the description into simple eBay HTML, escaped', () => {
    expect(textToEbayHtml('One <b>\nTwo\n\n\nThree & four')).toBe(
      '<p>One &lt;b&gt;<br>Two</p><p>Three &amp; four</p>',
    );
  });

  it('asks eBay to fetch photos over https only, from the CDN at 1600px', () => {
    expect(ebayPhotoSource('https://cdn.shopify.com/s/files/a.jpg?v=1')).toBe(
      'https://cdn.shopify.com/s/files/a.jpg?v=1&width=1600',
    );
    expect(ebayPhotoSource('http://cdn.shopify.com/a.jpg')).toBeNull();
    expect(ebayPhotoSource('not a url')).toBeNull();
  });

  it("links to the listing on the account's eBay site", () => {
    expect(ebayItemUrl('EBAY_DE', '12')).toBe('https://www.ebay.de/itm/12');
    expect(ebayItemUrl('EBAY_XX', '12')).toBe('https://www.ebay.co.uk/itm/12');
  });

  it("keeps item specifics within eBay's limits", () => {
    expect(
      specificsOf({ Brand: ' Nike ', Size: ['M', '', 3], Empty: '', ['x'.repeat(70)]: 'v' }),
    ).toEqual({ Brand: ['Nike'], Size: ['M'], ['x'.repeat(65)]: ['v'] });
    expect(specificsOf(['Brand'])).toEqual({});
  });

  it("gives the variant's cloud row the status My Listings would", () => {
    expect(shopifyRowStatus('ACTIVE', 2)).toBe('active');
    expect(shopifyRowStatus('ACTIVE', 0)).toBe('sold');
    expect(shopifyRowStatus('ACTIVE', null)).toBe('active');
    expect(shopifyRowStatus('DRAFT', 2)).toBe('draft');
    expect(shopifyRowStatus('ARCHIVED', 2)).toBe('hidden');
  });
});

describe('postage', () => {
  it('takes typed postage only when eBay could use it', () => {
    expect(postageOf({ service: 'UK_RoyalMailSecondClassStandard', cost: '2.999', returnsDays: 30 })).toEqual({
      service: 'UK_RoyalMailSecondClassStandard',
      cost: 3,
      dispatchDays: 2,
      returnsDays: 30,
      returnsPaidBy: 'Buyer',
    });
    expect(postageOf({ service: 'Bad service!', cost: 2 })).toBeNull();
    expect(postageOf({ service: 'UK_X', cost: -1 })).toBeNull();
    // No returns is 0, as the extension saves it.
    expect(postageOf({ service: 'UK_X', cost: 2, returnsDays: 7 })?.returnsDays).toBe(0);
    expect(postageOf({ service: 'UK_X', cost: 2, returnsDays: null })?.returnsDays).toBe(0);
    expect(postcodeOf(' SW1A 1AA ')).toBe('SW1A 1AA');
    expect(postcodeOf('<x>')).toBeNull();
  });

  it("reads the setup the extension saved, and saves one it can read back", () => {
    expect(savedSetup({ postcode: 'E1', shipping: '1', returns: '2', payment: '3' })).toEqual({
      postcode: 'E1',
      policies: { shipping: '1', returns: '2', payment: '3' },
    });
    expect(savedSetup({ postcode: 'E1', shipping: '1', returns: '', payment: '3' })).toBeNull();
    expect(savedSetup({ shipping: '1', returns: '2', payment: '3' })).toBeNull();
    const postage = postageOf({ service: 'UK_X', cost: 2 })!;
    expect(savedSetup(setupToSave('E1', postage))).toEqual({ postcode: 'E1', postage });
  });
});

describe('linkKey', () => {
  it('starts a group keyed by the first id, as the extension does', () => {
    expect(linkKey('shopify_1_11', null, 'ebay_5')).toEqual({ key: 'grp_ebay_5', setOnShopify: true });
  });

  it("joins the variant's group", () => {
    expect(linkKey('shopify_1_11', 'grp_depop_9', 'ebay_5')).toEqual({
      key: 'grp_depop_9',
      setOnShopify: false,
    });
  });

  it('leaves an old-style link to the extension', () => {
    expect(linkKey('shopify_1_11', 'depop_9', 'ebay_5')).toBeNull();
  });
});
