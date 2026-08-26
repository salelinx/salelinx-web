// Canonical roster of EXTENSION usage counters, in display order. The grouped
// Extension usage page renders every one of these for every user (zero-count
// included) so coverage gaps are visible instead of silently absent.
//
// The first five are the tier-metered verbs (capped via tier_limits, see
// usage-caps.ts). The rest are uncapped activity counters the extension
// records purely so the admin console can see which features get used. Keep
// this list in step with the extension's recordFeatureUse call sites
// (salelinx-app: src/entitlements/usage-tracking.ts).
export const EXTENSION_FEATURES: { counter: string; label: string }[] = [
  { counter: "crosslist", label: "Crosslist" },
  { counter: "relist", label: "Relist" },
  { counter: "refresh", label: "Refresh" },
  { counter: "follow", label: "Follow" },
  { counter: "unfollow", label: "Unfollow" },
  { counter: "offer_accept", label: "Offers accepted" },
  { counter: "offer_decline", label: "Offers declined" },
  { counter: "offer_counter", label: "Offers countered" },
  { counter: "offer_auto_accept", label: "Offers auto-accepted" },
  { counter: "offer_send", label: "Offers sent to likers" },
  { counter: "auto_markdown", label: "Auto-markdowns applied" },
  { counter: "chat_reply", label: "Chat replies sent" },
  { counter: "shipping_label", label: "Shipping labels fetched" },
  { counter: "restock", label: "Restocker reposts" },
  { counter: "feedback", label: "Feedback left" },
  { counter: "shop_design", label: "Shop designs applied" },
  { counter: "shop_sale", label: "Shop sales applied" },
  { counter: "csv_import", label: "CSV imports" },
  { counter: "listing_link", label: "Listings linked" },
  { counter: "listing_edit", label: "Listing edits saved" },
  { counter: "listing_delete", label: "Bulk deletes" },
  { counter: "listing_duplicate", label: "Bulk duplicates" },
  { counter: "listing_publish", label: "Drafts bulk-published" },
  { counter: "relist_sold", label: "Sold items bulk-relisted" },
];

const LABELS: Record<string, string> = Object.fromEntries(
  EXTENSION_FEATURES.map((f) => [f.counter, f.label]),
);

export function extensionFeatureLabel(counter: string): string {
  return LABELS[counter] ?? counter;
}
