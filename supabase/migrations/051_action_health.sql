-- Action health counters + admin read.
--
-- Endpoint health says a marketplace call failed; crash health says our code threw. Neither says
-- whether the thing a user pressed worked. The extension counts each reply its service worker
-- sends the panel (sendEbayMessage, ebayBuyLabel, getVintedConversations ...) and each finished
-- job as ok, failed or empty, and reports them in the same daily report-telemetry batch.
--
-- Same privacy contract as endpoint_health and crash_health: no user_id, no install id. `action`
-- is a handler or job name from the extension's code and `code` an error code from a closed
-- vocabulary, both checked against an identifier pattern, never a message.

CREATE TABLE public.action_health (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK (action ~ '^[A-Za-z][A-Za-z0-9_]{0,59}$'),
  platform text NOT NULL CHECK (platform IN ('', 'vinted', 'depop', 'ebay')),
  outcome text NOT NULL CHECK (outcome IN ('ok', 'failed', 'empty')),
  code text NOT NULL CHECK (code ~ '^([A-Za-z][A-Za-z0-9_]{0,39})?$'),
  count integer NOT NULL CHECK (count > 0),
  extension_version text NOT NULL CHECK (char_length(extension_version) <= 20),
  bucket_hour timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_health ENABLE ROW LEVEL SECURITY;

CREATE INDEX action_health_bucket_idx ON public.action_health (bucket_hour);

CREATE OR REPLACE FUNCTION public.record_action_health(p_batch jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted INT := 0;
BEGIN
  INSERT INTO public.action_health (
    action, platform, outcome, code, count, extension_version, bucket_hour
  )
  SELECT
    e->>'action',
    e->>'platform',
    e->>'outcome',
    e->>'code',
    (e->>'count')::INT,
    e->>'extension_version',
    GREATEST(
      LEAST(date_trunc('hour', (e->>'bucket_hour')::TIMESTAMPTZ), date_trunc('hour', NOW())),
      date_trunc('hour', NOW() - INTERVAL '7 days')
    )
  FROM jsonb_array_elements(p_batch) AS e
  WHERE e ? 'action'
    AND e ? 'platform'
    AND e ? 'outcome'
    AND e ? 'code'
    AND e ? 'count'
    AND e ? 'extension_version'
    AND e ? 'bucket_hour'
    AND e->>'action' ~ '^[A-Za-z][A-Za-z0-9_]{0,59}$'
    AND e->>'platform' IN ('', 'vinted', 'depop', 'ebay')
    AND e->>'outcome' IN ('ok', 'failed', 'empty')
    AND e->>'code' ~ '^([A-Za-z][A-Za-z0-9_]{0,39})?$'
    AND (e->>'count') ~ '^[0-9]+$'
    AND (e->>'count')::INT BETWEEN 1 AND 100000
    AND length(e->>'extension_version') <= 20;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_action_health(jsonb) FROM PUBLIC, anon, authenticated;

-- 90 days, scheduled alongside the other prune jobs:
-- SELECT cron.schedule('prune-action-health', '31 3 * * *',
--   'SELECT public.prune_action_health()');
CREATE OR REPLACE FUNCTION public.prune_action_health()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.action_health WHERE bucket_hour < NOW() - INTERVAL '90 days';
$$;

REVOKE EXECUTE ON FUNCTION public.prune_action_health() FROM PUBLIC, anon, authenticated;

-- One row per action, platform and version, so a release that broke an action shows as its
-- newest version failing where the one before did not.
CREATE OR REPLACE FUNCTION public.admin_action_health(p_window_hours integer DEFAULT 168)
RETURNS TABLE(
  action text,
  platform text,
  extension_version text,
  ok bigint,
  failed bigint,
  empty bigint,
  top_code text,
  last_seen timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  p_window_hours := LEAST(GREATEST(COALESCE(p_window_hours, 168), 1), 2160);

  RETURN QUERY
  SELECT
    a.action,
    a.platform,
    a.extension_version,
    COALESCE(SUM(a.count) FILTER (WHERE a.outcome = 'ok'), 0)::bigint,
    COALESCE(SUM(a.count) FILTER (WHERE a.outcome = 'failed'), 0)::bigint,
    COALESCE(SUM(a.count) FILTER (WHERE a.outcome = 'empty'), 0)::bigint,
    (SELECT f.code FROM public.action_health f
      WHERE f.action = a.action AND f.platform = a.platform
        AND f.extension_version = a.extension_version AND f.outcome = 'failed'
        AND f.bucket_hour >= NOW() - (p_window_hours * INTERVAL '1 hour')
      GROUP BY f.code ORDER BY SUM(f.count) DESC LIMIT 1),
    MAX(a.bucket_hour)
  FROM public.action_health a
  WHERE a.bucket_hour >= NOW() - (p_window_hours * INTERVAL '1 hour')
  GROUP BY a.action, a.platform, a.extension_version
  ORDER BY a.action, a.platform, a.extension_version DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_action_health(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_action_health(integer) TO authenticated;
