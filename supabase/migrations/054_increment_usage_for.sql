-- increment_usage_counter for a named user, for the server only.
--
-- increment_usage_counter (017) counts for auth.uid(), the caller's own login. The Shopify app's
-- page in a store's admin lists a product on eBay with no SaleLinx login (the ebay function's
-- shopifyListing acts for the account the store is connected to), so the function counts that
-- crosslist with the service role, naming the user. Same body as 017's, with p_user_id in place of
-- auth.uid(); only service_role may run it, so no one can count for someone else.
--
-- One transaction, so a failure changes nothing.

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_usage_counter_for(
  p_user_id UUID,
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
  v_new_count BIGINT;
  v_hour_key TEXT := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24');
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'no user';
  END IF;
  IF p_delta IS NULL OR p_delta < 1 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid delta';
  END IF;
  IF p_feature IS NULL OR p_feature !~ '^[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'invalid feature';
  END IF;
  IF p_period_key IS NULL OR p_period_key !~ '^[A-Za-z0-9_-]{1,32}$' THEN
    RAISE EXCEPTION 'invalid period key';
  END IF;
  IF p_period_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}$' THEN
    RAISE EXCEPTION 'invalid period key';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usage_counters
    WHERE user_id = p_user_id AND feature = p_feature AND period_key = p_period_key
  ) AND (
    SELECT count(*) FROM usage_counters
    WHERE user_id = p_user_id
      AND period_key !~ '^\d{4}-\d{2}-\d{2}T\d{2}$'
  ) >= 2000 THEN
    RAISE EXCEPTION 'counter row limit reached';
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
  VALUES (p_user_id, p_feature, p_period_key, p_delta, NOW())
  ON CONFLICT (user_id, feature, period_key) DO UPDATE
    SET count = usage_counters.count + p_delta,
        updated_at = NOW()
  RETURNING count INTO v_new_count;

  IF EXISTS (
    SELECT 1 FROM usage_counters
    WHERE user_id = p_user_id AND feature = p_feature AND period_key = v_hour_key
  ) OR (
    SELECT count(*) FROM usage_counters
    WHERE user_id = p_user_id
      AND period_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}$'
  ) < 10000 THEN
    INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
    VALUES (p_user_id, p_feature, v_hour_key, p_delta, NOW())
    ON CONFLICT (user_id, feature, period_key) DO UPDATE
      SET count = usage_counters.count + p_delta,
          updated_at = NOW();
  END IF;

  IF (
    SELECT count(*) FROM usage_events
    WHERE user_id = p_user_id AND occurred_at > now() - interval '1 hour'
  ) < 2000 THEN
    INSERT INTO public.usage_events (user_id, feature, delta)
    VALUES (p_user_id, p_feature, p_delta::integer);
  END IF;

  RETURN v_new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage_counter_for(UUID, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage_counter_for(UUID, TEXT, TEXT, BIGINT)
  TO service_role;

COMMIT;
