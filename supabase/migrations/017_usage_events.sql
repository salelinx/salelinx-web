-- Usage events: one row per increment_usage_counter call, for the admin
-- console's trailing-window presets (last 5 / 15 / 30 minutes, last 1 to 72
-- hours).
--
-- usage_counters holds running totals per bucket (month, day, and since 016
-- the UTC hour), so the finest question it can answer is "how much in this
-- hour bucket". A "last 15 minutes" view needs to know WHEN each action
-- happened. This table records that: user, feature, the delta the call
-- carried, and the server clock. It is written by increment_usage_counter
-- itself, in the same call, so every extension build in the field feeds it
-- from the moment this is applied and no client can write to it directly.
--
-- Rows live 7 days (hourly purge). That is plenty for the 72-hour preset and
-- keeps the table small; anything older is answered by the hour buckets (60
-- days) or the day/month buckets. Per-user write guard: at most 2000 events
-- per rolling hour, above which the event insert is skipped (never raised) so
-- the primary counter, which caps depend on, is never blocked.
--
-- Personal data: user_id plus a timestamp per action. Listed in docs/GDPR.md;
-- cascades on account deletion via the FK.

-- =============================================================================
-- 1. Table
-- =============================================================================

CREATE TABLE public.usage_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta >= 1 AND delta <= 1000),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No client policies: only the SECURITY DEFINER functions below touch it.
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.usage_events FROM PUBLIC, anon, authenticated;

-- Admin reads scan a time window; the purge deletes by time; the write guard
-- counts one user's recent rows.
CREATE INDEX idx_usage_events_occurred_at
  ON public.usage_events(occurred_at);
CREATE INDEX idx_usage_events_user_occurred_at
  ON public.usage_events(user_id, occurred_at);

-- =============================================================================
-- 2. increment_usage_counter - also record the event
-- =============================================================================
-- Body is 016's (caller-supplied month/day bucket plus the server-derived hour
-- bucket) with the event insert appended.

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

  -- Event row (017). One per call, carrying the delta, so a bulk run of 200
  -- refreshes is one event of 200, not 200 events. Skipped, never raised, past
  -- 2000 events in the caller's rolling hour.
  IF (
    SELECT count(*) FROM usage_events
    WHERE user_id = v_user_id AND occurred_at > now() - interval '1 hour'
  ) < 2000 THEN
    INSERT INTO public.usage_events (user_id, feature, delta)
    VALUES (v_user_id, p_feature, p_delta::integer);
  END IF;

  RETURN v_new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) TO authenticated;

-- =============================================================================
-- 3. admin_list_usage_events(since, until) - totals per user and feature
-- =============================================================================
-- Same shape of answer as admin_list_usage (user, feature, count) so the usage
-- loader treats the two sources alike. The window is capped at 8 days so a
-- bad URL cannot ask for a scan the retention never intended.

CREATE OR REPLACE FUNCTION public.admin_list_usage_events(
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS TABLE (
  user_id UUID,
  feature TEXT,
  count BIGINT,
  last_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_since IS NULL OR p_until IS NULL OR p_until <= p_since
     OR p_until - p_since > interval '8 days' THEN
    RAISE EXCEPTION 'invalid window';
  END IF;

  RETURN QUERY
    SELECT
      e.user_id,
      e.feature,
      sum(e.delta)::BIGINT AS count,
      max(e.occurred_at) AS last_at
    FROM public.usage_events e
    WHERE e.occurred_at >= p_since AND e.occurred_at < p_until
    GROUP BY e.user_id, e.feature
    ORDER BY 3 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_usage_events(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_usage_events(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- =============================================================================
-- 4. Retention - 7 days, purged hourly
-- =============================================================================

CREATE OR REPLACE FUNCTION public.purge_stale_usage_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.usage_events
  WHERE occurred_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Service role / cron only.
REVOKE ALL ON FUNCTION public.purge_stale_usage_events() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-stale-usage-events',
      '17 * * * *',
      'SELECT public.purge_stale_usage_events()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule purge_stale_usage_events() manually.';
  END IF;
END;
$$;
