import type { TierConfig } from "@/lib/types/tiers";

// Maps a usage_counters feature name (singular, e.g. 'crosslist') to the
// tier_limits limit key that caps it (e.g. 'crosslists_per_month'). The two
// naming schemes differ: usage counters are keyed by the action verb, tier
// limits by a pluralized per-period key (see the seed in 002_billing_tiers.sql). A feature
// with no entry here has no numeric cap we can show.
const FEATURE_TO_LIMIT_KEY: Record<string, string> = {
  crosslist: "crosslists_per_month",
  relist: "relists_per_month",
  refresh: "refreshes_per_day",
  follow: "follows_per_day",
  unfollow: "unfollows_per_day",
};

// The cap for a feature under a given tier, or null if unlimited / not
// applicable (null in tier_limits means unlimited; a missing key means the
// feature is not capped for that tier, or we have no mapping for it).
export function capForFeature(
  feature: string,
  tier: TierConfig | null,
): number | null {
  if (!tier) return null;
  const key = FEATURE_TO_LIMIT_KEY[feature];
  if (!key) return null;
  const cap = tier.limits[key];
  return cap ?? null;
}

// Percent of cap consumed (0-100+), or null when there is no finite cap to
// measure against (unlimited or unmapped). Used to sort near-limit users up.
export function percentOfCap(count: number, cap: number | null): number | null {
  if (cap === null || cap <= 0) return null;
  return (count / cap) * 100;
}
