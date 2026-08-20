-- =============================================================================
-- 036: Crash health counters
-- =============================================================================
-- Endpoint health (migration 030, remote) tells us when Depop or Vinted breaks.
-- Nothing tells us when OUR code breaks: an uncaught error in the panel, SW or
-- popup after a release is invisible unless a user writes in. This table is
-- the same idea pointed inward - anonymous daily counters, reported through
-- the same report-telemetry Edge Function and spam gate.
--
-- SAME PRIVACY CONTRACT AS endpoint_health, deliberately: no user_id, no
-- install id, and - the crash-specific part - NO ERROR MESSAGES OR STACK
-- TRACES. A message can embed anything that was being interpolated when the
-- code threw (listing titles, buyer names), which would turn this into
-- personal data. The extension sends only the error's constructor name
-- (TypeError, NetworkError), which is a closed vocabulary defined by the JS
-- engine. Do not widen these columns without revisiting docs/GDPR.md.

CREATE TABLE public.crash_health (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Which extension context threw: sw | panel | popup.
  context text NOT NULL CHECK (context IN ('sw', 'panel', 'popup')),
  -- 'error' (uncaught throw) or 'rejection' (unhandled promise rejection).
  kind text NOT NULL CHECK (kind IN ('error', 'rejection')),
  -- Error constructor name only - never the message, never the stack.
  error_name text NOT NULL CHECK (char_length(error_name) <= 40),
  count integer NOT NULL CHECK (count > 0),
  extension_version text NOT NULL CHECK (char_length(extension_version) <= 20),
  bucket_hour timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Reads happen via the service role (dashboard / future admin surface);
-- writes only via the SECURITY DEFINER RPC below. No policies on purpose.
ALTER TABLE public.crash_health ENABLE ROW LEVEL SECURITY;

CREATE INDEX crash_health_bucket_idx ON public.crash_health (bucket_hour);

-- Ingest RPC, called by report-telemetry with the service role. Mirrors
-- record_endpoint_health: validates every row, silently drops bad ones,
-- returns the number inserted, clamps client clocks into a sane window.
CREATE OR REPLACE FUNCTION public.record_crash_health(p_batch jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted INT := 0;
BEGIN
  INSERT INTO public.crash_health (
    context, kind, error_name, count, extension_version, bucket_hour
  )
  SELECT
    e->>'context',
    e->>'kind',
    e->>'error_name',
    (e->>'count')::INT,
    e->>'extension_version',
    GREATEST(
      LEAST(date_trunc('hour', (e->>'bucket_hour')::TIMESTAMPTZ), date_trunc('hour', NOW())),
      date_trunc('hour', NOW() - INTERVAL '7 days')
    )
  FROM jsonb_array_elements(p_batch) AS e
  WHERE e ? 'context'
    AND e ? 'kind'
    AND e ? 'error_name'
    AND e ? 'count'
    AND e ? 'extension_version'
    AND e ? 'bucket_hour'
    AND e->>'context' IN ('sw', 'panel', 'popup')
    AND e->>'kind' IN ('error', 'rejection')
    AND (e->>'count') ~ '^[0-9]+$'
    AND (e->>'count')::INT > 0
    -- One install cannot claim more than 10k crashes in a report; a genuine
    -- crash loop hits the extension-side counter cap long before this.
    AND (e->>'count')::INT <= 10000
    AND length(e->>'error_name') <= 40
    AND length(e->>'extension_version') <= 20;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- SECURITY DEFINER + CREATE OR REPLACE resets grants to PUBLIC (see the
-- 024 gotcha): lock it to the service role explicitly.
REVOKE EXECUTE ON FUNCTION public.record_crash_health(jsonb) FROM PUBLIC, anon, authenticated;

-- Same retention as endpoint health: 90 days, schedule alongside the other
-- prune jobs:
-- SELECT cron.schedule('prune-crash-health', '29 3 * * *',
--   'SELECT public.prune_crash_health()');
CREATE OR REPLACE FUNCTION public.prune_crash_health()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.crash_health WHERE bucket_hour < NOW() - INTERVAL '90 days';
$$;

REVOKE EXECUTE ON FUNCTION public.prune_crash_health() FROM PUBLIC, anon, authenticated;
