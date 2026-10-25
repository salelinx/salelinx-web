import { getTierConfigs } from "@/lib/supabase/tier-config";
import { sortTierConfigs } from "@/lib/admin/tiers";
import { AdminFeatureFlags } from "@/components/admin/flags/AdminFeatureFlags";

// /admin/flags - toggle the boolean feature flags in tier_limits.features for
// the ACTIVE tier rows. Reads come from the public-read tier_limits table;
// writes go through the admin_set_tier_feature() SECURITY DEFINER RPC
// (migration 009_admin_console.sql), which re-checks is_admin() and writes the audit entry
// itself. Absent and false are the same state (disabled), so every known
// feature key is toggleable on every tier.

export default async function AdminFlagsPage() {
  const tiers = sortTierConfigs(await getTierConfigs());
  return <AdminFeatureFlags tiers={tiers} />;
}
