import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import { foldAdoption } from "@/lib/admin/adoption";
import type { AdoptionReport, AdoptionWindow } from "@/lib/admin/adoption";
import type { AdminUsageRow, AdminUserRow } from "@/lib/types/admin";

// Server loader for the Feature adoption module. Fetches the raw rows and
// hands them to the pure fold in adoption.ts. Every read goes through the
// is_admin()-gated RPCs the other usage modules use, so this adds no data path
// (see docs/ADMIN.md).
//
// Why row-level rows rather than a rollup RPC: adoption is DISTINCT USERS per
// feature, split by tier, which needs user ids client-side anyway. The period
// keys are generated server-side from a bounded month window (widest: the
// epoch to now), so the read stays bounded the same way /admin/usage's does.
// If the base outgrows this, the follow-up is an admin_feature_usage_rollup
// RPC returning (feature, month, tier_id, user_count, total_count).
export async function loadAdoptionReport(
  window: AdoptionWindow,
): Promise<AdoptionReport> {
  const supabase = await createServerClient();

  const [usageRes, usersRes, tiers] = await Promise.all([
    supabase.rpc("admin_list_usage", { p_period_keys: window.keys }),
    supabase.rpc("admin_list_users"),
    getTierConfigs(),
  ]);

  return foldAdoption({
    rows: (usageRes.data as AdminUsageRow[] | null) ?? [],
    users: (usersRes.data as AdminUserRow[] | null) ?? [],
    tiers,
    window,
  });
}
