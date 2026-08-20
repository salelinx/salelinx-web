// Feature -> endpoint map for the status view on /admin/health and the summary
// on /admin.
//
// Telemetry is keyed by ENDPOINT, because that is what the extension can
// observe: the fetch wrappers see a URL, not the feature that wanted it. A
// status view needs the inverse, so the mapping lives here.
//
// Every entry is scoped to ONE platform. A feature that exists on both is two
// entries, because that is how it actually breaks: Vinted changing its draft
// schema takes out Vinted crosslisting while Depop keeps working, and a single
// merged "Crosslist" card would show that as a partial failure with no way to
// tell which side. The endpoints are disjoint too - a Vinted feature never
// calls a Depop path - so merging them only ever loses information.
//
// This map is hand-maintained and that is a real cost. It is here rather than
// derived because a single endpoint legitimately serves several features
// (/api/v2/my_orders backs both Shipping labels and the Feedback bot), so no
// automatic derivation from call sites would produce a clean answer.
//
// Keys are the NORMALISED forms produced by normalizeEndpointKey in the
// extension (`:id` / `:slug` placeholders, no query string). They must stay in
// sync with it - scripts/check-feature-endpoints.mjs runs from prebuild and
// fails on a pattern that could never match a real key.
//
// A feature with no matching telemetry renders as "no data", never as healthy:
// silence is not evidence of health, and a low-traffic feature such as Labels
// can legitimately go a day without a single call.

export type FeaturePlatform = "depop" | "vinted";

export type FeatureDefinition = {
  key: string;
  label: string;
  platform: FeaturePlatform;
  // Endpoint keys, minus the `platform:` prefix, as `METHOD /path`.
  endpoints: string[];
};

// Ordered roughly by how visible a breakage would be to a user. The UI groups
// by platform, so the two halves do not need to be adjacent here.
export const FEATURE_ENDPOINTS: FeatureDefinition[] = [
  // ── Crosslist ──────────────────────────────────────────────────────────────
  {
    key: "crosslist-vinted",
    label: "Crosslist",
    platform: "vinted",
    endpoints: [
      "POST /api/v2/item_upload/drafts",
      "GET /api/v2/item_upload/drafts/:id",
      "POST /api/v2/item_upload/drafts/:id/completion",
      "POST /api/v2/photos",
      "GET /api/v2/item_upload/colors",
      "GET /api/v2/size_groups",
      "GET /api/v2/search/attributes/brands/byId/",
    ],
  },
  {
    key: "crosslist-depop",
    label: "Crosslist",
    platform: "depop",
    endpoints: [
      "POST /presentation/api/v1/listing/products/",
      "POST /api/v4/pictures/",
      "GET /api/v2/variant-sets/:id/",
      "GET /presentation/api/v1/attributes/categories/size-mapping/",
    ],
  },

  // ── Relist ─────────────────────────────────────────────────────────────────
  {
    key: "relist-vinted",
    label: "Relist",
    platform: "vinted",
    endpoints: [
      "POST /api/v2/items/:id/delete",
      "DELETE /api/v2/item_upload/drafts/:id",
      "GET /api/v2/items/:id/details",
    ],
  },
  {
    key: "relist-depop",
    label: "Relist",
    platform: "depop",
    endpoints: ["DELETE /api/v1/products/:id/", "GET /api/v2/products/:slug/"],
  },

  // ── Refresh (Depop only) ───────────────────────────────────────────────────
  {
    key: "refresh-depop",
    label: "Refresh",
    platform: "depop",
    endpoints: [
      "GET /presentation/api/v1/products/by-slug/:slug/edit-listing/",
      "PUT /api/v2/products/:slug/",
    ],
  },

  // ── Shipping labels ────────────────────────────────────────────────────────
  {
    key: "labels-vinted",
    label: "Shipping labels",
    platform: "vinted",
    endpoints: [
      "GET /api/v2/shipments/:id/label_url",
      "GET /api/v2/shipments/:id/label_options",
      "GET /api/v2/transactions/:id/shipment/digital_label",
      "GET /api/v2/my_orders",
    ],
  },
  {
    key: "labels-depop",
    label: "Shipping labels",
    platform: "depop",
    endpoints: ["GET /api/v1/shipping/label/:id/", "GET /api/v1/receipts/"],
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  {
    key: "messages-vinted",
    label: "Messages",
    platform: "vinted",
    endpoints: ["GET /api/v2/inbox", "GET /api/v2/conversations/:id"],
  },
  {
    key: "messages-depop",
    label: "Messages",
    platform: "depop",
    endpoints: [
      "GET /presentation/api/v1/conversations/",
      "GET /presentation/api/v1/conversations/:id/messages/",
    ],
  },

  // ── Offers ─────────────────────────────────────────────────────────────────
  {
    key: "offers-vinted",
    label: "Offers",
    platform: "vinted",
    endpoints: [
      "GET /api/v2/transactions/:id",
      "PUT /api/v2/transactions/:id/offer_requests/:id/accept",
      "PUT /api/v2/transactions/:id/offer_requests/:id/reject",
      "GET /api/v2/offers/seller/products/:id/offers/:id/",
    ],
  },
  {
    key: "offers-depop",
    label: "Offers",
    platform: "depop",
    endpoints: [
      "GET /api/v4/offers/seller/products/:id/offers/",
      "GET /presentation/api/v1/users/:id/counters/",
    ],
  },

  // ── Follow / unfollow (Vinted only) ────────────────────────────────────────
  {
    key: "follow-vinted",
    label: "Follow / unfollow",
    platform: "vinted",
    endpoints: [
      "GET /api/v2/users/:id/followed_users",
      "POST /api/v2/users/:id/followed_users",
      "GET /api/v2/users/:id/followers",
    ],
  },

  // ── Auto-markdown ──────────────────────────────────────────────────────────
  // Two different mechanisms for the same user-facing feature: Depop has a
  // discounts endpoint, Vinted has none, so a markdown there is a price edit
  // through the normal item-update path (quickEditVinted).
  {
    key: "auto-markdown-depop",
    label: "Auto-markdown",
    platform: "depop",
    // PATCH, not POST or GET. depopSetDiscounts is the only call site and it
    // sends PATCH, so the two forms previously listed here could never match a
    // real telemetry key - Auto-markdown would have read as "no data" forever.
    endpoints: ["PATCH /api/v2/discounts/"],
  },
  {
    key: "auto-markdown-vinted",
    label: "Auto-markdown",
    platform: "vinted",
    endpoints: ["GET /api/v2/item_upload/items/:id"],
  },

  // ── Restocker ──────────────────────────────────────────────────────────────
  {
    key: "restocker-vinted",
    label: "Restocker",
    platform: "vinted",
    endpoints: [
      "GET /api/v2/wardrobe/:id/items",
      "GET /api/v2/item_upload/items/:id",
      "GET /api/v2/items/:id",
    ],
  },
  {
    key: "restocker-depop",
    label: "Restocker",
    platform: "depop",
    endpoints: ["GET /api/v1/shop/products/"],
  },

  // ── My listings ────────────────────────────────────────────────────────────
  {
    key: "listings-vinted",
    label: "My listings",
    platform: "vinted",
    endpoints: ["GET /api/v2/wardrobe/:id/items"],
  },
  {
    key: "listings-depop",
    label: "My listings",
    platform: "depop",
    endpoints: [
      "GET /api/v1/shop/products/",
      "GET /api/v2/drafts/",
      "GET /api/v1/shop/:id/",
    ],
  },

  // ── Feedback bot (Vinted only) ─────────────────────────────────────────────
  {
    key: "feedback-vinted",
    label: "Feedback bot",
    platform: "vinted",
    endpoints: ["GET /api/v2/my_orders", "GET /api/v2/conversations/:id"],
  },

  // ── Account linking ────────────────────────────────────────────────────────
  {
    key: "account-vinted",
    label: "Account linking",
    platform: "vinted",
    endpoints: ["GET /api/v2/users/current"],
  },
  {
    key: "account-depop",
    label: "Account linking",
    platform: "depop",
    endpoints: [
      "GET /presentation/api/v1/users/me/",
      "GET /api/v1/shop/me/",
      "GET /api/v1/shop/:id/",
    ],
  },
];
