import { loadExtensionUsageByUser } from "@/lib/admin/usage-data";
import { AdminUserUsageGroups } from "@/components/admin/usage/AdminUserUsageGroups";

// /admin/usage - EXTENSION feature usage for the current period, grouped by
// user. Each user is a collapsible card whose body lists the FULL extension
// feature roster (lib/admin/extension-features.ts) with this period's counts,
// zero included. The five tier-metered verbs (crosslist, relist, refresh,
// follow, unfollow) also show their tier cap and percent, so a high percent
// here is a billing / upgrade signal; the rest are uncapped activity counters.
//
// Web-side abuse rate limits (checkout sessions, portal sessions, deletion
// requests, label emails, email changes) live at /admin/usage/web. They share
// the usage_counters table but are capped by hardcoded constants rather than
// tier_limits. See lib/admin/usage-sources.ts.
//
// Read-only. Period keys are computed server-side so the read stays bounded.

export default async function AdminUsagePage() {
  const { groups, periodLabel } = await loadExtensionUsageByUser();

  return <AdminUserUsageGroups groups={groups} periodLabel={periodLabel} />;
}
