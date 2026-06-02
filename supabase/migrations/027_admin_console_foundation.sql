-- Admin console security foundation
--
-- Backs the dedicated /admin area (a top-level, internal-only console). The
-- web app never holds the service-role key, so every admin capability that
-- needs more than the user's own RLS scope is exposed as a SECURITY DEFINER
-- function that re-checks public.is_admin() itself. The app-level gate
-- (middleware + layout) is defense in depth; THESE policies/functions are the
-- real security boundary.
--
-- Adds:
--   1. admin_audit_log         - immutable record of every admin mutation
--   2. log_admin_action()      - the ONLY write path into admin_audit_log;
--                                stamps auth.uid() server-side (no spoofing)
--   3. admin_user_emails()     - batched user_id -> email lookup for admins,
--                                so the UI can show who filed a ticket without
--                                the service-role key
--   4. admin_users hardening   - re-assert there are no client write policies
--
-- DEFERRED (designed-for, see TODO(admin-mfa) below): require AAL2 (MFA) on
-- admin data. The exact RESTRICTIVE policies are written out, commented, so
-- enabling MFA enforcement is a one-step uncomment once an enroll/challenge
-- flow ships.

-- =============================================================================
-- 1. admin_audit_log
-- =============================================================================

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,           -- e.g. 'ticket.reply' | 'ticket.close' | 'ticket.delete'
  target_table TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_actor_id
  ON public.admin_audit_log(actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the log (it becomes the "Audit log" module's data source).
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: the log is append-only and writes go ONLY
-- through log_admin_action() (SECURITY DEFINER). This keeps the actor honest
-- (server-stamped) and the log tamper-resistant from the client.

-- =============================================================================
-- 2. log_admin_action() - the only write path into admin_audit_log
-- =============================================================================
-- SECURITY DEFINER so it can INSERT past the (intentionally absent) write
-- policies, but it re-checks public.is_admin() first so a non-admin calling it
-- directly gets rejected. actor_id is taken from auth.uid(), never the client.

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_table, p_target_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 3. admin_user_emails() - batched identity lookup for admins
-- =============================================================================
-- support_tickets stores user_id but not email. Resolving email otherwise needs
-- the service role (Edge Functions only). This function lets the admin UI show
-- who filed a ticket: pass the ticket authors' user_ids, get back emails.
-- Non-admins get ZERO rows (the is_admin() predicate is in the WHERE clause), so
-- it is safe to GRANT to all authenticated users.

CREATE OR REPLACE FUNCTION public.admin_user_emails(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids)
    AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_user_emails(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(UUID[]) TO authenticated;

-- =============================================================================
-- 4. admin_users hardening (re-assert: no client-side privilege escalation)
-- =============================================================================
-- admin_users was created in 012 with only a self-read policy and NO write
-- policies, so the anon/authenticated roles cannot grant themselves admin -
-- only the service role (Supabase dashboard SQL) can. We re-assert that here so
-- a future migration loosening it stands out in review. RLS stays enabled; the
-- self-read policy from 012 ("admin_users self read") is left intact.

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- (Intentionally no INSERT/UPDATE/DELETE policies on admin_users. Grant admin
-- via the Supabase dashboard SQL editor only. See docs/ADMIN.md.)

-- =============================================================================
-- TODO(admin-mfa): require AAL2 (MFA) on admin data
-- =============================================================================
-- Deferred until an MFA enroll/challenge flow ships in the web app. When ready,
-- uncomment the RESTRICTIVE policies below (RESTRICTIVE = ANDed with the
-- existing permissive admin policies, so an admin still needs is_admin() AND a
-- second factor). Mirror this with a server-side
-- supabase.auth.mfa.getAuthenticatorAssuranceLevel() check in the admin gate.
--
-- CREATE POLICY "support_tickets require aal2"
--   ON public.support_tickets AS RESTRICTIVE TO authenticated
--   USING ((SELECT auth.jwt()->>'aal') = 'aal2');
-- CREATE POLICY "support_ticket_replies require aal2"
--   ON public.support_ticket_replies AS RESTRICTIVE TO authenticated
--   USING ((SELECT auth.jwt()->>'aal') = 'aal2');
-- CREATE POLICY "admin_audit_log require aal2"
--   ON public.admin_audit_log AS RESTRICTIVE TO authenticated
--   USING ((SELECT auth.jwt()->>'aal') = 'aal2');
