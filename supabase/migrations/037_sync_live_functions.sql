-- Brings four functions on the live project in line with this folder.
--
-- On 14 Oct 2026 the live function bodies were compared against every
-- migration here. Everything matched (some only after comments were stripped
-- on apply) except four functions that never received the version the
-- baseline records:
--
--   * admin_set_tier_limit and admin_set_tier_feature did not exist on live.
--     They came from pre-squash 030_admin_tier_write_rpcs.sql, which was never
--     run there (the read RPCs from the files either side of it were), so the
--     /admin/tiers and /admin/flags editors had no write path. admin_audit_log
--     holds no tier.* entries, which confirms no edit ever went through.
--   * admin_set_user_subscription ran an older body than 009's, differing in
--     the audit metadata it records.
--   * bump_user_storage_on_delete ran an older body without the UUID shape
--     check the insert and update triggers already have, so deleting a
--     listing-images object outside a user-id folder would fail the cast and
--     abort the delete instead of being skipped.
--
-- Bodies are copied verbatim from 009_admin_console.sql and
-- 004_storage_quota.sql. Signatures and return types match what live already
-- has, so CREATE OR REPLACE swaps the two existing functions in place and the
-- user_storage_track_delete trigger keeps pointing at the new body.
--
-- Grants: the two tier RPCs are new on live, so Supabase's default privileges
-- hand EXECUTE to anon at CREATE time. They revoke PUBLIC and anon here, which
-- also closes the second "Known grant wart" in README.md for anyone rebuilding
-- from this folder. Both still gate on is_admin() (AAL2) internally.
--
-- Re-runnable: CREATE OR REPLACE throughout, and REVOKE / GRANT are idempotent.

-- =============================================================================
-- 1. admin_set_tier_limit() / admin_set_tier_feature() (from 009)
-- =============================================================================

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

REVOKE ALL ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
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

REVOKE ALL ON FUNCTION public.admin_set_tier_feature(TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_tier_feature(TEXT, INTEGER, TEXT, BOOLEAN) TO authenticated;

-- =============================================================================
-- 2. admin_set_user_subscription() (from 009)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_user_subscription(
  p_user_id UUID,
  p_tier_id TEXT,
  p_tier_version INTEGER,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.subscriptions%ROWTYPE;
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_status IS NULL
    OR p_status NOT IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing') THEN
    RAISE EXCEPTION 'invalid status %', COALESCE(p_status, '(null)');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tier_limits t
    WHERE t.tier_id = p_tier_id AND t.version = p_tier_version
  ) THEN
    RAISE EXCEPTION 'no tier_limits row for (%, v%)', p_tier_id, p_tier_version;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'no such user';
  END IF;

  -- Pick the row tier resolution reads: prefer the newest ENTITLED row
  -- (active | trialing | past_due), else the newest row of any status
  -- (matches lib/supabase/subscription.ts, which prefers current statuses
  -- over lapsed rows).
  SELECT * INTO v_target
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY (s.status IN ('active', 'trialing', 'past_due')) DESC,
    s.updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_old := jsonb_build_object(
      'tier_id', v_target.tier_id,
      'tier_version', v_target.tier_version,
      'status', v_target.status
    );

    UPDATE public.subscriptions s
    SET tier_id = p_tier_id,
      tier_version = p_tier_version,
      status = p_status,
      updated_at = NOW()
    WHERE s.id = v_target.id
    RETURNING * INTO v_target;
  ELSE
    -- No subscription history at all: create a comp row. Stripe ids stay
    -- null, so this row is never touched by the webhook.
    v_old := NULL;

    INSERT INTO public.subscriptions (user_id, tier_id, tier_version, status)
    VALUES (p_user_id, p_tier_id, p_tier_version, p_status)
    RETURNING * INTO v_target;
  END IF;

  -- Audit metadata carries NO user ids (docs/GDPR.md: audit entries must not
  -- reference users, so they cannot outlive an erasure request). target_id is
  -- the subscription row id, an opaque reference that cascades away with the
  -- account.
  PERFORM public.log_admin_action(
    'user.subscription_update',
    'subscriptions',
    v_target.id::TEXT,
    jsonb_build_object(
      'old', v_old,
      'new', jsonb_build_object(
        'tier_id', p_tier_id,
        'tier_version', p_tier_version,
        'status', p_status
      ),
      'stripe_managed', v_target.stripe_subscription_id IS NOT NULL
    )
  );

  RETURN to_jsonb(v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- =============================================================================
-- 3. bump_user_storage_on_delete() (from 004)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bump_user_storage_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_size BIGINT;
BEGIN
  IF OLD.bucket_id <> 'listing-images' THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(OLD.name))[1] !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  v_user_id := (storage.foldername(OLD.name))[1]::UUID;

  v_size := COALESCE((OLD.metadata->>'size')::BIGINT, 0);
  IF v_size = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.user_storage
     SET bytes_used = GREATEST(0, bytes_used - v_size),
         updated_at = NOW()
   WHERE user_id = v_user_id;

  RETURN NULL;
END;
$$;

-- Trigger functions are not RPCs.
REVOKE EXECUTE ON FUNCTION public.bump_user_storage_on_delete() FROM PUBLIC, anon, authenticated;
