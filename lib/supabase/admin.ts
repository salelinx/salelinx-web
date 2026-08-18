import { cache } from "react";
import { createServerClient } from "./server";

// Whether the given user is a support admin. Membership in the admin_users
// table grants admin (managed via the Supabase dashboard - there are no
// INSERT/UPDATE/DELETE RLS policies on it). The "admin_users self read" policy
// lets a signed-in user read their own row, which is all this check needs.
//
// This is the WEB equivalent of the extension's isCurrentUserAdmin(). It gates
// access to the /admin console (middleware + layout), but every admin WRITE is
// also gated independently by RLS via public.is_admin(), so the app-level check
// is defense in depth, not the security boundary.
//
// Memoized with React cache() so rendering one request re-uses one lookup
// instead of re-querying per call site. The cache is per-request and keyed by
// userId, so no result is ever shared across users or across requests. An error
// still resolves to false (fail-closed) rather than being cached as allowed.
export const isAdmin = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
});
