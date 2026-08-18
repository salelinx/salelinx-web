import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import type { AdminUserRow } from "@/lib/types/admin";
import { AdminUserTable } from "@/components/admin/users/AdminUserTable";

// /admin/users - the user roster. admin_list_users() is an is_admin()-gated
// SECURITY DEFINER RPC (auth.users + subscriptions are not admin-readable under
// plain RLS). The detail drawer fetches the rest per-user on the client via
// admin_user_detail(), and can edit the user's subscription via
// admin_set_user_subscription() (audit-logged, see docs/ADMIN.md).

export default async function AdminUsersPage() {
  const supabase = await createServerClient();

  // The roster and the tier configs are independent, so they resolve together.
  // admin_list_users() still re-checks is_admin() server-side.
  //
  // Tier configs (public-read) let the detail drawer show usage against caps
  // without another round-trip per open. Passed down to the table.
  const [usersRes, tiers] = await Promise.all([
    supabase.rpc("admin_list_users"),
    getTierConfigs(),
  ]);
  const users = (usersRes.data as AdminUserRow[] | null) ?? [];

  return <AdminUserTable initialUsers={users} tiers={tiers} />;
}
