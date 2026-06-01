import { createServerClient } from "./server";

// Whether the given user is a support admin. Membership in the admin_users
// table grants admin (managed via the Supabase dashboard - there are no
// INSERT/UPDATE/DELETE RLS policies on it). The "admin_users self read" policy
// lets a signed-in user read their own row, which is all this check needs.
//
// This is the WEB equivalent of the extension's isCurrentUserAdmin(). It only
// controls what the /account/support UI renders; every admin WRITE is gated
// independently by RLS via public.is_admin(), so the UI check is cosmetic.
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
