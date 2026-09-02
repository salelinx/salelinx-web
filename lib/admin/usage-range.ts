// Resolves the usage pages' URL params (?range= presets or ?from=&to= custom
// dates) into a bounded UsagePeriod. Shared by /admin/usage and
// /admin/usage/web so both read the same param scheme. Pure date math, no
// server dependencies, so the client-side users drawer can reuse the key
// generation too.

import {
  USAGE_EPOCH,
  currentPeriodKeys,
  currentUsagePeriod,
  periodKeysForRange,
} from "@/lib/admin/period";
import type { UsagePeriod } from "@/lib/admin/period";

export type UsageRangePreset = "current" | "7d" | "30d" | "all" | "custom";

export type UsageRangeSelection = {
  preset: UsageRangePreset;
  from: string;
  to: string;
  period: UsagePeriod;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function usageToday(): string {
  return currentPeriodKeys(new Date()).day;
}

export function resolveUsageRange(sp: {
  range?: string;
  from?: string;
  to?: string;
}): UsageRangeSelection {
  const now = new Date();
  const today = currentPeriodKeys(now).day;
  const clampDay = (d: string) =>
    d < USAGE_EPOCH ? USAGE_EPOCH : d > today ? today : d;
  const dayAgo = (n: number) =>
    clampDay(currentPeriodKeys(new Date(now.getTime() - n * 86_400_000)).day);
  const rangePeriod = (
    from: string,
    to: string,
    label: string,
  ): UsagePeriod => ({
    keys: periodKeysForRange(from, to),
    label,
    capped: false,
  });

  if (sp.from && sp.to && DATE_RE.test(sp.from) && DATE_RE.test(sp.to)) {
    let from = clampDay(sp.from);
    let to = clampDay(sp.to);
    if (from > to) [from, to] = [to, from];
    return {
      preset: "custom",
      from,
      to,
      period: rangePeriod(from, to, `${from} to ${to}`),
    };
  }

  switch (sp.range) {
    case "7d": {
      const from = dayAgo(6);
      return {
        preset: "7d",
        from,
        to: today,
        period: rangePeriod(from, today, "Last 7 days"),
      };
    }
    case "30d": {
      const from = dayAgo(29);
      return {
        preset: "30d",
        from,
        to: today,
        period: rangePeriod(from, today, "Last 30 days"),
      };
    }
    case "all":
      return {
        preset: "all",
        from: USAGE_EPOCH,
        to: today,
        period: rangePeriod(USAGE_EPOCH, today, "All time"),
      };
    default:
      return {
        preset: "current",
        from: today,
        to: today,
        period: currentUsagePeriod(now),
      };
  }
}
