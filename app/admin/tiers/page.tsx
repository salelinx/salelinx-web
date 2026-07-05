import { getTierConfigs } from "@/lib/supabase/tier-config";
import { sortTierConfigs } from "@/lib/admin/tiers";
import { AdminTierLimits } from "@/components/admin/tiers/AdminTierLimits";

// /admin/tiers - edit the numeric caps in tier_limits.limits for the ACTIVE
// tier rows. Reads come from the public-read tier_limits table (same
// getTierConfigs() the pricing page uses); writes go through the
// admin_set_tier_limit() SECURITY DEFINER RPC (migration 030), which re-checks
// is_admin() and writes the audit entry itself. The pricing page and the
// extension pick changes up within their cache TTLs (see docs/ENTITLEMENTS.md).

export default async function AdminTiersPage() {
  const tiers = sortTierConfigs(await getTierConfigs());
  return <AdminTierLimits tiers={tiers} />;
}
