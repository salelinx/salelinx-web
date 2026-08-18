// Splits usage_counters rows into the two very different things that table
// holds. Both go through the same increment_usage_counter RPC, so they land in
// one table, but they answer different questions and are capped by different
// mechanisms.
//
// EXTENSION (product metering): the action verbs the extension meters against
// tier_limits (crosslist, relist, refresh, follow, unfollow). The cap comes from
// the user's tier config and is enforced in the extension. Going over is a
// billing/upgrade signal.
//
// WEB (abuse rate limits): per-day counters the website's Edge Functions and
// account UI use to stop one user hammering an expensive or spammable endpoint.
// The cap is a HARDCODED constant in the calling function, not a tier limit, and
// is the same for every tier. Going over means someone hit a safety valve, which
// is an abuse/support signal, not a billing one.
//
// Keeping them on one page made the web counters read as unlimited product
// features (no tier_limits key -> "unlimited" cap, no percent), which is exactly
// backwards: they are the MOST tightly capped counters in the system.

export type UsageSource = "extension" | "web";

// Web-side counters, with the hardcoded daily cap enforced by the caller.
// `limit` is the value the calling code compares against; the check is
// `count > limit`, so `limit` is the last allowed value.
//
// Keep this in step with the call sites - there is no runtime link between
// them, so a cap changed in an Edge Function must be changed here too.
export const WEB_COUNTERS: Record<
  string,
  { label: string; limit: number; period: "day"; where: string }
> = {
  checkout_sessions: {
    label: "Checkout sessions",
    limit: 20,
    period: "day",
    where: "create-checkout-session",
  },
  portal_sessions: {
    label: "Billing portal sessions",
    limit: 20,
    period: "day",
    where: "create-portal-session",
  },
  delete_account_requests: {
    label: "Account deletion requests",
    limit: 5,
    period: "day",
    where: "delete-account",
  },
  shipping_label_emails: {
    label: "Shipping label emails",
    limit: 15,
    period: "day",
    where: "send-shipping-labels",
  },
  email_change_requests: {
    label: "Email change requests",
    limit: 5,
    period: "day",
    where: "AccountSecurityCard",
  },
};

// Anything not registered above is treated as extension product metering, so a
// NEW extension feature shows up on the Extension page automatically. A new WEB
// rate limit must be added to WEB_COUNTERS or it will be misfiled - that is the
// deliberate trade-off (new product features are common, new rate limits are
// rare and always come with a code change here anyway).
export function usageSource(feature: string): UsageSource {
  return feature in WEB_COUNTERS ? "web" : "extension";
}

// Display label for a feature, falling back to the raw counter name.
export function usageLabel(feature: string): string {
  return WEB_COUNTERS[feature]?.label ?? feature;
}

// The hardcoded cap for a web counter, or null if the feature is not one.
export function webCounterLimit(feature: string): number | null {
  return WEB_COUNTERS[feature]?.limit ?? null;
}
