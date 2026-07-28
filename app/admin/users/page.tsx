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

  const { data: usersData } = await supabase.rpc("admin_list_users");
  const users = (usersData as AdminUserRow[] | null) ?? [];

  // Tier configs (public-read) so the detail drawer can show usage against caps
  // without another round-trip per open. Passed down to the table.
  const tiers = await getTierConfigs();

  return <AdminUserTable initialUsers={users} tiers={tiers} />;
}
