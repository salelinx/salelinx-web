-- Admin console tier write RPCs (edit modules: Tier limits, Feature flags)
--
-- tier_limits is public-read with NO client write policies (service-role only,
-- see migration 011). The admin console needs to edit it without the web app
-- ever holding the service-role key, so - following the pattern from 027/029 -
-- each write is a SECURITY DEFINER function that re-checks public.is_admin()
-- ITSELF. The app-level gate (middleware + layout) is defense in depth; THESE
-- functions are the real boundary.
--
-- Both functions:
--   * only touch ACTIVE rows (effective_until IS NULL) - historical versions
--     are grandfathering records and must not be rewritten
--   * only update KNOWN keys - a typo'd key must fail loudly instead of
--     silently creating a new key nobody reads (extension gating treats a
--     missing/absent key as "not applicable"/"disabled", so a stray key is
--     invisible corruption). Limits require the key on the TARGET row (absent
--     means "not applicable", a meaningful state the UI shows as "-"). Features
--     require the key on ANY active row (absent just means disabled, and seed
--     migrations only added feature keys to the tiers that have them, so
--     enabling a feature on a tier whose row lacks the key is legitimate).
--     Introducing a brand-new key stays a deliberate SQL-editor operation
--     (see docs/ENTITLEMENTS.md).
--   * write the audit entry INSIDE the function (via log_admin_action) with the
--     old and new value, so a mutation can never skip the audit log and every
--     change is reversible from the log.
--
-- Semantics preserved from docs/ENTITLEMENTS.md:
--   limits:   JSON number = cap, JSON null = unlimited, key absent = n/a
--   features: JSON true = enabled, false/absent = disabled

-- =============================================================================
-- 1. admin_set_tier_limit(tier_id, version, key, value) - edit one numeric cap
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

REVOKE ALL ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 2. admin_set_tier_feature(tier_id, version, key, enabled) - toggle one flag
-- =============================================================================

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
