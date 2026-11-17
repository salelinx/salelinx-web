import { describe, expect, it } from 'vitest';
import { shopifyAppAdminUrl } from '@/lib/shopify-app';

describe("the Shopify app's page in a store's admin", () => {
  it("is under the store's address", () => {
    expect(shopifyAppAdminUrl('my-shop.myshopify.com')).toBe(
      'https://my-shop.myshopify.com/admin/apps/1358d2c72523a2584682e156a097d3d1',
    );
  });

  it('is nothing for anything but a store address', () => {
    expect(shopifyAppAdminUrl(null)).toBeNull();
    expect(shopifyAppAdminUrl('')).toBeNull();
    expect(shopifyAppAdminUrl('evil.example.com')).toBeNull();
    expect(shopifyAppAdminUrl('my-shop.myshopify.com/../x')).toBeNull();
  });
});
