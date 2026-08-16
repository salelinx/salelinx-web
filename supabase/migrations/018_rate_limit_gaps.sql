-- Close the remaining rate-limit gaps (014 covered ticket creation):
--   1. support_ticket_replies had no cap - each user reply fans out to a
--      staff email, so an open ticket was still an email-spam vector.
--   2. usage_counters could grow without bound: per-call deltas and key
--      shapes are validated (012), but nothing stopped a user accumulating
--      unlimited distinct rows, and legit daily-period rows never expired.
--
-- HISTORY: this file was originally numbered 015 and collided with
-- 015_device_sessions. `db push` silently applied only one of the two, so on
-- the live project these objects were applied by hand and the file renumbered
-- to 018. The DDL below is now fully idempotent (IF NOT EXISTS / DROP-then-
-- CREATE) so re-running over the manually-applied objects is a no-op.

-- =============================================================================
-- 1. Reply rate limit - 20 non-admin replies per user per rolling 24h
-- =============================================================================
-- Loose enough that a real back-and-forth never notices; admin replies are
-- exempt (staff answering many tickets must not be throttled).

CREATE INDEX IF NOT EXISTS idx_ticket_replies_user_created
  ON public.support_ticket_replies(user_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_support_reply_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*) FROM support_ticket_replies
    WHERE user_id = NEW.user_id
      AND is_admin = FALSE
      AND created_at > now() - interval '24 hours'
  ) >= 20 THEN
    RAISE EXCEPTION 'support_reply_daily_limit'
      USING HINT = 'You have sent a lot of replies today. Please wait for the team to respond.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_support_reply_limits ON public.support_ticket_replies;
CREATE TRIGGER trg_enforce_support_reply_limits
  BEFORE INSERT ON public.support_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_support_reply_limits();

-- =============================================================================
-- 2. usage_counters growth guard + retention
-- =============================================================================
-- New rows only: incrementing an existing counter must never fail at the cap,
-- or metering itself would break. 2000 rows is roughly a decade of legitimate
-- daily+monthly counters, far above anything real.

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

  -- Row-count guard, checked only when this call would create a NEW row so
  -- existing counters keep incrementing even at the cap.
  IF NOT EXISTS (
    SELECT 1 FROM usage_counters
    WHERE user_id = v_user_id AND feature = p_feature AND period_key = p_period_key
  ) AND (
    SELECT count(*) FROM usage_counters WHERE user_id = v_user_id
  ) >= 2000 THEN
    RAISE EXCEPTION 'counter row limit reached';
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
  VALUES (v_user_id, p_feature, p_period_key, p_delta, NOW())
  ON CONFLICT (user_id, feature, period_key) DO UPDATE
    SET count = usage_counters.count + p_delta,
        updated_at = NOW()
  RETURNING count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- Retention: counter rows are only ever read for the current period (caps)
-- or recent history; anything untouched for 14 months is dead weight. Same
-- pg_cron pattern as purge_old_support_tickets (007).

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
  WHERE updated_at < now() - interval '14 months';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_stale_usage_counters() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-stale-usage-counters',
      '43 3 * * *',
      'SELECT public.purge_stale_usage_counters()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule purge_stale_usage_counters() manually.';
  END IF;
END;
$$;
