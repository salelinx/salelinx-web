-- Admin console: audit log, identity lookup, cross-user read RPCs, tier write
-- RPCs, storage read RPC.
--
-- Consolidated baseline (July 2026). This file is the net result of the
-- original migrations 027 and 029-031. Full history in git.
--
-- Backs the dedicated /admin area (a top-level, internal-only console). The
-- web app never holds the service-role key, so every admin capability that
-- needs more than the user's own RLS scope is exposed as a SECURITY DEFINER
-- function that re-checks public.is_admin() itself. The app-level gate
-- (middleware + layout) is defense in depth; THESE policies/functions are the
-- real security boundary. Non-admins get zero rows (the is_admin() predicate
-- is in the WHERE clause) or a raised exception, so every function here is
-- safe to GRANT to all authenticated users.
--
-- DEFERRED (designed-for, see TODO(admin-mfa) at the bottom): require AAL2
-- (MFA) on admin data. The exact RESTRICTIVE policies are written out,
-- commented, so enabling MFA enforcement is a one-step uncomment once an
-- enroll/challenge flow ships.

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

-- Admins can read the log (the "Audit log" module's data source).
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
-- 4. admin_list_users() - the user roster with current plan
-- =============================================================================
-- EXACTLY one row per auth.users user. We pick the user's most-recent
-- subscription via a LATERAL (a plain LEFT JOIN would emit one row PER
-- subscription, duplicating users who have more than one). A user with no
-- subscription shows null tier/status (treated as free in the UI). is_admin
-- flags membership in admin_users so the roster can badge admins without an
-- N+1.

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
-- 5. admin_list_subscriptions() - every subscription row
-- =============================================================================
-- The Subscriptions module's data source. Emails are resolved separately by
-- admin_user_emails() so this stays a pure subscriptions read.

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
-- 6. admin_list_usage(period_keys) - usage counters for the given periods
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
-- 7. admin_user_detail(user_id) - the Users detail bundle for one user
-- =============================================================================
-- Returns a single JSONB blob so the detail drawer needs one round-trip:
--   { email, created_at, last_sign_in_at,
--     subscription: <subscriptions row or null>,
--     usage: [ <usage_counters rows for the given periods> ],
--     ticket_count: <int>,
--     is_admin: <bool> }
-- Tier config (caps/features) is fetched on the page via the public-read
-- tier_limits table (getTierConfigs()), not here. is_admin in the payload is
-- the TARGET user's admin status (membership in admin_users), display-only -
-- it is NOT the caller's. The function still gates on the CALLER being an
-- admin.

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

-- =============================================================================
-- 8. Tier write RPCs (Tier limits + Feature flags modules)
-- =============================================================================
-- tier_limits is public-read with NO client write policies (service-role
-- only). Both functions:
--   * only touch ACTIVE rows (effective_until IS NULL) - historical versions
--     are grandfathering records and must not be rewritten
--   * only update KNOWN keys - a typo'd key must fail loudly instead of
--     silently creating a new key nobody reads (extension gating treats a
--     missing/absent key as "not applicable"/"disabled", so a stray key is
--     invisible corruption). Limits require the key on the TARGET row (absent
--     means "not applicable", a meaningful state the UI shows as "-"). Features
--     require the key on ANY active row (absent just means disabled, and the
--     seed only adds feature keys to the tiers that have them, so enabling a
--     feature on a tier whose row lacks the key is legitimate). Introducing a
--     brand-new key stays a deliberate SQL-editor operation (see
--     docs/ENTITLEMENTS.md).
--   * write the audit entry INSIDE the function (via log_admin_action) with
--     the old and new value, so a mutation can never skip the audit log and
--     every change is reversible from the log.
--
-- Semantics preserved from docs/ENTITLEMENTS.md:
--   limits:   JSON number = cap, JSON null = unlimited, key absent = n/a
--   features: JSON true = enabled, false/absent = disabled

-- p_value: a JSON number (the new cap) or NULL / JSON null (unlimited).
CREATE OR REPLACE FUNCTION public.admin_set_tier_limit(
  p_tier_id TEXT,
  p_version INTEGER,
  p_key TEXT,
  p_value JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB := COALESCE(p_value, 'null'::jsonb);
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF jsonb_typeof(v_value) NOT IN ('number', 'null') THEN
    RAISE EXCEPTION 'limit value must be a number or null (unlimited)';
  END IF;

  IF jsonb_typeof(v_value) = 'number' AND (v_value)::numeric < 0 THEN
    RAISE EXCEPTION 'limit value must not be negative';
  END IF;

  SELECT t.limits -> p_key INTO v_old
  FROM public.tier_limits t
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL
    AND t.limits ? p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active tier row (%, v%) with limit key %',
      p_tier_id, p_version, p_key;
  END IF;

  UPDATE public.tier_limits t
  SET limits = jsonb_set(t.limits, ARRAY[p_key], v_value)
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL;

  PERFORM public.log_admin_action(
    'tier.limit_update',
    'tier_limits',
    p_tier_id || ':v' || p_version,
    jsonb_build_object('key', p_key, 'old', v_old, 'new', v_value)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_tier_feature(
  p_tier_id TEXT,
  p_version INTEGER,
  p_key TEXT,
  p_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'enabled must be true or false';
  END IF;

  -- Typo guard: the key must already be a known feature key on SOME active
  -- tier row (it does not have to exist on the target row; absent = disabled).
  IF NOT EXISTS (
    SELECT 1 FROM public.tier_limits t
    WHERE t.effective_until IS NULL AND t.features ? p_key
  ) THEN
    RAISE EXCEPTION 'unknown feature key %', p_key;
  END IF;

  SELECT t.features -> p_key INTO v_old
  FROM public.tier_limits t
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active tier row (%, v%)', p_tier_id, p_version;
  END IF;

  -- jsonb_set with create_missing = true: adds the key when the target row
  -- lacks it (absent and false are the same state for features).
  UPDATE public.tier_limits t
  SET features = jsonb_set(t.features, ARRAY[p_key], to_jsonb(p_enabled), true)
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL;

  PERFORM public.log_admin_action(
    'tier.feature_update',
    'tier_limits',
    p_tier_id || ':v' || p_version,
    jsonb_build_object('key', p_key, 'old', v_old, 'new', to_jsonb(p_enabled))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_tier_feature(TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tier_feature(TEXT, INTEGER, TEXT, BOOLEAN) TO authenticated;

-- =============================================================================
-- 9. admin_list_storage() - the Storage module's data source
-- =============================================================================
-- Reads the user_storage gauge (see 004_storage_quota.sql). Own-row-only under
-- RLS, so the cross-user read re-checks is_admin() like everything above.
-- Bounded at one row per user who has ever uploaded, so no pagination is
-- needed at current scale. Caps come from the public-read tier_limits table on
-- the page (getTierConfigs()), not here.

CREATE OR REPLACE FUNCTION public.admin_list_storage()
RETURNS TABLE (
  user_id UUID,
  bytes_used BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    s.bytes_used,
    s.updated_at
  FROM public.user_storage s
  WHERE public.is_admin()
  ORDER BY s.bytes_used DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_storage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_storage() TO authenticated;

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
