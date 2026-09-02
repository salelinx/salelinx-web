import { loadExtensionUsageByUser } from "@/lib/admin/usage-data";
import { USAGE_EPOCH } from "@/lib/admin/period";
import { resolveUsageRange, usageToday } from "@/lib/admin/usage-range";
import { AdminUserUsageGroups } from "@/components/admin/usage/AdminUserUsageGroups";
import { UsageRangePicker } from "@/components/admin/usage/UsageRangePicker";

// /admin/usage - EXTENSION feature usage for a selectable period, grouped by
// user. Defaults to the current period (this month + today); the header picker
// widens it to last 7 / 30 days, all time, or a custom from/to range, carried
// in the URL (?range= or ?from=&to=, resolved in lib/admin/usage-range.ts).
// Each user is a collapsible card whose body lists the FULL extension feature
// roster (lib/admin/extension-features.ts) with the range's counts, zero
// included. On the current-period view the five tier-metered verbs (crosslist,
// relist, refresh, follow, unfollow) also show their tier cap and percent, so
// a high percent there is a billing / upgrade signal. Range views drop the cap
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

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const selection = resolveUsageRange(await searchParams);
  const { groups, periodLabel } = await loadExtensionUsageByUser(
    selection.period,
  );

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
          max={usageToday()}
        />
      }
    />
  );
}
