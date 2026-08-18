import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import { currentPeriodKeys } from "@/lib/admin/period";
import { capForFeature, percentOfCap } from "@/lib/admin/usage-caps";
import { usageSource, webCounterLimit } from "@/lib/admin/usage-sources";
import type {
  AdminUsageRow,
  AdminUserRow,
  AdminSubscriptionRow,
} from "@/lib/types/admin";
import type { UsageTableRow } from "@/components/admin/usage/AdminUsageTable";
import type { UsageSource } from "@/lib/admin/usage-sources";

// Shared loader for the two usage modules. Both read the SAME usage_counters
// rows for the current period and differ only in which source they keep and how
// the cap is resolved, so the query work lives here once.
//
// Every read below still goes through the is_admin()-gated RPCs; splitting the
// page did not add a data path (see docs/ADMIN.md).
export async function loadUsageRows(source: UsageSource): Promise<{
  rows: UsageTableRow[];
  periodLabel: string;
}> {
  const supabase = await createServerClient();
  const { month, day } = currentPeriodKeys(new Date());

  // These four reads are independent of each other, so they resolve together.
  const [usageRes, usersRes, subsRes, tiers] = await Promise.all([
    supabase.rpc("admin_list_usage", { p_period_keys: [month, day] }),
    supabase.rpc("admin_list_users"),
    supabase.rpc("admin_list_subscriptions"),
    getTierConfigs(),
  ]);

  const all = (usageRes.data as AdminUsageRow[] | null) ?? [];
  const usage = all.filter((u) => usageSource(u.feature) === source);

  const users = (usersRes.data as AdminUserRow[] | null) ?? [];
  const tierByUser: Record<string, string> = {};
  for (const u of users) tierByUser[u.user_id] = u.tier_id ?? "free";

  const subs = (subsRes.data as AdminSubscriptionRow[] | null) ?? [];
  const versionByUser: Record<string, number> = {};
  for (const s of subs) versionByUser[s.user_id] = s.tier_version;

  // Resolve emails only for the users who survived the source filter.
  const emails: Record<string, string> = {};
  const userIds = Array.from(new Set(usage.map((u) => u.user_id)));
  if (userIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: userIds,
    });
    for (const row of (emailRows as
      { user_id: string; email: string }[] | null) ?? []) {
      emails[row.user_id] = row.email;
    }
  }

  const rows: UsageTableRow[] = usage.map((u) => {
    const tierId = tierByUser[u.user_id] ?? "free";
    const version = versionByUser[u.user_id];
    const tierConfig =
      (version !== undefined &&
        tiers.find((t) => t.tier_id === tierId && t.version === version)) ||
      tiers.find((t) => t.tier_id === tierId) ||
      null;

    // Extension counters are capped by the user's tier. Web counters are capped
    // by a fixed constant in the calling code, identical for every tier, so the
    // tier config is irrelevant to them.
    const cap =
      source === "web"
        ? webCounterLimit(u.feature)
        : capForFeature(u.feature, tierConfig);

    return {
      key: `${u.user_id}:${u.feature}:${u.period_key}`,
      user_id: u.user_id,
      email: emails[u.user_id] ?? null,
      tier_id: tierId,
      feature: u.feature,
      period_key: u.period_key,
      count: u.count,
      cap,
      percent: percentOfCap(u.count, cap),
    };
  });

  return { rows, periodLabel: `${month} / ${day}` };
}
