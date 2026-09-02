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

// A resolved period selection for the usage views: the period keys to query,
// a human label for the header, and whether counts can be measured against
// tier caps. Caps are per-period (per month or per day), so only the
// current-period view can honestly show "count / cap"; a multi-period range
// sums buckets and a percent against a single-period cap would mislead.
export type UsagePeriod = {
  keys: string[];
  label: string;
  capped: boolean;
};

// No usage counter can predate the product's first release; bounds the
// "All time" key generation.
export const USAGE_EPOCH = "2026-04-01";

export function currentUsagePeriod(now: Date): UsagePeriod {
  const { month, day } = currentPeriodKeys(now);
  return { keys: [month, day], label: `${month} / ${day}`, capped: true };
}

// Every period key that can hold usage between two YYYY-MM-DD dates
// (inclusive): one day key per day, plus the month key of every month the
// range touches. Monthly counters only exist as month buckets, so a range that
// partially covers a month necessarily includes that whole month's count for
// them; day-bucketed counters are exact.
export function periodKeysForRange(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  const months = new Set<string>();
  const days: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const { month, day } = currentPeriodKeys(new Date(t));
    months.add(month);
    days.push(day);
  }
  return [...months, ...days];
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
