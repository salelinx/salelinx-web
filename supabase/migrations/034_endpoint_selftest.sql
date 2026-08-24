-- Admin endpoint self-test results.
--
-- Passive telemetry (030) answers "did something break overnight?" - it covers
-- every endpoint but only sees what users happen to do, and needs enough
-- traffic to be conclusive. This answers the complementary question, "is it
-- fixed RIGHT NOW?", by having an admin drive the endpoints on demand from
-- their own logged-in session.
--
-- WHY THIS IS A SEPARATE TABLE FROM endpoint_health, AND NOT A COLUMN ON IT:
-- endpoint_health deliberately has no user_id. That is what keeps it
-- non-personal - no ROPA entry, no deletion-runbook step, no consent gate (see
-- docs/GDPR.md). A self-test result is the opposite by nature: it is "admin X
-- ran this at time T", and the attribution is the point, since a run history
-- with no runner is not an audit trail. Adding user_id to endpoint_health would
-- have reversed all three properties for that dataset. So these live here, in
-- scope for the deletion runbook, while endpoint_health stays anonymous.
--
-- Self-test traffic is also EXCLUDED from endpoint_health at source: the
-- extension sets a suppression flag for the duration of a run
-- (setSelfTestActive in src/utils/telemetry/endpoint-health.ts). Without that,
-- deliberately probing a broken endpoint would inject failures into the
-- aggregates behind the public status page.

-- =============================================================================
-- 1. endpoint_selftest_runs - one row per run
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.endpoint_selftest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE is required by the account-deletion runbook in docs/GDPR.md: every
  -- user-owned table must drop its rows when the auth user goes.
  run_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extension_version TEXT NOT NULL,
  -- Runs are scoped to ONE marketplace: each needs its own logged-in tab, and
  -- a combined run would report a wall of no_tab results for whichever side is
  -- not open. See endpointsForScope() in the extension.
  platform TEXT NOT NULL CHECK (platform IN ('vinted', 'depop')),
  -- Whether the opt-in throwaway tier ran (creates and destroys a junk
  -- listing; on Vinted it is briefly published and buyer-visible). Recorded
  -- because it changes what a green result means.
  included_throwaway BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL,
  -- NULL while in flight, or if the run was abandoned. A run that never
  -- finished is itself a finding, so the row is written at start, not end.
  finished_at TIMESTAMPTZ,
  total INT NOT NULL DEFAULT 0 CHECK (total >= 0),
  passed INT NOT NULL DEFAULT 0 CHECK (passed >= 0),
  failed INT NOT NULL DEFAULT 0 CHECK (failed >= 0),
  skipped INT NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_selftest_runs_started
  ON public.endpoint_selftest_runs (started_at DESC);

-- =============================================================================
-- 2. endpoint_selftest_results - one row per endpoint per run
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.endpoint_selftest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL
    REFERENCES public.endpoint_selftest_runs(id) ON DELETE CASCADE,
  endpoint_key TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('vinted', 'depop')),
  -- The seven telemetry outcomes, plus two that only a self-test can produce:
  --   skipped  a dependency could not be resolved (no listing in the account,
  --            no sold order for a shipment id). NOT a failure - silence about
  --            an endpoint we could not reach is not evidence it is broken.
  --   not_run  deliberately excluded: terminal endpoints, or the throwaway
  --            tier when it was not opted into. Recorded so a green run cannot
  --            be misread as full coverage.
  outcome TEXT NOT NULL CHECK (outcome IN (
    'ok', 'client_error', 'server_error', 'network', 'auth', 'blocked',
    'no_tab', 'skipped', 'not_run'
  )),
  status_code INT,
  duration_ms INT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  -- Why it was skipped / not run. Never a response body: these endpoints return
  -- buyer names, addresses and message content, none of which belongs here
  -- (docs/GDPR.md - user UUIDs are the ceiling).
  note TEXT CHECK (note IS NULL OR length(note) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_selftest_results_run
  ON public.endpoint_selftest_results (run_id);

-- Deny-all: no policies. Every read and write goes through the SECURITY
-- DEFINER functions below, which re-check is_admin() (and therefore AAL2).
ALTER TABLE public.endpoint_selftest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_selftest_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.endpoint_selftest_runs
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.endpoint_selftest_results
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 3. record_selftest_run() - ingest, called by the Edge Function
-- =============================================================================
-- The Edge Function holds the service role key and has already verified the
-- caller's JWT AND their admin membership. This function re-checks admin
-- membership anyway rather than trusting the caller: it writes attributed rows,
-- so a mistake here forges an audit trail.
--
-- p_run_by is passed explicitly because the Edge Function calls with the
-- service role, where auth.uid() is NULL.

CREATE OR REPLACE FUNCTION public.record_selftest_run(
  p_run_by UUID,
  p_extension_version TEXT,
  p_platform TEXT,
  p_included_throwaway BOOLEAN,
  p_started_at TIMESTAMPTZ,
  p_finished_at TIMESTAMPTZ,
  p_results JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID;
  v_inserted INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_run_by) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_admin');
  END IF;

  IF p_platform NOT IN ('vinted', 'depop') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_platform');
  END IF;

  IF jsonb_typeof(p_results) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_results');
  END IF;

  -- Bound the batch: one run covers ~22 endpoints, so anything near this is a
  -- malformed or hostile payload.
  IF jsonb_array_length(p_results) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_results');
  END IF;

  INSERT INTO public.endpoint_selftest_runs (
    run_by, extension_version, platform, included_throwaway,
    started_at, finished_at
  )
  VALUES (
    p_run_by,
    left(p_extension_version, 20),
    p_platform,
    COALESCE(p_included_throwaway, FALSE),
    -- Clamp a bad device clock, same reasoning as record_endpoint_health.
    GREATEST(LEAST(p_started_at, NOW()), NOW() - INTERVAL '7 days'),
    LEAST(p_finished_at, NOW())
  )
  RETURNING id INTO v_run_id;

  INSERT INTO public.endpoint_selftest_results (
    run_id, endpoint_key, platform, outcome, status_code, duration_ms, note
  )
  SELECT
    v_run_id,
    left(r->>'endpoint_key', 200),
    p_platform,
    r->>'outcome',
    NULLIF(r->>'status_code', '')::INT,
    NULLIF(r->>'duration_ms', '')::INT,
    left(NULLIF(r->>'note', ''), 200)
  FROM jsonb_array_elements(p_results) AS r
  WHERE r ? 'endpoint_key'
    AND r ? 'outcome'
    AND r->>'outcome' IN (
      'ok', 'client_error', 'server_error', 'network', 'auth', 'blocked',
      'no_tab', 'skipped', 'not_run'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Counts derived server-side from the rows actually stored, not taken from
  -- the client. A client-supplied summary that disagreed with its own results
  -- would make the dashboard lie.
  UPDATE public.endpoint_selftest_runs r
  SET total = v_inserted,
      passed = (
        SELECT COUNT(*) FROM public.endpoint_selftest_results x
        WHERE x.run_id = v_run_id AND x.outcome = 'ok'
      ),
      failed = (
        SELECT COUNT(*) FROM public.endpoint_selftest_results x
        WHERE x.run_id = v_run_id
          AND x.outcome IN ('client_error', 'server_error', 'network')
      ),
      skipped = (
        SELECT COUNT(*) FROM public.endpoint_selftest_results x
        WHERE x.run_id = v_run_id
          AND x.outcome IN ('skipped', 'not_run', 'auth', 'blocked', 'no_tab')
      )
  WHERE r.id = v_run_id;

  RETURN jsonb_build_object('ok', true, 'run_id', v_run_id, 'inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.record_selftest_run(
  UUID, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 4. admin_selftest_runs() - run history for the console
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_selftest_runs(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  run_by UUID,
  extension_version TEXT,
  platform TEXT,
  included_throwaway BOOLEAN,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total INT,
  passed INT,
  failed INT,
  skipped INT
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

  RETURN QUERY
  SELECT r.id, r.run_by, r.extension_version, r.platform, r.included_throwaway,
         r.started_at, r.finished_at, r.total, r.passed, r.failed, r.skipped
  FROM public.endpoint_selftest_runs r
  ORDER BY r.started_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_selftest_runs(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_selftest_runs(INT) TO authenticated;

-- =============================================================================
-- 5. admin_selftest_results() - drill-down for one run
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_selftest_results(p_run_id UUID)
RETURNS TABLE (
  endpoint_key TEXT,
  platform TEXT,
  outcome TEXT,
  status_code INT,
  duration_ms INT,
  note TEXT
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

  RETURN QUERY
  SELECT x.endpoint_key, x.platform, x.outcome, x.status_code, x.duration_ms, x.note
  FROM public.endpoint_selftest_results x
  WHERE x.run_id = p_run_id
  -- Failures first: the reason anyone opens a run is to find what broke.
  ORDER BY
    CASE x.outcome
      WHEN 'client_error' THEN 0
      WHEN 'server_error' THEN 1
      WHEN 'network' THEN 2
      WHEN 'auth' THEN 3
      WHEN 'blocked' THEN 4
      WHEN 'no_tab' THEN 5
      WHEN 'skipped' THEN 6
      WHEN 'not_run' THEN 7
      ELSE 8
    END,
    x.endpoint_key;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_selftest_results(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_selftest_results(UUID) TO authenticated;

-- =============================================================================
-- 6. prune_endpoint_selftest() - retention
-- =============================================================================
-- 180 days: long enough to compare against the last time a feature was known
-- good, short enough that this stays small. Results cascade with their run.

CREATE OR REPLACE FUNCTION public.prune_endpoint_selftest()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.endpoint_selftest_runs
  WHERE started_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_endpoint_selftest()
  FROM PUBLIC, anon, authenticated;

-- Guarded, same pattern as 007 and 018: an unguarded cron.schedule fails the
-- whole migration on a database without pg_cron.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prune-endpoint-selftest',
      '30 3 * * *',
      'SELECT public.prune_endpoint_selftest()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule prune_endpoint_selftest() manually (see docs/GDPR.md)';
  END IF;
END;
$$;
