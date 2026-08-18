import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

// Per-request memoized admin session lookups.
//
// The admin gate runs in three independent layers (proxy.ts, app/admin/layout.tsx,
// and RLS - see docs/ADMIN.md). Layers 1 and 2 are deliberate defense in depth and
// BOTH still run: this module does not remove a check, it only stops the SAME
// check from re-executing several times while rendering ONE request.
//
// React's cache() is per-request and per-render, so two different users can never
// share an entry, and nothing survives into another request. The value is keyed on
// the request's own cookies via createServerClient(), exactly as before.
//
// Fail-closed is preserved: every helper below returns the denying value (null /
// false) when the underlying call errors, so a failure can never read as "allowed".

// The verified current user. getUser() re-validates the JWT against Supabase Auth
// (unlike getSession()), which is why the layout uses it rather than getClaims().
export const getAdminUser = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
});

// Whether the CURRENT session has cleared MFA. is_admin() in Postgres enforces
// the same requirement (migration 009), so this is UX, not the boundary.
export const getIsAal2 = cache(async (): Promise<boolean> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  return data?.currentLevel === "aal2";
});
