-- Crash health counters + admin read.
--
-- Consolidated baseline (September 2026). Net result of the original
-- migrations 036 (table + ingest + prune) and 037 (admin read RPC). Full
-- history in git.
--
-- Endpoint health (010_endpoint_health.sql) tells us when Depop or Vinted
-- breaks. Nothing tells us when OUR code breaks: an uncaught error in the
-- panel, SW or popup after a release is invisible unless a user writes in.
-- This is the same idea pointed inward - anonymous daily counters, reported
-- through the same report-telemetry Edge Function and spam gate.
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

-- Writes only via the SECURITY DEFINER RPC below; reads via the admin RPC.
-- No policies on purpose.
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

-- Lock it to the service role explicitly.
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

-- =============================================================================
-- Admin read RPC for /admin/health (original 037)
-- =============================================================================
-- Same shape as admin_endpoint_health_reports: is_admin() gate, STABLE
-- SECURITY DEFINER, clamped window. Aggregates by context + kind + error name
-- so the dashboard answers "did the new build start throwing" at a glance.

CREATE OR REPLACE FUNCTION public.admin_crash_health(p_window_hours integer DEFAULT 168)
RETURNS TABLE(
  context text,
  kind text,
  error_name text,
  crashes bigint,
  versions text[],
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
    c.context,
    c.kind,
    c.error_name,
    SUM(c.count) AS crashes,
    array_agg(DISTINCT c.extension_version) AS versions,
    MAX(c.bucket_hour) AS last_seen
  FROM public.crash_health c
  WHERE c.bucket_hour >= NOW() - (p_window_hours * INTERVAL '1 hour')
  GROUP BY c.context, c.kind, c.error_name
  ORDER BY SUM(c.count) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_crash_health(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crash_health(integer) TO authenticated;
