// Resolves the usage pages' URL params (?range= presets or ?from=&to= custom
// bounds) into a bounded UsagePeriod. Shared by /admin/usage and
// /admin/usage/web so both read the same param scheme. Pure date math, no
// server dependencies, so the client-side users drawer can reuse the key
// generation too.
//
// Two resolutions:
//   day  - from/to are 'YYYY-MM-DD'; keys are the day buckets plus the month
//          bucket of every month touched (monthly counters only exist as month
//          buckets, so a partial month includes the whole month for them).
//          Used by the day presets and still accepted from old links; the
//          picker no longer offers day-shaped custom ranges.
//   hour - from/to are 'YYYY-MM-DDTHH' (UTC); keys are hour buckets ONLY.
//          Exact for every counter, but only as far back as the hour rows
//          exist (HOUR_EPOCH) and are kept (HOUR_RETENTION_DAYS).

import {
  HOUR_EPOCH,
  HOUR_KEY_RE,
  HOUR_RETENTION_DAYS,
  USAGE_EPOCH,
  currentPeriodKeys,
  currentUsagePeriod,
  hourKey,
  hourKeysForRange,
  periodKeysForRange,
} from "@/lib/admin/period";
import type { UsagePeriod } from "@/lib/admin/period";

export type UsageRangePreset =
  | "current"
  | "1h"
  | "2h"
  | "12h"
  | "24h"
  | "48h"
  | "72h"
  | "7d"
  | "30d"
  | "all"
  | "custom";

// "Last N hours" presets, bucket-aligned: the N hour buckets ending with the
// current (partial) hour. "Last hour" at 15:42 is the 15:00 bucket, not
// 14:42 to 15:42; hour buckets are the finest grain that exists, so a preset
// cannot start mid-hour. Anything under an hour is not offered for the same
// reason (it would silently show the whole current hour).
export const HOUR_PRESETS: Record<string, { hours: number; label: string }> =
  {
    "1h": { hours: 1, label: "Last hour" },
    "2h": { hours: 2, label: "Last 2 hours" },
    "12h": { hours: 12, label: "Last 12 hours" },
    "24h": { hours: 24, label: "Last 24 hours" },
    "48h": { hours: 48, label: "Last 48 hours" },
    "72h": { hours: 72, label: "Last 72 hours" },
  };

export type UsageRangeResolution = "day" | "hour";

export type UsageRangeSelection = {
  preset: UsageRangePreset;
  resolution: UsageRangeResolution;
  // Day keys at day resolution, hour keys at hour resolution. Seed the picker.
  from: string;
  to: string;
  period: UsagePeriod;
};

// Bounds the picker can offer, computed from the same clock as the selection
// so the inputs and the clamping agree.
export type UsageRangeBounds = {
  dayMin: string; // USAGE_EPOCH
  dayMax: string; // today
  hourMin: string; // later of HOUR_EPOCH and now minus retention
  hourMax: string; // the current hour
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function usageToday(): string {
  return currentPeriodKeys(new Date()).day;
}

export function usageRangeBounds(now = new Date()): UsageRangeBounds {
  const retentionFloor = hourKey(
    new Date(now.getTime() - HOUR_RETENTION_DAYS * 86_400_000),
  );
  return {
    dayMin: USAGE_EPOCH,
    dayMax: currentPeriodKeys(now).day,
    hourMin: retentionFloor > HOUR_EPOCH ? retentionFloor : HOUR_EPOCH,
    hourMax: hourKey(now),
  };
}

// '2026-09-08T14' -> '2026-09-08 14:00' for labels.
function hourLabel(key: string): string {
  return `${key.slice(0, 10)} ${key.slice(11, 13)}:00`;
}

export function resolveUsageRange(
  sp: { range?: string; from?: string; to?: string },
  now = new Date(),
): UsageRangeSelection {
  const bounds = usageRangeBounds(now);
  const clampDay = (d: string) =>
    d < bounds.dayMin ? bounds.dayMin : d > bounds.dayMax ? bounds.dayMax : d;
  const clampHour = (h: string) =>
    h < bounds.hourMin ? bounds.hourMin : h > bounds.hourMax ? bounds.hourMax : h;
  const dayAgo = (n: number) =>
    clampDay(currentPeriodKeys(new Date(now.getTime() - n * 86_400_000)).day);

  const dayPeriod = (
    preset: UsageRangePreset,
    from: string,
    to: string,
    label: string,
  ): UsageRangeSelection => ({
    preset,
    resolution: "day",
    from,
    to,
    period: { keys: periodKeysForRange(from, to), label, capped: false },
  });

  // Hour ranges are clamped to the window that actually has hour rows. When
  // the clamp moved the start, say so: a silent clamp would read as "no
  // activity" for the hours that were cut off.
  const hourPeriod = (
    preset: UsageRangePreset,
    requestedFrom: string,
    requestedTo: string,
    label: string,
  ): UsageRangeSelection => {
    let from = clampHour(requestedFrom);
    let to = clampHour(requestedTo);
    if (from > to) [from, to] = [to, from];
    const clamped = requestedFrom < bounds.hourMin || requestedTo < bounds.hourMin;
    const note = clamped
      ? bounds.hourMin === HOUR_EPOCH
        ? `Hourly buckets start at ${hourLabel(HOUR_EPOCH)} UTC; earlier hours were dropped from the range.`
        : `Hourly buckets are kept for ${HOUR_RETENTION_DAYS} days; hours before ${hourLabel(bounds.hourMin)} UTC were dropped from the range.`
      : undefined;
    return {
      preset,
      resolution: "hour",
      from,
      to,
      period: {
        keys: hourKeysForRange(from, to),
        label,
        capped: false,
        ...(note ? { note } : {}),
      },
    };
  };

  if (sp.from && sp.to && HOUR_KEY_RE.test(sp.from) && HOUR_KEY_RE.test(sp.to)) {
    const [lo, hi] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return hourPeriod(
      "custom",
      lo,
      hi,
      `${hourLabel(lo)} to ${hourLabel(hi)} UTC (hourly)`,
    );
  }

  if (sp.from && sp.to && DATE_RE.test(sp.from) && DATE_RE.test(sp.to)) {
    let from = clampDay(sp.from);
    let to = clampDay(sp.to);
    if (from > to) [from, to] = [to, from];
    return dayPeriod("custom", from, to, `${from} to ${to}`);
  }

  const hourPreset = sp.range ? HOUR_PRESETS[sp.range] : undefined;
  if (hourPreset && sp.range) {
    const from = hourKey(
      new Date(now.getTime() - (hourPreset.hours - 1) * 3_600_000),
    );
    return hourPeriod(
      sp.range as UsageRangePreset,
      from,
      bounds.hourMax,
      hourPreset.label,
    );
  }

  switch (sp.range) {
    case "7d":
      return dayPeriod("7d", dayAgo(6), bounds.dayMax, "Last 7 days");
    case "30d":
      return dayPeriod("30d", dayAgo(29), bounds.dayMax, "Last 30 days");
    case "all":
      return dayPeriod("all", USAGE_EPOCH, bounds.dayMax, "All time");
    default:
      return {
        preset: "current",
        resolution: "day",
        from: bounds.dayMax,
        to: bounds.dayMax,
        period: currentUsagePeriod(now),
      };
  }
}
