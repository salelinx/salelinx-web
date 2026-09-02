import { loadExtensionUsageByUser } from "@/lib/admin/usage-data";
import {
  USAGE_EPOCH,
  currentPeriodKeys,
  currentUsagePeriod,
  periodKeysForRange,
} from "@/lib/admin/period";
import type { UsagePeriod } from "@/lib/admin/period";
import { AdminUserUsageGroups } from "@/components/admin/usage/AdminUserUsageGroups";
import { UsageRangePicker } from "@/components/admin/usage/UsageRangePicker";
import type { UsageRangePreset } from "@/components/admin/usage/UsageRangePicker";

// /admin/usage - EXTENSION feature usage for a selectable period, grouped by
// user. Defaults to the current period (this month + today); the header picker
// widens it to last 7 / 30 days, all time, or a custom from/to range, carried
// in the URL (?range= or ?from=&to=). Each user is a collapsible card whose
// body lists the FULL extension feature roster
// (lib/admin/extension-features.ts) with the range's counts, zero included.
// On the current-period view the five tier-metered verbs (crosslist, relist,
// refresh, follow, unfollow) also show their tier cap and percent, so a high
// percent there is a billing / upgrade signal. Range views drop the cap
// columns: caps are per-period and a percent against a multi-period sum would
// mislead. Monthly counters only exist as month buckets, so a range partially
// covering a month includes that whole month's count for them.
//
// Web-side abuse rate limits (checkout sessions, portal sessions, deletion
// requests, label emails, email changes) live at /admin/usage/web. They share
// the usage_counters table but are capped by hardcoded constants rather than
// tier_limits. See lib/admin/usage-sources.ts.
//
// Read-only. Period keys are computed server-side so the read stays bounded.

type SearchParams = Promise<{ range?: string; from?: string; to?: string }>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Selection = {
  preset: UsageRangePreset;
  from: string;
  to: string;
  period: UsagePeriod;
};

function resolveSelection(sp: {
  range?: string;
  from?: string;
  to?: string;
}): Selection {
  const now = new Date();
  const today = currentPeriodKeys(now).day;
  const clampDay = (d: string) =>
    d < USAGE_EPOCH ? USAGE_EPOCH : d > today ? today : d;
  const dayAgo = (n: number) =>
    clampDay(currentPeriodKeys(new Date(now.getTime() - n * 86_400_000)).day);
  const rangePeriod = (from: string, to: string, label: string): UsagePeriod => ({
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

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const selection = resolveSelection(await searchParams);
  const { groups, periodLabel } = await loadExtensionUsageByUser(
    selection.period,
  );
  const today = currentPeriodKeys(new Date()).day;

  return (
    <AdminUserUsageGroups
      groups={groups}
      periodLabel={periodLabel}
      toolbar={
        <UsageRangePicker
          preset={selection.preset}
          from={selection.from}
          to={selection.to}
          min={USAGE_EPOCH}
          max={today}
        />
      }
    />
  );
}
