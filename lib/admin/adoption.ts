// Feature adoption math for /admin/usage/features. Pure: no Supabase, no
// Next.js, so tests/adoption.test.ts can exercise it directly and the server
// loader (adoption-data.ts) is a thin fetch-and-fold.
//
// The question this answers is "which features do people actually use", which
// is a different cut of usage_counters from /admin/usage (per user). Two facts
// about the data shape the whole module:
//
// 1. Granularity is the MONTH. The 23 activity counters the extension records
//    (salelinx-app src/entitlements/usage-tracking.ts) are month buckets; only
//    refresh / follow / unfollow are daily. So the window is a run of whole
//    months, and daily rows are folded into their month.
// 2. Counts are actions, not people. One bulk edit of 1,000 listings is one
//    user. Adoption is therefore measured in DISTINCT USERS per feature, with
//    actions and a per-user median as secondary columns.

import {
  EXTENSION_FEATURES,
  extensionFeatureLabel,
} from "@/lib/admin/extension-features";
import {
  HOUR_EPOCH,
  HOUR_KEY_RE,
  HOUR_RETENTION_DAYS,
  EVENTS_EPOCH,
  EVENTS_RETENTION_DAYS,
  USAGE_EPOCH,
  currentPeriodKeys,
  hourKey,
  hourKeysForRange,
  periodKeysForRange,
} from "@/lib/admin/period";
import { WINDOW_PRESETS, usageRangeBounds } from "@/lib/admin/usage-range";
import { usageSource } from "@/lib/admin/usage-sources";
import type { AdminUsageRow, AdminUserRow } from "@/lib/types/admin";
import type { TierConfig } from "@/lib/types/tiers";

// The activity counters only started recording on this day (extension 1.1.5,
// salelinx-app commit a88033a). Earlier months are zero for every counter
// except the five metered verbs, and that zero means "not measured", not
// "nobody used it". The page labels those months.
export const ACTIVITY_COUNTERS_SINCE = "2026-08-26";

// ---------------------------------------------------------------------------
// Month helpers (YYYY-MM strings, UTC, no Date arithmetic surprises)
// ---------------------------------------------------------------------------

const MONTH_RE = /^\d{4}-\d{2}$/;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  const yy = Math.floor(idx / 12);
  const mm = idx - yy * 12 + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

// Inclusive run of months from `from` to `to`; empty when from > to.
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(d).padStart(2, "0")}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function shortMonthLabel(ym: string): string {
  return MONTH_NAMES[Number(ym.slice(5, 7)) - 1];
}

function spanLabel(months: string[]): string {
  if (months.length === 0) return "";
  if (months.length === 1) return monthLabel(months[0]);
  const first = months[0];
  const last = months[months.length - 1];
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${shortMonthLabel(first)} to ${monthLabel(last)}`;
  }
  return `${monthLabel(first)} to ${monthLabel(last)}`;
}

// ---------------------------------------------------------------------------
// Window resolution (URL params -> months to read)
// ---------------------------------------------------------------------------

// Month presets, the trailing-window presets shared with the usage pages
// (WINDOW_PRESETS: 5m ... 72h), and "custom" for a UTC hour range.
export type AdoptionPreset =
  | "1"
  | "3"
  | "6"
  | "all"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "12h"
  | "24h"
  | "48h"
  | "72h"
  | "custom";

// What the window's buckets are:
//   months - runs of YYYY-MM, day rows folded into their month (the original)
//   hours  - a custom range of YYYY-MM-DDTHH hour buckets (migration 016)
//   window - an exact trailing window answered from usage_events (migration
//            017); the fold sees two synthetic buckets, "window" and
//            "compare", and no trend
export type AdoptionKind = "months" | "hours" | "window";

// Who counts as the denominator for "% adoption":
//   active - users with ANY extension counter in the window (default: measures
//            adoption among people who actually ran the extension)
//   paid   - users on a non-free tier with an active or trialing subscription
//   all    - every account
// The numerator is always restricted to the same set, so a percentage can
// never exceed 100.
export type AdoptionBase = "active" | "paid" | "all";

export type AdoptionWindow = {
  preset: AdoptionPreset;
  kind: AdoptionKind;
  base: AdoptionBase;
  // Newest month in the window (YYYY-MM), from ?to=. Only meaningful for the
  // months kind; the other kinds carry the current month so the picker's
  // month input has a value.
  anchor: string;
  // The selected buckets, ascending. Months for the months kind, hour keys
  // for hours, the single synthetic "window" bucket for window. The name is
  // historical; the fold treats these as opaque bucket keys.
  months: string[];
  // The preceding run of equal length, for deltas. Empty when nothing precedes
  // the window (all time, or a window that already starts at the epoch).
  compareMonths: string[];
  // Buckets plotted in the sparklines: for months, the window itself when it
  // is 6+ months, otherwise the last 6 months ending at the anchor; for
  // hours, every hour in the range; for window, nothing (no per-bucket
  // breakdown exists for an events window).
  trendMonths: string[];
  // Display labels aligned with trendMonths (short month names, or hours).
  trendLabels: string[];
  label: string;
  compareLabel: string | null;
  // usage_counters period keys covering every bucket above (month keys plus
  // the day keys the daily verbs live under, or hour keys). Passed to
  // admin_list_usage. Empty for the window kind.
  keys: string[];
  // Window kind only: the timestamps passed to admin_list_usage_events, and
  // the comparison window when there is one.
  events?: {
    since: string;
    until: string;
    compareSince?: string;
    compareUntil?: string;
  };
  // Set when the request had to be clamped to the span that has data.
  note?: string;
};

// '2026-09-08T14' -> '09-08 14:00' (sparkline axis) / '2026-09-08 14:00'.
function hourShort(key: string): string {
  return `${key.slice(5, 10)} ${key.slice(11, 13)}:00`;
}
function hourFull(key: string): string {
  return `${key.slice(0, 10)} ${key.slice(11, 13)}:00`;
}
function windowLengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return "hour";
  return `${minutes / 60} hours`;
}

// Custom UTC hour range, from ?from=YYYY-MM-DDTHH&to=YYYY-MM-DDTHH. Buckets
// are the hour rows written by migration 016; the comparison is the run of
// equal length just before it, dropped when it would reach before the span
// that has hour rows (same rule as the month windows).
function resolveHoursWindow(
  requestedFrom: string,
  requestedTo: string,
  base: AdoptionBase,
  now: Date,
): AdoptionWindow {
  const bounds = usageRangeBounds(now);
  const clamp = (h: string) =>
    h < bounds.hourMin ? bounds.hourMin : h > bounds.hourMax ? bounds.hourMax : h;
  let lo = clamp(requestedFrom);
  let hi = clamp(requestedTo);
  if (lo > hi) [lo, hi] = [hi, lo];
  const months = hourKeysForRange(lo, hi);
  const startMs = Date.parse(`${lo}:00:00Z`);
  const cmpEnd = hourKey(new Date(startMs - 3_600_000));
  const cmpStart = hourKey(new Date(startMs - months.length * 3_600_000));
  const compareMonths =
    cmpStart < bounds.hourMin ? [] : hourKeysForRange(cmpStart, cmpEnd);
  const clamped = requestedFrom < bounds.hourMin || requestedTo < bounds.hourMin;
  const note = clamped
    ? bounds.hourMin === HOUR_EPOCH
      ? `Hourly buckets start at ${hourFull(HOUR_EPOCH)} UTC; earlier hours were dropped from the range.`
      : `Hourly buckets are kept for ${HOUR_RETENTION_DAYS} days; hours before ${hourFull(bounds.hourMin)} UTC were dropped from the range.`
    : undefined;
  return {
    preset: "custom",
    kind: "hours",
    base,
    anchor: currentPeriodKeys(now).month,
    months,
    compareMonths,
    trendMonths: months,
    trendLabels: months.map(hourShort),
    label: `${hourFull(lo)} to ${hourFull(hi)} UTC (hourly)`,
    compareLabel:
      compareMonths.length === 0
        ? null
        : `${hourFull(cmpStart)} to ${hourFull(cmpEnd)} UTC`,
    keys: [...months, ...compareMonths],
    ...(note ? { note } : {}),
  };
}

// Trailing window preset (?range=15m etc.), answered from usage_events. The
// comparison is the window of equal length ending where this one starts,
// dropped when it would reach before the span that has events.
function resolveEventsWindow(
  preset: AdoptionPreset,
  minutes: number,
  presetLabel: string,
  base: AdoptionBase,
  now: Date,
): AdoptionWindow {
  const bounds = usageRangeBounds(now);
  const until = now.toISOString();
  const requestedSince = new Date(now.getTime() - minutes * 60_000).toISOString();
  const clamped = requestedSince < bounds.eventsMin;
  const since = clamped ? bounds.eventsMin : requestedSince;
  const lengthMs = Date.parse(until) - Date.parse(since);
  const compareSince = new Date(Date.parse(since) - lengthMs).toISOString();
  const hasCompare = !clamped && compareSince >= bounds.eventsMin;
  const note = clamped
    ? bounds.eventsMin === EVENTS_EPOCH
      ? `Usage events start at ${EVENTS_EPOCH.slice(0, 10)} ${EVENTS_EPOCH.slice(11, 16)} UTC; the window was cut to begin there.`
      : `Usage events are kept for ${EVENTS_RETENTION_DAYS} days; the window was cut to begin at ${bounds.eventsMin.slice(0, 10)} ${bounds.eventsMin.slice(11, 16)} UTC.`
    : undefined;
  return {
    preset,
    kind: "window",
    base,
    anchor: currentPeriodKeys(now).month,
    months: ["window"],
    compareMonths: hasCompare ? ["compare"] : [],
    trendMonths: [],
    trendLabels: [],
    label: `${presetLabel} (since ${since.slice(11, 16)} UTC)`,
    compareLabel: hasCompare ? `the previous ${windowLengthLabel(minutes)}` : null,
    keys: [],
    events: {
      since,
      until,
      ...(hasCompare ? { compareSince, compareUntil: since } : {}),
    },
    ...(note ? { note } : {}),
  };
}

export function resolveAdoptionWindow(
  sp: {
    months?: string;
    to?: string;
    base?: string;
    range?: string;
    from?: string;
  },
  now: Date = new Date(),
): AdoptionWindow {
  const today = currentPeriodKeys(now);
  const epochMonth = USAGE_EPOCH.slice(0, 7);

  const base: AdoptionBase =
    sp.base === "paid" || sp.base === "all" ? sp.base : "active";

  // ?to= doubles as the month anchor and the end of a custom hour range;
  // its shape decides which.
  if (sp.from && sp.to && HOUR_KEY_RE.test(sp.from) && HOUR_KEY_RE.test(sp.to)) {
    return resolveHoursWindow(sp.from, sp.to, base, now);
  }
  const windowPreset = sp.range ? WINDOW_PRESETS[sp.range] : undefined;
  if (windowPreset && sp.range) {
    return resolveEventsWindow(
      sp.range as AdoptionPreset,
      windowPreset.minutes,
      windowPreset.label,
      base,
      now,
    );
  }

  const preset: AdoptionPreset =
    sp.months === "3" || sp.months === "6" || sp.months === "all"
      ? sp.months
      : "1";

  let anchor = today.month;
  if (sp.to && MONTH_RE.test(sp.to)) {
    anchor =
      sp.to < epochMonth
        ? epochMonth
        : sp.to > today.month
          ? today.month
          : sp.to;
  }

  const clampMonth = (ym: string) => (ym < epochMonth ? epochMonth : ym);

  let months: string[];
  let compareMonths: string[];
  if (preset === "all") {
    months = monthRange(epochMonth, anchor);
    compareMonths = [];
  } else {
    const n = Number(preset);
    months = monthRange(clampMonth(addMonths(anchor, 1 - n)), anchor);
    // Same length again, ending the month before the window starts. Dropped
    // entirely when it would reach past the epoch: a shorter baseline would
    // understate the previous period and make every delta look like growth.
    const cmpEnd = addMonths(months[0], -1);
    const cmpStart = addMonths(cmpEnd, 1 - months.length);
    compareMonths = cmpStart < epochMonth ? [] : monthRange(cmpStart, cmpEnd);
  }

  const trendMonths =
    months.length >= 6
      ? months
      : monthRange(clampMonth(addMonths(anchor, -5)), anchor);

  const earliest = [months[0], compareMonths[0], trendMonths[0]]
    .filter((m): m is string => Boolean(m))
    .sort()[0];
  const to = anchor === today.month ? today.day : lastDayOfMonth(anchor);
  const keys = periodKeysForRange(`${earliest}-01`, to);

  const label =
    preset === "all" ? `All time (${spanLabel(months)})` : spanLabel(months);
  const compareLabel =
    compareMonths.length === 0 ? null : spanLabel(compareMonths);

  return {
    preset,
    kind: "months",
    base,
    anchor,
    months,
    compareMonths,
    trendMonths,
    trendLabels: trendMonths.map(shortMonthLabel),
    label,
    compareLabel,
    keys,
  };
}

// ---------------------------------------------------------------------------
// Which plan a counter needs (display-only eligibility)
// ---------------------------------------------------------------------------

// Maps a usage counter to the tier_limits entry that gates it in the
// extension, so the per-tier matrix can grey out "not on this plan" cells
// instead of showing a misleading 0%. Feature gates come from the extension's
// checkFeature() call sites; limit gates from METERED_DISPLAY (gate.ts). A
// counter with no entry is ungated: any signed-in user can produce it.
export type FeatureGate =
  | { kind: "feature"; key: string }
  | { kind: "limit"; key: string };

const GATES: Record<string, FeatureGate> = {
  crosslist: { kind: "limit", key: "crosslists_per_month" },
  relist: { kind: "limit", key: "relists_per_month" },
  refresh: { kind: "limit", key: "refreshes_per_day" },
  follow: { kind: "limit", key: "follows_per_day" },
  unfollow: { kind: "limit", key: "unfollows_per_day" },
  offer_accept: { kind: "feature", key: "offers" },
  offer_decline: { kind: "feature", key: "offers" },
  offer_counter: { kind: "feature", key: "offers" },
  offer_auto_accept: { kind: "feature", key: "auto_accept_offers" },
  offer_send: { kind: "feature", key: "auto_offer" },
  auto_markdown: { kind: "feature", key: "auto_markdown" },
  chat_reply: { kind: "feature", key: "messages" },
  shipping_label: { kind: "feature", key: "shipping_labels" },
  feedback: { kind: "feature", key: "shipping_labels" },
  restock: { kind: "feature", key: "restocker" },
  shop_design: { kind: "feature", key: "shop_designer" },
  shop_sale: { kind: "feature", key: "shop_designer" },
  cloud_save: { kind: "feature", key: "cloud_sync" },
  cloud_update: { kind: "feature", key: "cloud_sync" },
};

export function gateForCounter(counter: string): FeatureGate | null {
  return GATES[counter] ?? null;
}

// Whether a tier can produce the counter at all. Unknown tiers (no config
// row) are treated as eligible so a bespoke tier never reads as gated.
export function tierCanUse(counter: string, tier: TierConfig | null): boolean {
  const gate = GATES[counter];
  if (!gate || !tier) return true;
  if (gate.kind === "feature") return tier.features[gate.key] === true;
  const cap = tier.limits[gate.key];
  // null = unlimited; a missing key = not applicable; 0 = off.
  return cap === null || (typeof cap === "number" && cap > 0);
}

// Canonical display order for the tier columns. Custom tiers go after.
const TIER_ORDER = ["free", "starter", "pro", "business"];

export function tierSortKey(tierId: string): string {
  const i = TIER_ORDER.indexOf(tierId);
  return i === -1 ? `9${tierId}` : `${i}`;
}

// ---------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------

export type FeatureAdoption = {
  feature: string;
  label: string;
  // Distinct users (within the base) who produced the counter in the window.
  users: number;
  // users / base, 0-100, or null when the base is empty.
  adoption: number | null;
  actions: number;
  // Median actions among the users who used it; null when nobody did.
  medianPerUser: number | null;
  // Distinct users in the comparison window, or null when there is none.
  compareUsers: number | null;
  // Users per trend month, aligned with window.trendMonths.
  trend: number[];
  // Lowest standard tier that can use the feature, or null when ungated.
  minTier: string | null;
};

export type TierCell = {
  users: number;
  adoption: number | null;
  eligible: boolean;
};

export type TierAdoption = {
  tier_id: string;
  // Base users on this tier (the per-tier denominator).
  base: number;
  cells: Record<string, TierCell>;
};

// One active user's activity in the window, for the "top users" ranking.
export type UserActivity = {
  user_id: string;
  tier_id: string;
  // Sum of every extension counter in the window.
  actions: number;
  // Distinct features with at least one action.
  featuresUsed: number;
  // The feature they used most, by actions (label from the roster).
  topFeature: string;
  topFeatureActions: number;
};

export type AdoptionReport = {
  window: AdoptionWindow;
  // Every user active in the window, sorted by actions descending. Not
  // filtered by base: this is "who is using the extension most", and a
  // free-tier power user is exactly the kind of thing worth noticing.
  users: UserActivity[];
  // Distinct users with any extension counter in the window, regardless of
  // base. This is the honest "people who ran the extension" number.
  activeUsers: number;
  compareActiveUsers: number | null;
  // Active users in the window who were also active in the comparison window.
  returningUsers: number | null;
  // Size of the selected denominator.
  baseUsers: number;
  totalActions: number;
  compareTotalActions: number | null;
  featuresUsed: number;
  featuresTotal: number;
  // Per trend month, aligned with window.trendMonths.
  monthlyActiveUsers: number[];
  monthlyActions: number[];
  features: FeatureAdoption[];
  tiers: TierAdoption[];
  // Trend months that predate the activity counters (see
  // ACTIVITY_COUNTERS_SINCE): partially or wholly unmeasured.
  unmeasuredMonths: string[];
};

const PAID_STATUSES = new Set(["active", "trialing"]);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(n: number, base: number): number | null {
  return base === 0 ? null : (n / base) * 100;
}

// Highest active version per tier, for eligibility. Users can be pinned to an
// older version (grandfathering), but for a "can this plan use it" column the
// current definition is the right one to show.
function latestTierConfigs(tiers: TierConfig[]): Map<string, TierConfig> {
  const out = new Map<string, TierConfig>();
  for (const t of tiers) {
    const cur = out.get(t.tier_id);
    if (!cur || t.version > cur.version) out.set(t.tier_id, t);
  }
  return out;
}

export function foldAdoption(input: {
  rows: AdminUsageRow[];
  users: AdminUserRow[];
  tiers: TierConfig[];
  window: AdoptionWindow;
}): AdoptionReport {
  const { rows, users, tiers, window } = input;

  // bucket -> feature -> user -> count. For the months kind, day keys fold
  // into their month; for hours and window the period_key IS the bucket
  // (an hour key, or the synthetic "window" / "compare").
  const byMonth = new Map<string, Map<string, Map<string, number>>>();
  for (const r of rows) {
    if (usageSource(r.feature) !== "extension") continue;
    const month =
      window.kind === "months" ? r.period_key.slice(0, 7) : r.period_key;
    const features =
      byMonth.get(month) ?? new Map<string, Map<string, number>>();
    const perUser = features.get(r.feature) ?? new Map<string, number>();
    perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + r.count);
    features.set(r.feature, perUser);
    byMonth.set(month, features);
  }

  const activeIn = (months: string[]): Set<string> => {
    const s = new Set<string>();
    for (const m of months) {
      for (const perUser of byMonth.get(m)?.values() ?? []) {
        for (const [uid, count] of perUser) if (count > 0) s.add(uid);
      }
    }
    return s;
  };
  const actionsIn = (months: string[]): number => {
    let total = 0;
    for (const m of months) {
      for (const perUser of byMonth.get(m)?.values() ?? []) {
        for (const count of perUser.values()) total += count;
      }
    }
    return total;
  };

  const active = activeIn(window.months);
  const compareActive =
    window.compareMonths.length > 0 ? activeIn(window.compareMonths) : null;

  const tierByUser = new Map<string, string>();
  for (const u of users) tierByUser.set(u.user_id, u.tier_id ?? "free");
  const tierOf = (uid: string) => tierByUser.get(uid) ?? "free";

  // The denominator, and the filter applied to every numerator.
  let baseSet: Set<string>;
  if (window.base === "paid") {
    baseSet = new Set(
      users
        .filter(
          (u) =>
            (u.tier_id ?? "free") !== "free" &&
            u.status !== null &&
            PAID_STATUSES.has(u.status),
        )
        .map((u) => u.user_id),
    );
  } else if (window.base === "all") {
    baseSet = new Set(users.map((u) => u.user_id));
  } else {
    baseSet = active;
  }
  // For the comparison window the "active" base is that window's own active
  // set; fixed bases (paid / all) stay the same set.
  const compareBaseSet =
    window.base === "active" ? (compareActive ?? new Set<string>()) : baseSet;

  const inBase = (uid: string) => baseSet.has(uid);

  // Per (feature, user) totals over a run of months, filtered to a user set.
  const sumFeature = (
    feature: string,
    months: string[],
    filter: (uid: string) => boolean,
  ): Map<string, number> => {
    const out = new Map<string, number>();
    for (const m of months) {
      const perUser = byMonth.get(m)?.get(feature);
      if (!perUser) continue;
      for (const [uid, count] of perUser) {
        if (count > 0 && filter(uid)) {
          out.set(uid, (out.get(uid) ?? 0) + count);
        }
      }
    }
    return out;
  };

  const roster = EXTENSION_FEATURES.map((f) => f.counter);
  // Counters the roster does not know yet still show up, after it.
  const seen = new Set<string>();
  for (const features of byMonth.values()) {
    for (const f of features.keys()) seen.add(f);
  }
  const extra = Array.from(seen)
    .filter((f) => !roster.includes(f))
    .sort();
  const allCounters = [...roster, ...extra];

  const configs = latestTierConfigs(tiers);
  const minTierFor = (counter: string): string | null => {
    if (!gateForCounter(counter)) return null;
    for (const id of TIER_ORDER) {
      const cfg = configs.get(id);
      if (cfg && tierCanUse(counter, cfg)) return id;
    }
    return null;
  };

  const features: FeatureAdoption[] = allCounters.map((counter) => {
    const perUser = sumFeature(counter, window.months, inBase);
    const userCount = perUser.size;
    const actions = Array.from(perUser.values()).reduce((a, b) => a + b, 0);
    const compare =
      compareActive === null
        ? null
        : sumFeature(counter, window.compareMonths, (uid) =>
            compareBaseSet.has(uid),
          ).size;
    const trend = window.trendMonths.map(
      (m) => sumFeature(counter, [m], () => true).size,
    );
    return {
      feature: counter,
      label: extensionFeatureLabel(counter),
      users: userCount,
      adoption: pct(userCount, baseSet.size),
      actions,
      medianPerUser: median(Array.from(perUser.values())),
      compareUsers: compare,
      trend,
      minTier: minTierFor(counter),
    };
  });
  features.sort(
    (a, b) =>
      b.users - a.users ||
      b.actions - a.actions ||
      a.label.localeCompare(b.label),
  );

  // Per-tier matrix over every standard tier (so an empty plan is still a
  // visible column) plus any custom tier that has base users.
  const tierIds = new Set<string>(TIER_ORDER);
  for (const uid of baseSet) tierIds.add(tierOf(uid));
  const baseByTier = new Map<string, number>();
  for (const uid of baseSet) {
    const t = tierOf(uid);
    baseByTier.set(t, (baseByTier.get(t) ?? 0) + 1);
  }
  const tiersOut: TierAdoption[] = Array.from(tierIds)
    .sort((a, b) => tierSortKey(a).localeCompare(tierSortKey(b)))
    .map((tierId) => {
      const cfg = configs.get(tierId) ?? null;
      const base = baseByTier.get(tierId) ?? 0;
      const cells: Record<string, TierCell> = {};
      for (const counter of allCounters) {
        const perUser = sumFeature(
          counter,
          window.months,
          (uid) => inBase(uid) && tierOf(uid) === tierId,
        );
        cells[counter] = {
          users: perUser.size,
          adoption: pct(perUser.size, base),
          eligible: tierCanUse(counter, cfg),
        };
      }
      return { tier_id: tierId, base, cells };
    });

  // Per-user totals over the window, for the top-users ranking.
  const perUserTotals = new Map<
    string,
    { actions: number; byFeature: Map<string, number> }
  >();
  for (const m of window.months) {
    for (const [feature, perUser] of byMonth.get(m) ?? []) {
      for (const [uid, count] of perUser) {
        if (count <= 0) continue;
        const t = perUserTotals.get(uid) ?? {
          actions: 0,
          byFeature: new Map<string, number>(),
        };
        t.actions += count;
        t.byFeature.set(feature, (t.byFeature.get(feature) ?? 0) + count);
        perUserTotals.set(uid, t);
      }
    }
  }
  const usersOut: UserActivity[] = Array.from(perUserTotals, ([uid, t]) => {
    let topFeature = "";
    let topN = 0;
    for (const [f, n] of t.byFeature) {
      if (n > topN) {
        topN = n;
        topFeature = f;
      }
    }
    return {
      user_id: uid,
      tier_id: tierOf(uid),
      actions: t.actions,
      featuresUsed: t.byFeature.size,
      topFeature: extensionFeatureLabel(topFeature),
      topFeatureActions: topN,
    };
  }).sort(
    (a, b) =>
      b.actions - a.actions ||
      b.featuresUsed - a.featuresUsed ||
      a.user_id.localeCompare(b.user_id),
  );

  let returning: number | null = null;
  if (compareActive) {
    returning = 0;
    for (const uid of active) if (compareActive.has(uid)) returning += 1;
  }

  // Only month buckets can predate the activity counters; the hour and
  // event series both started long after them.
  const sinceMonth = ACTIVITY_COUNTERS_SINCE.slice(0, 7);
  const unmeasuredMonths =
    window.kind === "months"
      ? window.trendMonths.filter((m) => m <= sinceMonth)
      : [];

  return {
    window,
    users: usersOut,
    activeUsers: active.size,
    compareActiveUsers: compareActive ? compareActive.size : null,
    returningUsers: returning,
    baseUsers: baseSet.size,
    totalActions: actionsIn(window.months),
    compareTotalActions:
      compareActive === null ? null : actionsIn(window.compareMonths),
    featuresUsed: features.filter((f) => f.users > 0).length,
    featuresTotal: features.length,
    monthlyActiveUsers: window.trendMonths.map((m) => activeIn([m]).size),
    monthlyActions: window.trendMonths.map((m) => actionsIn([m])),
    features,
    tiers: tiersOut,
    unmeasuredMonths,
  };
}

// ---------------------------------------------------------------------------
// Movers: biggest changes in users per feature vs the comparison window
// ---------------------------------------------------------------------------

export type Mover = {
  feature: string;
  label: string;
  users: number;
  compareUsers: number;
  delta: number;
};

// The n largest gains and the n largest drops in distinct users. Empty when
// the window has no comparison. A sudden drop is the earliest sign a feature
// broke; a sudden rise is a release landing.
export function featureMovers(
  features: FeatureAdoption[],
  n = 3,
): { gains: Mover[]; drops: Mover[] } {
  const movers: Mover[] = [];
  for (const f of features) {
    if (f.compareUsers === null) continue;
    const delta = f.users - f.compareUsers;
    if (delta === 0) continue;
    movers.push({
      feature: f.feature,
      label: f.label,
      users: f.users,
      compareUsers: f.compareUsers,
      delta,
    });
  }
  const gains = movers
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.label.localeCompare(b.label))
    .slice(0, n);
  const drops = movers
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.label.localeCompare(b.label))
    .slice(0, n);
  return { gains, drops };
}
