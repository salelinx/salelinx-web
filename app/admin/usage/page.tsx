import { loadExtensionUsageByUser } from "@/lib/admin/usage-data";
import { resolveUsageRange, usageRangeBounds } from "@/lib/admin/usage-range";
import { AdminUserUsageGroups } from "@/components/admin/usage/AdminUserUsageGroups";
import { UsageRangePicker } from "@/components/admin/usage/UsageRangePicker";

// /admin/usage - EXTENSION feature usage for a selectable period, grouped by
// user. Defaults to the current period (this month + today); the header picker
// widens it to the last 24 hours, last 7 / 30 days, all time, or a custom
// from/to range at day or hour resolution, carried in the URL (?range= or
// ?from=&to=, resolved in lib/admin/usage-range.ts).
// Each user is a collapsible card whose body lists the FULL extension feature
// roster (lib/admin/extension-features.ts) with the range's counts, zero
// included. On the current-period view the five tier-metered verbs (crosslist,
// relist, refresh, follow, unfollow) also show their tier cap and percent, so
// a high percent there is a billing / upgrade signal. Range views drop the cap
// columns: caps are per-period and a percent against a multi-period sum would
// mislead. Day ranges sum day buckets plus every month bucket touched, so a
// range partially covering a month includes that whole month's count for the
// monthly counters. Hour ranges sum the server-derived hour buckets only
// (migration 016), which are exact for every counter but exist only from
// HOUR_EPOCH and for HOUR_RETENTION_DAYS (lib/admin/period.ts).
//
// Web-side abuse rate limits (checkout sessions, portal sessions, deletion
// requests, label emails, email changes) live at /admin/usage/web. They share
// the usage_counters table but are capped by hardcoded constants rather than
// tier_limits. See lib/admin/usage-sources.ts.
//
// Read-only. Period keys are computed server-side so the read stays bounded.

type SearchParams = Promise<{ range?: string; from?: string; to?: string }>;

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const selection = resolveUsageRange(await searchParams, now);
  const { groups, periodLabel } = await loadExtensionUsageByUser(
    selection.period,
  );

  return (
    <AdminUserUsageGroups
      groups={groups}
      periodLabel={periodLabel}
      periodNote={selection.period.note}
      toolbar={
        <UsageRangePicker
          preset={selection.preset}
          resolution={selection.resolution}
          from={selection.from}
          to={selection.to}
          bounds={usageRangeBounds(now)}
        />
      }
    />
  );
}
