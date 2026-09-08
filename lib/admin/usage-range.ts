// Resolves the usage pages' URL params (?range= presets or ?from=&to= custom
// bounds) into a bounded UsagePeriod. Shared by /admin/usage and
// /admin/usage/web so both read the same param scheme. Pure date math, no
// server dependencies, so the client-side users drawer can reuse the key
// generation too.
//
// Three resolutions:
//   window - the trailing presets (last 5 minutes to last 72 hours). Exact:
//            answered from usage_events (migration 017) between two
//            timestamps, so "last 15 minutes" at 14:52 is 14:37 to 14:52.
//            Only as far back as events exist (EVENTS_EPOCH) and are kept
//            (EVENTS_RETENTION_DAYS).
//   hour   - custom from/to as 'YYYY-MM-DDTHH' (UTC); keys are hour buckets
//            ONLY. Exact per bucket, but only as far back as the hour rows
//            exist (HOUR_EPOCH) and are kept (HOUR_RETENTION_DAYS).
//   day    - the day presets (7 / 30 days, all time) and old day-shaped
//            links; keys are the day buckets plus the month bucket of every
//            month touched (monthly counters only exist as month buckets, so
//            a partial month includes the whole month for them). The picker
//            no longer offers day-shaped custom ranges.

import {
  EVENTS_EPOCH,
  EVENTS_RETENTION_DAYS,
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
  | "5m"
  | "15m"
  | "30m"
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

// Trailing-window presets, answered from usage_events. Exact windows ending
// now; the order here is the order the picker lists them in.
export const WINDOW_PRESETS: Record<string, { minutes: number; label: string }> =
  {
    "5m": { minutes: 5, label: "Last 5 minutes" },
    "15m": { minutes: 15, label: "Last 15 minutes" },
    "30m": { minutes: 30, label: "Last 30 minutes" },
    "1h": { minutes: 60, label: "Last hour" },
    "2h": { minutes: 120, label: "Last 2 hours" },
    "12h": { minutes: 720, label: "Last 12 hours" },
    "24h": { minutes: 1_440, label: "Last 24 hours" },
    "48h": { minutes: 2_880, label: "Last 48 hours" },
    "72h": { minutes: 4_320, label: "Last 72 hours" },
  };

export type UsageRangeResolution = "day" | "hour" | "window";

export type UsageRangeSelection = {
  preset: UsageRangePreset;
  resolution: UsageRangeResolution;
  // Day keys at day resolution, hour keys at hour resolution, ISO timestamps
  // at window resolution. Seed the picker.
  from: string;
  to: string;
  period: UsagePeriod;
};

// Bounds the picker can offer, computed from the same clock as the selection
// so the inputs and the clamping agree.
export type UsageRangeBounds = {
  dayMin: string; // USAGE_EPOCH
  dayMax: string; // today
  hourMin: string; // later of HOUR_EPOCH and now minus hour retention
  hourMax: string; // the current hour
  eventsMin: string; // ISO; later of EVENTS_EPOCH and now minus event retention
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function usageToday(): string {
  return currentPeriodKeys(new Date()).day;
}

export function usageRangeBounds(now = new Date()): UsageRangeBounds {
  const hourFloor = hourKey(
    new Date(now.getTime() - HOUR_RETENTION_DAYS * 86_400_000),
  );
  const eventsFloor = new Date(
    now.getTime() - EVENTS_RETENTION_DAYS * 86_400_000,
  ).toISOString();
  return {
    dayMin: USAGE_EPOCH,
    dayMax: currentPeriodKeys(now).day,
    hourMin: hourFloor > HOUR_EPOCH ? hourFloor : HOUR_EPOCH,
    hourMax: hourKey(now),
    eventsMin: eventsFloor > EVENTS_EPOCH ? eventsFloor : EVENTS_EPOCH,
  };
}

// '2026-09-08T14' -> '2026-09-08 14:00' for labels.
function hourLabel(key: string): string {
  return `${key.slice(0, 10)} ${key.slice(11, 13)}:00`;
}

// ISO timestamp -> '2026-09-08 14:37' for labels.
function minuteLabel(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
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

  // Trailing windows are clamped to the span that has event rows, with the
  // same "say so" rule as hour ranges.
  const windowPeriod = (
    preset: UsageRangePreset,
    minutes: number,
    label: string,
  ): UsageRangeSelection => {
    const until = now.toISOString();
    const requestedSince = new Date(now.getTime() - minutes * 60_000).toISOString();
    const clamped = requestedSince < bounds.eventsMin;
    const since = clamped ? bounds.eventsMin : requestedSince;
    const note = clamped
      ? bounds.eventsMin === EVENTS_EPOCH
        ? `Usage events start at ${minuteLabel(EVENTS_EPOCH)} UTC; the window was cut to begin there.`
        : `Usage events are kept for ${EVENTS_RETENTION_DAYS} days; the window was cut to begin at ${minuteLabel(bounds.eventsMin)} UTC.`
      : undefined;
    return {
      preset,
      resolution: "window",
      from: since,
      to: until,
      period: {
        keys: [],
        window: { since, until },
        label: `${label} (since ${minuteLabel(since).slice(11)} UTC)`,
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

  const windowPreset = sp.range ? WINDOW_PRESETS[sp.range] : undefined;
  if (windowPreset && sp.range) {
    return windowPeriod(
      sp.range as UsageRangePreset,
      windowPreset.minutes,
      windowPreset.label,
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
