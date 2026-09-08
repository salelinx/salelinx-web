-- Hour-resolution usage buckets for the admin console.
--
-- usage_counters only ever held month ('YYYY-MM') and day ('YYYY-MM-DD')
-- buckets, so the admin usage pages could narrow a range to whole days at
-- best (and monthly activity counters only to whole months). This migration
-- makes increment_usage_counter ALSO upsert an hour bucket
-- ('YYYY-MM-DDTHH', UTC) on every call, derived server-side from now(). The
-- caller-supplied period key still drives the bucket the caps are enforced
-- against and the value the RPC returns; nothing about entitlement checks
-- changes. Deriving the hour here rather than in the extension means every
-- extension build in the field produces hourly data from the moment this is
-- applied, and no client can name an hour bucket of its own.
--
-- Hour rows are short-lived: purge_stale_usage_counters drops them after 60
-- days (the admin picker clamps hour ranges to the same window,
-- HOUR_RETENTION_DAYS in lib/admin/period.ts) and they are excluded from the
-- 2000-row cap the month/day rows live under, with their own soft cap instead.
-- Nothing else reads hour rows: every existing consumer (extension usage
-- meters, /account, adoption and analytics) selects by explicit month/day keys.
--
-- This CREATE OR REPLACE also settles which increment_usage_counter is live:
-- the body below is 002_billing_tiers.sql's caller-supplied-key variant plus
-- the hour bucket. If the live project happened to carry the extension repo's
-- unreconciled server-derived-key variant (see supabase/migrations/README.md),
-- applying this replaces it.

-- =============================================================================
-- 1. increment_usage_counter - add the server-derived hour bucket
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  p_feature TEXT,
  p_period_key TEXT,
  p_delta BIGINT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_count BIGINT;
  -- UTC hour bucket, e.g. '2026-09-08T14'. The extension's getPeriodKey builds
  -- its month/day keys in UTC too, so the hour bucket nests inside the day
  -- bucket the caller named (bar a clock skew of seconds at the boundary).
  v_hour_key TEXT := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Usage only ever goes up; caps reset by period_key rollover, never by
  -- clients decrementing. The upper bound stops absurd single-call jumps.
  IF p_delta IS NULL OR p_delta < 1 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid delta';
  END IF;

  -- Keys are short machine identifiers ("crosslists_per_month", "2026-08"),
  -- not free text. Blocks junk-row flooding with arbitrary strings.
  IF p_feature IS NULL OR p_feature !~ '^[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'invalid feature';
  END IF;
  IF p_period_key IS NULL OR p_period_key !~ '^[A-Za-z0-9_-]{1,32}$' THEN
    RAISE EXCEPTION 'invalid period key';
  END IF;
  -- Hour buckets are written by this function only. A caller naming one
  -- would book the same action into the hourly series twice.
  IF p_period_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}$' THEN
    RAISE EXCEPTION 'invalid period key';
  END IF;

  -- Row-count guard, checked only when this call would create a NEW row so
  -- existing counters keep incrementing even at the cap. Hour rows are not
  -- counted here: they are bounded by the 60-day purge and their own cap
  -- below, and counting them would exhaust this cap in weeks.
  IF NOT EXISTS (
    SELECT 1 FROM usage_counters
    WHERE user_id = v_user_id AND feature = p_feature AND period_key = p_period_key
  ) AND (
    SELECT count(*) FROM usage_counters
    WHERE user_id = v_user_id
      AND period_key !~ '^\d{4}-\d{2}-\d{2}T\d{2}$'
  ) >= 2000 THEN
    RAISE EXCEPTION 'counter row limit reached';
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
  VALUES (v_user_id, p_feature, p_period_key, p_delta, NOW())
  ON CONFLICT (user_id, feature, period_key) DO UPDATE
    SET count = usage_counters.count + p_delta,
        updated_at = NOW()
  RETURNING count INTO v_new_count;

  -- Hour bucket. Soft cap of 10000 hour rows per user (60 days x 24 hours x a
  -- handful of features is well under it); at the cap the hour write is
  -- skipped rather than raised, so the primary counter, which the caps and
  -- the caller depend on, is never blocked by the analytics series.
  IF EXISTS (
    SELECT 1 FROM usage_counters
    WHERE user_id = v_user_id AND feature = p_feature AND period_key = v_hour_key
  ) OR (
    SELECT count(*) FROM usage_counters
    WHERE user_id = v_user_id
      AND period_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}$'
  ) < 10000 THEN
    INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
    VALUES (v_user_id, p_feature, v_hour_key, p_delta, NOW())
    ON CONFLICT (user_id, feature, period_key) DO UPDATE
      SET count = usage_counters.count + p_delta,
          updated_at = NOW();
  END IF;

  RETURN v_new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) TO authenticated;

-- =============================================================================
-- 2. Retention - hour rows live 60 days, everything else keeps 14 months
-- =============================================================================
-- The hour series will outnumber the month/day rows many times over, so the
-- purge gets a partial index on exactly the rows it deletes.

CREATE INDEX IF NOT EXISTS idx_usage_counters_hour_updated_at
  ON public.usage_counters(updated_at)
  WHERE period_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}$';

CREATE OR REPLACE FUNCTION public.purge_stale_usage_counters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.usage_counters
  WHERE updated_at < now() - interval '14 months'
     OR (
       period_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}$'
       AND updated_at < now() - interval '60 days'
     );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_stale_usage_counters() FROM PUBLIC, anon, authenticated;
