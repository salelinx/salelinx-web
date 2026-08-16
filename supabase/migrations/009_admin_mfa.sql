-- Admin MFA enforcement (TODO(admin-mfa) from 006_admin_console.sql, done).
--
-- Requires every admin capability to come from an AAL2 session: the caller
-- signed in with their password AND verified a TOTP code this session. One
-- change in one place: is_admin() (003_support.sql) gains the AAL check.
-- Every admin RLS policy and every admin SECURITY DEFINER RPC already calls
-- is_admin(), so this single function is the choke point - there is no admin
-- surface it misses, including the RPCs that bypass RLS.
--
-- The commented-out RESTRICTIVE policies at the end of 006_admin_console.sql
-- are superseded by this (they only covered the three directly-read tables;
-- this covers everything). They stay commented.
--
-- The app-side mirrors (all in the same change as this migration):
--   * proxy.ts + app/admin/layout.tsx redirect non-AAL2 admins to /auth/mfa
--     (they check admin_users via the self-read policy, which intentionally
--     stays AAL1-readable so the gates can route admins to the challenge)
--   * admin-change-plan / admin-delete-user Edge Functions check the JWT's
--     aal claim
--   * enroll UI in /account (Security card), challenge page at /auth/mfa
--
-- DEPLOY ORDER (lockout warning): deploy the web app and enroll every admin
-- (Account > Security > Enable 2FA) BEFORE applying this migration. Applying
-- it first locks all admins out of the console until they enroll. Recovery
-- of last resort: the Supabase dashboard (Authentication > Users > factors)
-- can remove a lost factor; dashboard access does not depend on app MFA.
--
-- Semantics notes:
--   * auth.jwt()->>'aal' is 'aal1' or 'aal2' on user sessions, NULL for the
--     service role / no session; COALESCE keeps those false.
--   * user_metadata is NOT trusted anywhere here; 'aal' is a top-level claim
--     stamped by GoTrue, not user-editable.
--   * admin_users membership alone still means "is an admin" for display
--     purposes (roster badge etc.); those reads use the table, not this
--     function, and are unaffected.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  )
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2';
$$;
