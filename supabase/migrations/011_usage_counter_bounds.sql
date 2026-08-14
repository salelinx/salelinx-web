-- Bound increment_usage_counter inputs.
--
-- The original RPC (002_billing_tiers.sql) accepted any BIGINT delta, so an
-- authenticated user could call it with a large negative number and reset
-- their own metered caps (crosslists_per_month etc.), and could insert
-- unbounded junk feature/period rows. Deltas are now 1..1000 and the key
-- shapes are validated. Grants are unchanged (CREATE OR REPLACE keeps them).

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

  INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
  VALUES (v_user_id, p_feature, p_period_key, p_delta, NOW())
  ON CONFLICT (user_id, feature, period_key) DO UPDATE
    SET count = usage_counters.count + p_delta,
        updated_at = NOW()
  RETURNING count INTO v_new_count;

  RETURN v_new_count;
END;
$$;
