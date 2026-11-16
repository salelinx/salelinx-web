// The Shopify app's public details, for the pages that link to it: its page in a store's admin
// (app/embed/shopify/route.ts) and the account page's Manage in Shopify.

/** App Bridge's API key, the app's public client id (shopify/shopify.app.toml). */
export const SHOPIFY_CLIENT_ID = '1358d2c72523a2584682e156a097d3d1';

/** Shopify's own rule for a store's permanent address. */
export const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

/**
 * The app's page in a store's admin, where its plan section manages a plan Shopify bills; null for
 * anything but a store's address.
 */
export const shopifyAppAdminUrl = (shopDomain: string | null | undefined): string | null =>
  shopDomain && SHOP_RE.test(shopDomain)
    ? `https://${shopDomain}/admin/apps/${SHOPIFY_CLIENT_ID}`
    : null;
