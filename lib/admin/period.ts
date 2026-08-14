// Current usage period keys, matching the format the extension writes via
// increment_usage_counter (see docs/ENTITLEMENTS.md):
//
//   monthly features -> 'YYYY-MM'      e.g. '2026-06'
//   daily features   -> 'YYYY-MM-DD'   e.g. '2026-06-03'
//
// Caveat: the extension derives its period key from the USER's local date at
// the moment of the check, while this runs server-side (UTC). For a monitoring
// view that is acceptable; at a day boundary a daily counter may map to the
// adjacent UTC day. We pass BOTH the month and day key to the usage RPCs so the
// monthly and daily features are both covered.

export type CurrentPeriods = {
  month: string; // YYYY-MM
  day: string; // YYYY-MM-DD
};

export function currentPeriodKeys(now: Date): CurrentPeriods {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return {
    month: `${yyyy}-${mm}`,
    day: `${yyyy}-${mm}-${dd}`,
  };
}

// Whether a feature's caps are keyed monthly vs daily, inferred from the
// tier_limits limit keys (see the seed in 002_billing_tiers.sql): *_per_month vs
// *_per_day. Used to pick which period key a usage row should be measured
// against when showing "count / cap".
export function isMonthlyFeature(feature: string): boolean {
  // Known monthly features from the seed: crosslist, relist. Daily: refresh,
  // follow, unfollow. Default to monthly for unknown features (the safer
  // assumption for a longer window).
  return feature === "crosslist" || feature === "relist";
}
