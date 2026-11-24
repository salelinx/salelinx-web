-- =============================================================================
-- 063: Uninstall feedback in the admin console
-- =============================================================================
-- /admin/finance/cancellations shows the uninstall survey (013) next to the
-- reasons Stripe records when someone cancels. Until now the table had no read
-- path: anon and authenticated may only INSERT, and answers were read in the
-- Supabase dashboard. Two additions:
--
-- 1. An admin SELECT policy through is_admin(), so the AAL2 requirement is
--    inherited. Rows stay anonymous (013); nothing here adds an identifier.
--
-- 2. admin_redact_uninstall_comment(id) clears one free-text comment and writes
--    an audit entry. docs/GDPR.md promises to review these comments and remove
--    any personal details people volunteer; this is the tool for it. The audit
--    metadata never copies the comment, or the removed text would live on in
--    the log. The console asks for step-up reauth first, as it does for every
--    irreversible admin action.

GRANT SELECT ON TABLE public.uninstall_feedback TO authenticated;

DROP POLICY IF EXISTS uninstall_feedback_admin_read ON public.uninstall_feedback;
CREATE POLICY uninstall_feedback_admin_read ON public.uninstall_feedback
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_redact_uninstall_comment(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_version text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.uninstall_feedback
     SET comment = NULL
   WHERE id = p_id
     AND comment IS NOT NULL
  RETURNING reason, version INTO v_reason, v_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no comment to remove';
  END IF;

  PERFORM public.log_admin_action(
    'uninstall_feedback.redact_comment',
    'uninstall_feedback',
    p_id::text,
    jsonb_build_object('reason', v_reason, 'version', v_version)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_redact_uninstall_comment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_redact_uninstall_comment(uuid) TO authenticated;
