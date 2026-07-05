-- Admin console read RPCs (read-only modules: Users, Subscriptions, Usage)
--
-- The /admin console grows past Support with read-only modules that need data
-- ACROSS users: the full user roster, every subscription, and per-user usage
-- counters. The web app never holds the service-role key (Edge Functions only),
-- and the billing tables are own-row-only under RLS:
--
--   subscriptions   -> "subscriptions own read"  = auth.uid() = user_id
--   usage_counters  -> "usage_counters own read" = auth.uid() = user_id
--   auth.users      -> not directly readable at all
--
-- So an admin's own session sees only its own rows; a plain select("*") would
-- not return everyone's. Following the pattern from migration 027
-- (admin_user_emails / log_admin_action), each cross-user read is a
-- SECURITY DEFINER function that re-checks public.is_admin() ITSELF. Non-admins
-- get zero rows (the is_admin() predicate is in the WHERE) or a raised
-- exception, so these are safe to GRANT to all authenticated users. The
-- app-level gate (middleware + layout) is defense in depth; THESE functions are
-- the real boundary.
--
-- All functions here are READ-only (no INSERT/UPDATE/DELETE). The audit log
-- module reads admin_audit_log directly (it already has an is_admin() SELECT
-- policy from 027), so it needs no function here.
--
-- DEFERRED (admin-mfa): these are reads on existing tables, covered by the same
-- MFA-deferral story as migration 027. No new tables are added, so there is no
-- new RESTRICTIVE policy stub to write; when AAL2 enforcement lands it applies
-- at the table level (027's commented stubs) and these definer functions run
-- with the caller's is_admin() check unchanged.

-- =============================================================================
-- 1. admin_list_users() - the user roster with current plan
-- =============================================================================
-- EXACTLY one row per auth.users user. We pick the user's most-recent
-- subscription via a LATERAL (a plain LEFT JOIN would emit one row PER
-- subscription, duplicating users who have more than one). A user with no
-- subscription shows null tier/status (treated as free in the UI). is_admin
-- flags membership in admin_users so the roster can badge admins without an
-- N+1.

-- DROP first: this function's return type (the OUT columns) has changed across
-- iterations, and CREATE OR REPLACE cannot alter an existing function's row
-- type ("cannot change return type of existing function"). Dropping makes the
-- migration re-runnable against a DB that has an older signature.
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  tier_id TEXT,
  status TEXT,
  is_admin BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    s.tier_id,
    s.status,
    EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id
    ) AS is_admin
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT sub.tier_id, sub.status
    FROM public.subscriptions sub
    WHERE sub.user_id = u.id
    ORDER BY sub.updated_at DESC
    LIMIT 1
  ) s ON TRUE
  WHERE public.is_admin()
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- =============================================================================
-- 2. admin_list_subscriptions() - every subscription row
-- =============================================================================
-- The Subscriptions module's data source. Emails are resolved separately by the
-- existing admin_user_emails() RPC so this stays a pure subscriptions read.

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier_id TEXT,
  tier_version INTEGER,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.user_id,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.tier_id,
    s.tier_version,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end,
    s.created_at,
    s.updated_at
  FROM public.subscriptions s
  WHERE public.is_admin()
  ORDER BY s.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;

-- =============================================================================
-- 3. admin_list_usage(period_keys) - usage counters for the given periods
-- =============================================================================
-- The Usage module passes the current period keys (the YYYY-MM month bucket for
-- monthly features and the YYYY-MM-DD day bucket for daily features), computed
-- in the page so this function stays generic. Scoping to the current period
-- keeps the result bounded; usage_counters grows ~ users x features x periods
-- and daily rows accumulate one per user per day, so an unscoped read would
-- grow without bound. If the user base grows, add pagination / a top-N cap.

CREATE OR REPLACE FUNCTION public.admin_list_usage(p_period_keys TEXT[])
RETURNS TABLE (
  user_id UUID,
  feature TEXT,
  period_key TEXT,
  count BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.user_id,
    c.feature,
    c.period_key,
    c.count,
    c.updated_at
  FROM public.usage_counters c
  WHERE c.period_key = ANY(p_period_keys)
    AND public.is_admin()
  ORDER BY c.count DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_usage(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_usage(TEXT[]) TO authenticated;

-- =============================================================================
-- 4. admin_user_detail(user_id) - the Users detail bundle for one user
-- =============================================================================
-- Returns a single JSONB blob so the detail drawer needs one round-trip:
--   { email, created_at, last_sign_in_at,
--     subscription: <subscriptions row or null>,
--     usage: [ <usage_counters rows for the given periods> ],
--     ticket_count: <int>,
--     is_admin: <bool> }
-- Tier config (caps/features) is fetched on the page via the public-read
-- tier_limits table (getTierConfigs()), not here. is_admin in the payload is the
-- TARGET user's admin status (membership in admin_users), display-only - it is
-- NOT the caller's. The function still gates on the CALLER being an admin.

CREATE OR REPLACE FUNCTION public.admin_user_detail(
  p_user_id UUID,
  p_period_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'subscription', (
      SELECT to_jsonb(s)
      FROM public.subscriptions s
      WHERE s.user_id = u.id
      ORDER BY s.updated_at DESC
      LIMIT 1
    ),
    'usage', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'feature', c.feature,
          'period_key', c.period_key,
          'count', c.count,
          'updated_at', c.updated_at
        )
        ORDER BY c.feature
      )
      FROM public.usage_counters c
      WHERE c.user_id = u.id
        AND c.period_key = ANY(p_period_keys)
    ), '[]'::jsonb),
    'ticket_count', (
      SELECT COUNT(*)
      FROM public.support_tickets t
      WHERE t.user_id = u.id
    ),
    'is_admin', EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id
    )
  )
  INTO v_result
  FROM auth.users u
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) TO authenticated;
