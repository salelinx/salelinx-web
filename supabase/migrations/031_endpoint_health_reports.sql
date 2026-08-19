-- Delivery log for endpoint health telemetry.
--
-- endpoint_health (030) answers "which endpoints are failing". It cannot answer
-- "is anything reporting at all", and those are different questions: an empty
-- dashboard looks identical whether every endpoint is healthy, no build has
-- shipped, every install is signed out, or the ingest is silently rejecting
-- every row. That ambiguity already cost real debugging time.
--
-- This table records one row per accepted report, so the admin console can show
-- the arrival rate and the accept/reject split. If reports are landing but
-- rejected == entries, the payload shape is wrong. If nothing is landing at
-- all, the problem is upstream of the server entirely.
--
-- Same privacy contract as 030: NO user_id, and nothing per-endpoint here -
-- just counts and the extension version. See docs/GDPR.md.

CREATE TABLE IF NOT EXISTS public.endpoint_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Counter rows the client sent, vs rows the ingest RPC actually stored.
  -- A gap means validation dropped entries: wrong platform, unknown outcome,
  -- a count over the per-counter cap, or an over-long key.
  entries_sent INT NOT NULL CHECK (entries_sent >= 0),
  entries_accepted INT NOT NULL CHECK (entries_accepted >= 0),
  -- Total API calls represented by this batch (sum of the counters), which is
  -- what makes the volume readable: 40 counters could be 40 calls or 40,000.
  calls_reported INT NOT NULL DEFAULT 0 CHECK (calls_reported >= 0),
  extension_version TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS endpoint_health_reports_received_idx
  ON public.endpoint_health_reports (received_at DESC);

ALTER TABLE public.endpoint_health_reports ENABLE ROW LEVEL SECURITY;

-- Same posture as endpoint_health: zero policies, so RLS denies anon and
-- authenticated everything. Writes come from the service role, reads go through
-- the admin RPC below.
REVOKE ALL ON TABLE public.endpoint_health_reports FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- record_endpoint_health_report() - called by report-telemetry after ingest
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_endpoint_health_report(
  p_entries_sent INT,
  p_entries_accepted INT,
  p_calls_reported INT,
  p_extension_version TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.endpoint_health_reports (
    entries_sent, entries_accepted, calls_reported, extension_version
  )
  VALUES (
    GREATEST(COALESCE(p_entries_sent, 0), 0),
    GREATEST(COALESCE(p_entries_accepted, 0), 0),
    GREATEST(COALESCE(p_calls_reported, 0), 0),
    LEFT(COALESCE(NULLIF(p_extension_version, ''), 'unknown'), 20)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_endpoint_health_report(INT, INT, INT, TEXT)
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- admin_endpoint_health_reports() - the admin console's delivery view
-- =============================================================================
-- Bucketed by hour rather than row-per-report: the useful read is "are reports
-- still arriving, and are they being accepted", not the individual rows.

CREATE OR REPLACE FUNCTION public.admin_endpoint_health_reports(p_hours INT DEFAULT 168)
RETURNS TABLE (
  bucket_hour TIMESTAMPTZ,
  reports BIGINT,
  entries_sent BIGINT,
  entries_accepted BIGINT,
  calls_reported BIGINT,
  versions TEXT[]
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

  p_hours := LEAST(GREATEST(COALESCE(p_hours, 168), 1), 2160);

  RETURN QUERY
  SELECT
    date_trunc('hour', r.received_at) AS bucket_hour,
    count(*) AS reports,
    SUM(r.entries_sent) AS entries_sent,
    SUM(r.entries_accepted) AS entries_accepted,
    SUM(r.calls_reported) AS calls_reported,
    array_agg(DISTINCT r.extension_version) AS versions
  FROM public.endpoint_health_reports r
  WHERE r.received_at >= NOW() - (p_hours * INTERVAL '1 hour')
  GROUP BY 1
  ORDER BY 1 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_endpoint_health_reports(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_endpoint_health_reports(INT) TO authenticated;

-- =============================================================================
-- Retention
-- =============================================================================
-- Folded into the existing prune so there is one job to schedule, not two.

CREATE OR REPLACE FUNCTION public.prune_endpoint_health()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT := 0;
BEGIN
  DELETE FROM public.endpoint_health
  WHERE bucket_hour < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.endpoint_health_reports
  WHERE received_at < NOW() - INTERVAL '90 days';

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_endpoint_health() FROM PUBLIC, anon, authenticated;
