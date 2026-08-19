// Feature -> endpoint map for the status view on /admin/health.
//
// Telemetry is keyed by ENDPOINT, because that is what the extension can
// observe: the fetch wrappers see a URL, not the feature that wanted it. A
// status view needs the inverse, so the mapping lives here.
//
// This map is hand-maintained and that is a real cost. It is here rather than
// derived because a single endpoint legitimately serves several features
// (/api/v2/my_orders backs both Shipping labels and Messages), so no automatic
// derivation from call sites would produce a clean answer.
//
// Keys are the NORMALISED forms produced by normalizeEndpointKey in the
// extension (`:id` / `:slug` placeholders, no query string). They must stay in
// sync with it - see tests/admin/feature-endpoints.test.ts, which fails if a
// pattern here can never match a real key.
//
// A feature with no matching telemetry renders as "no data", never as healthy:
// silence is not evidence of health, and a low-traffic feature such as Labels
// can legitimately go a day without a single call.

export type FeaturePlatform = "depop" | "vinted" | "both";

export type FeatureDefinition = {
  key: string;
  label: string;
  platform: FeaturePlatform;
  // Endpoint keys, minus the `platform:` prefix, as `METHOD /path`.
  endpoints: string[];
};

// Ordered roughly by how visible a breakage would be to a user.
export const FEATURE_ENDPOINTS: FeatureDefinition[] = [
  {
    key: "crosslist",
    label: "Crosslist",
    platform: "both",
    endpoints: [
      "POST /presentation/api/v1/listing/products/",
      "POST /api/v4/pictures/",
      "POST /api/v2/item_upload/drafts",
      "GET /api/v2/item_upload/drafts/:id",
      "POST /api/v2/item_upload/drafts/:id/completion",
      "POST /api/v2/photos",
      "GET /api/v2/item_upload/colors",
      "GET /api/v2/size_groups",
      "GET /api/v2/variant-sets/:id/",
      "GET /presentation/api/v1/attributes/categories/size-mapping/",
    ],
  },
  {
    key: "relist",
    label: "Relist",
    platform: "both",
    endpoints: [
      "POST /api/v2/items/:id/delete",
      "DELETE /api/v2/item_upload/drafts/:id",
      "DELETE /api/v1/products/:id/",
      "GET /api/v2/items/:id/details",
    ],
  },
  {
    key: "refresh",
    label: "Refresh",
    platform: "depop",
    endpoints: [
      "GET /presentation/api/v1/products/by-slug/:slug/edit-listing/",
      "PUT /api/v2/products/:slug/",
      "GET /api/v2/products/:slug/",
    ],
  },
  {
    key: "labels",
    label: "Shipping labels",
    platform: "both",
    endpoints: [
      "GET /api/v2/shipments/:id/label_url",
      "GET /api/v2/shipments/:id/label_options",
      "GET /api/v2/transactions/:id/shipment/digital_label",
      "GET /api/v1/shipping/label/:id/",
      "GET /api/v2/my_orders",
      "GET /api/v1/receipts/",
    ],
  },
  {
    key: "messages",
    label: "Messages",
    platform: "vinted",
    endpoints: ["GET /api/v2/inbox", "GET /api/v2/conversations/:id"],
  },
  {
    key: "offers",
    label: "Offers",
    platform: "both",
    endpoints: [
      "GET /api/v2/transactions/:id",
      "PUT /api/v2/transactions/:id/offer_requests/:id/accept",
      "PUT /api/v2/transactions/:id/offer_requests/:id/reject",
      "GET /api/v4/offers/seller/products/:id/offers/",
      "GET /api/v2/offers/seller/products/:id/offers/:id/",
    ],
  },
  {
    key: "follow",
    label: "Follow / unfollow",
    platform: "vinted",
    endpoints: [
      "GET /api/v2/users/:id/followed_users",
      "POST /api/v2/users/:id/followed_users",
      "GET /api/v2/users/:id/followers",
    ],
  },
  {
    key: "auto-markdown",
    label: "Auto-markdown",
    platform: "both",
    endpoints: ["POST /api/v2/discounts/", "GET /api/v2/discounts/"],
  },
  {
    key: "restocker",
    label: "Restocker",
    platform: "both",
    endpoints: [
      "GET /api/v1/shop/products/",
      "GET /api/v2/wardrobe/:id/items",
      "GET /api/v2/item_upload/items/:id",
      "GET /api/v2/items/:id",
    ],
  },
  {
    key: "listings",
    label: "My listings",
    platform: "both",
    endpoints: [
      "GET /api/v1/shop/products/",
      "GET /api/v2/drafts/",
      "GET /api/v1/shop/:id/",
      "GET /api/v2/wardrobe/:id/items",
    ],
  },
  {
    key: "feedback",
    label: "Feedback bot",
    platform: "vinted",
    endpoints: ["GET /api/v2/my_orders", "GET /api/v2/conversations/:id"],
  },
  {
    key: "account",
    label: "Account linking",
    platform: "both",
    endpoints: [
      "GET /api/v2/users/current",
      "GET /presentation/api/v1/users/me/",
      "GET /api/v1/shop/me/",
      "GET /api/v1/shop/:id/",
    ],
  },
];
