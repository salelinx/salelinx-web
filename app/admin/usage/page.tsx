import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import { currentPeriodKeys } from "@/lib/admin/period";
import { capForFeature, percentOfCap } from "@/lib/admin/usage-caps";
import type {
  AdminUsageRow,
  AdminUserRow,
  AdminSubscriptionRow,
} from "@/lib/types/admin";
import {
  AdminUsageTable,
  type UsageTableRow,
} from "@/components/admin/usage/AdminUsageTable";

// /admin/usage - cross-user consumption for the CURRENT period. We compute the
// period keys server-side (YYYY-MM month bucket + YYYY-MM-DD day bucket) and
// pass them to admin_list_usage() so the read stays bounded (usage_counters
// grows ~ users x features x periods; an unscoped read would grow without
// bound - see the scale note in migration 006_admin_console.sql). Each usage row is paired with
// the user's email and measured against the cap from their tier config.
//
// Read-only. If the user base grows, add pagination / a top-N cap to the RPC.

export default async function AdminUsagePage() {
  const supabase = await createServerClient();
  const { month, day } = currentPeriodKeys(new Date());

  const { data: usageData } = await supabase.rpc("admin_list_usage", {
    p_period_keys: [month, day],
  });
  const usage = (usageData as AdminUsageRow[] | null) ?? [];

  // Map each user to their tier so we can resolve caps. Use the roster (already
  // joins subscriptions) plus the subscription versions for an exact tier match.
  const { data: usersData } = await supabase.rpc("admin_list_users");
  const users = (usersData as AdminUserRow[] | null) ?? [];
  const tierByUser: Record<string, string> = {};
  for (const u of users) tierByUser[u.user_id] = u.tier_id ?? "free";

  const { data: subsData } = await supabase.rpc("admin_list_subscriptions");
  const subs = (subsData as AdminSubscriptionRow[] | null) ?? [];
  const versionByUser: Record<string, number> = {};
  for (const s of subs) versionByUser[s.user_id] = s.tier_version;

  const tiers = await getTierConfigs();

  // Resolve emails for the users who have usage rows.
  const emails: Record<string, string> = {};
  const userIds = Array.from(new Set(usage.map((u) => u.user_id)));
  if (userIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: userIds,
    });
    for (const row of (emailRows as
      | { user_id: string; email: string }[]
      | null) ?? []) {
      emails[row.user_id] = row.email;
    }
  }

  // Build the table rows (count vs cap vs percent) server-side so the client
  // component stays a pure renderer.
  const rows: UsageTableRow[] = usage.map((u) => {
    const tierId = tierByUser[u.user_id] ?? "free";
    const version = versionByUser[u.user_id];
    const tierConfig =
      (version !== undefined &&
        tiers.find((t) => t.tier_id === tierId && t.version === version)) ||
      tiers.find((t) => t.tier_id === tierId) ||
      null;
    const cap = capForFeature(u.feature, tierConfig);
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

  return <AdminUsageTable rows={rows} periodLabel={`${month} / ${day}`} />;
}
