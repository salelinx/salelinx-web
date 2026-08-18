import { loadUsageRows } from "@/lib/admin/usage-data";
import { AdminUsageTable } from "@/components/admin/usage/AdminUsageTable";

// /admin/usage - EXTENSION product metering for the current period: the action
// verbs the extension meters against tier_limits (crosslist, relist, refresh,
// follow, unfollow). Caps come from the user's tier config, so a high percent
// here is a billing / upgrade signal.
//
// Web-side abuse rate limits (checkout sessions, portal sessions, deletion
// requests, label emails, email changes) live at /admin/usage/web. They share
// the usage_counters table but are capped by hardcoded constants rather than
// tier_limits, which made them read as "unlimited" when the two were mixed on
// one page. See lib/admin/usage-sources.ts.
//
// Read-only. Period keys are computed server-side so the read stays bounded.

export default async function AdminUsagePage() {
  const { rows, periodLabel } = await loadUsageRows("extension");

  return (
    <AdminUsageTable
      rows={rows}
      periodLabel={periodLabel}
      capKind="tier"
      emptyMessage="No extension usage recorded for this period."
    />
  );
}
