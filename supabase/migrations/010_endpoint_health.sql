-- Passive endpoint health telemetry + delivery log + public status read.
--
-- Consolidated baseline (September 2026). Net result of the original
-- migrations 030 (counters + admin reads), 031 (delivery log + combined
-- prune) and 032 (anonymous status-page read). Full history in git.
--
-- The problem: every marketplace endpoint the extension depends on (Vinted and
-- Depop) requires a live logged-in browser session - CSRF token captured by the
-- webRequest listener, session cookies via the MAIN-world bridge, a real tab,
-- and clearance past DataDome. No server can probe them. The signal already
-- exists: our users make those exact calls, authenticated, from residential
-- IPs, all day; vintedFetch/depopFetch already classify the outcomes. This is
-- where those outcomes land, pre-aggregated client-side into daily batches.
--
-- Detection is by CROSS-USER aggregation: one session failing is a blocked
-- user; 400 sessions failing the same endpoint within an hour is the
-- marketplace shipping a breaking change.
--
-- DELIBERATELY NO user_id. These are counters, not events. That keeps the
-- table non-personal: nothing to include in the ROPA, nothing for the deletion
-- runbook in docs/GDPR.md to erase, and no consent gate - which matters,
-- because a consent gate would put holes in exactly the data we least want
-- holes in. The cost is accepted: we can see "the drafts endpoint is failing",
-- never "user X is failing".
--
-- Retention is 90 days (prune_endpoint_health below). pg_cron cannot be
-- scheduled from a migration on a project where the extension is off; see
-- README.md "Post-apply steps".

-- =============================================================================
-- 1. endpoint_health - one row per (endpoint, outcome, hour) per report
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.endpoint_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Normalized endpoint key, e.g. 'vinted:POST /api/v2/item_upload/drafts'.
  -- Interpolated path segments are collapsed to :id client-side so the key is
  -- stable across users and days. See normalizeEndpointKey in the extension.
  endpoint_key TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('vinted', 'depop')),
  -- Outcome bucket. Only client_error and server_error indicate a BROKEN
  -- endpoint; the rest are user-session conditions that must not raise alerts:
  --   ok            2xx
  --   client_error  400/422 - the schema-drift signal, the one that matters
  --   server_error  5xx
  --   network       status 0, timeout, dead content script
  --   auth          401/403, NOT_LOGGED_IN, VINTED_NO_CSRF - user must log in
  --   blocked       DataDome / CAPTCHA - anti-bot, not a broken endpoint
  --   no_tab        NO_VINTED_TAB / NO_DEPOP_TAB - never left the browser
  outcome TEXT NOT NULL CHECK (outcome IN (
    'ok', 'client_error', 'server_error', 'network', 'auth', 'blocked', 'no_tab'
  )),
  -- Most common HTTP status in this bucket, for triage (422 vs 400 matters).
  status_code INT,
  count INT NOT NULL CHECK (count > 0),
  -- Distinct-installs contribution is always 1 per report; summing it gives the
  -- install count behind a failure rate. This is what separates "one blocked
  -- user" from "the endpoint is down" and it is why an anonymous counter table
  -- is still enough to make the call.
  extension_version TEXT NOT NULL,
  -- Hour bucket the calls happened in (client clock, truncated). Kept separate
  -- from received_at so a delayed report still lands in the right bucket.
  bucket_hour TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The dashboard and the alert job both scan "recent rows, grouped by endpoint",
-- so the index leads with time. bucket_hour DESC matches the ORDER BY.
CREATE INDEX IF NOT EXISTS endpoint_health_bucket_idx
  ON public.endpoint_health (bucket_hour DESC);

-- Per-endpoint history (the sparkline and the baseline comparison) filters by
-- key first, then time.
CREATE INDEX IF NOT EXISTS endpoint_health_key_bucket_idx
  ON public.endpoint_health (endpoint_key, bucket_hour DESC);

ALTER TABLE public.endpoint_health ENABLE ROW LEVEL SECURITY;

-- No policies at all: this table is write-only from the service role (the
-- report-telemetry Edge Function) and read-only through the RPCs below. RLS
-- with zero policies denies everything to anon and authenticated, which is
-- exactly right - an extension client must never read aggregate health data,
-- only contribute to it. The table-level revoke is belt-and-braces so a
-- future "just for admins" policy cannot silently inherit default grants.

REVOKE ALL ON TABLE public.endpoint_health FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 2. record_endpoint_health() - ingest, service-role only
-- =============================================================================
-- Takes the whole batch as one JSONB array so a daily report is a single round
-- trip rather than N inserts. Invalid entries are skipped rather than failing
-- the batch: a malformed row from an old extension build must not cost us the
-- good rows reported alongside it.
--
-- SECURITY DEFINER + revoked from PUBLIC/anon/authenticated: the Edge Function
-- holds the service role key and is the only caller. The extension never talks
-- to this function directly, it POSTs to the Edge Function, which validates.

CREATE OR REPLACE FUNCTION public.record_endpoint_health(p_batch JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
BEGIN
  INSERT INTO public.endpoint_health (
    endpoint_key, platform, outcome, status_code, count,
    extension_version, bucket_hour
  )
  SELECT
    e->>'endpoint_key',
    e->>'platform',
    e->>'outcome',
    NULLIF(e->>'status_code', '')::INT,
    (e->>'count')::INT,
    e->>'extension_version',
    -- Clamp the client-supplied hour into a sane window. A device with a badly
    -- wrong clock would otherwise poison the baseline (a bucket years in the
    -- future never ages out of the "recent" window and skews every rate).
    GREATEST(
      LEAST(date_trunc('hour', (e->>'bucket_hour')::TIMESTAMPTZ), date_trunc('hour', NOW())),
      date_trunc('hour', NOW() - INTERVAL '7 days')
    )
  FROM jsonb_array_elements(p_batch) AS e
  WHERE e ? 'endpoint_key'
    AND e ? 'platform'
    AND e ? 'outcome'
    AND e ? 'count'
    AND e ? 'extension_version'
    AND e ? 'bucket_hour'
    AND e->>'platform' IN ('vinted', 'depop')
    AND e->>'outcome' IN (
      'ok', 'client_error', 'server_error', 'network', 'auth', 'blocked', 'no_tab'
    )
    AND (e->>'count') ~ '^[0-9]+$'
    AND (e->>'count')::INT > 0
    -- Cap a single report's contribution. Without this one client could claim
    -- millions of calls and dominate the aggregate on its own.
    AND (e->>'count')::INT <= 100000
    AND length(e->>'endpoint_key') <= 200
    AND length(e->>'extension_version') <= 20;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- No GRANT follows: service_role bypasses grants.
REVOKE ALL ON FUNCTION public.record_endpoint_health(JSONB) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 3. admin_endpoint_health() - the dashboard's main read
-- =============================================================================
-- Returns one row per endpoint for the recent window, with the failure rate now
-- and the same rate over the preceding baseline window. The comparison is the
-- product: a flat "alert over 50% failures" either spams (for endpoints that
-- are legitimately noisy) or stays silent while a normally-perfect endpoint
-- breaks. Deviation from an endpoint's OWN norm is the signal.
--
-- Only client_error / server_error / network count as failures. auth, blocked
-- and no_tab are user-session conditions - counting them would make DataDome
-- pressure look identical to a broken endpoint, which is the single easiest way
-- to make this whole system untrustworthy.

CREATE OR REPLACE FUNCTION public.admin_endpoint_health(
  p_window_hours INT DEFAULT 24,
  p_baseline_hours INT DEFAULT 168
)
RETURNS TABLE (
  endpoint_key TEXT,
  platform TEXT,
  total_calls BIGINT,
  failures BIGINT,
  failure_rate NUMERIC,
  baseline_rate NUMERIC,
  installs BIGINT,
  top_status INT,
  last_seen TIMESTAMPTZ
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

  -- Clamp so a crafted argument cannot turn the dashboard into a full scan.
  p_window_hours := LEAST(GREATEST(COALESCE(p_window_hours, 24), 1), 720);
  p_baseline_hours := LEAST(GREATEST(COALESCE(p_baseline_hours, 168), 1), 2160);

  RETURN QUERY
  WITH recent AS (
    SELECT * FROM public.endpoint_health
    WHERE bucket_hour >= NOW() - (p_window_hours * INTERVAL '1 hour')
  ),
  -- Baseline EXCLUDES the recent window, otherwise a live outage drags the
  -- baseline up toward itself and the deviation vanishes as it worsens.
  baseline AS (
    SELECT * FROM public.endpoint_health
    WHERE bucket_hour <  NOW() - (p_window_hours * INTERVAL '1 hour')
      AND bucket_hour >= NOW() - (p_baseline_hours * INTERVAL '1 hour')
  ),
  recent_agg AS (
    SELECT
      r.endpoint_key,
      MAX(r.platform) AS platform,
      SUM(r.count) AS total_calls,
      SUM(r.count) FILTER (
        WHERE r.outcome IN ('client_error', 'server_error', 'network')
      ) AS failures,
      COUNT(*) FILTER (
        WHERE r.outcome IN ('client_error', 'server_error', 'network')
      ) AS install_reports,
      MAX(r.bucket_hour) AS last_seen
    FROM recent r
    GROUP BY r.endpoint_key
  ),
  -- Failing-status totals per endpoint, for triage: a wall of 422s reads very
  -- differently from a wall of 503s.
  status_totals AS (
    SELECT
      r.endpoint_key,
      r.status_code,
      SUM(r.count) AS status_calls
    FROM recent r
    WHERE r.outcome IN ('client_error', 'server_error')
      AND r.status_code IS NOT NULL
    GROUP BY r.endpoint_key, r.status_code
  ),
  -- Most frequent failing status per endpoint. ROW_NUMBER rather than
  -- DISTINCT ON + GROUP BY: the aggregate has to be materialised before it can
  -- be ranked, and splitting the two makes that ordering explicit.
  recent_status AS (
    SELECT st.endpoint_key, st.status_code
    FROM (
      SELECT
        st0.endpoint_key,
        st0.status_code,
        ROW_NUMBER() OVER (
          PARTITION BY st0.endpoint_key
          ORDER BY st0.status_calls DESC, st0.status_code
        ) AS rn
      FROM status_totals st0
    ) st
    WHERE st.rn = 1
  ),
  baseline_agg AS (
    SELECT
      b.endpoint_key,
      SUM(b.count) AS total_calls,
      SUM(b.count) FILTER (
        WHERE b.outcome IN ('client_error', 'server_error', 'network')
      ) AS failures
    FROM baseline b
    GROUP BY b.endpoint_key
  )
  SELECT
    ra.endpoint_key,
    ra.platform,
    ra.total_calls,
    COALESCE(ra.failures, 0),
    ROUND(COALESCE(ra.failures, 0)::NUMERIC / NULLIF(ra.total_calls, 0) * 100, 1),
    ROUND(COALESCE(ba.failures, 0)::NUMERIC / NULLIF(ba.total_calls, 0) * 100, 1),
    ra.install_reports,
    rs.status_code,
    ra.last_seen
  FROM recent_agg ra
  LEFT JOIN baseline_agg ba ON ba.endpoint_key = ra.endpoint_key
  LEFT JOIN recent_status rs ON rs.endpoint_key = ra.endpoint_key
  ORDER BY
    -- Broken things first, then by traffic so the big endpoints lead.
    (COALESCE(ra.failures, 0)::NUMERIC / NULLIF(ra.total_calls, 0)) DESC NULLS LAST,
    ra.total_calls DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_endpoint_health(INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_endpoint_health(INT, INT) TO authenticated;

-- =============================================================================
-- 4. admin_endpoint_health_history() - the per-endpoint sparkline
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_endpoint_health_history(
  p_endpoint_key TEXT,
  p_days INT DEFAULT 14
)
RETURNS TABLE (
  day DATE,
  total_calls BIGINT,
  failures BIGINT,
  failure_rate NUMERIC
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

  p_days := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);

  RETURN QUERY
  SELECT
    date_trunc('day', h.bucket_hour)::DATE AS day,
    SUM(h.count) AS total_calls,
    SUM(h.count) FILTER (
      WHERE h.outcome IN ('client_error', 'server_error', 'network')
    ) AS failures,
    ROUND(
      SUM(h.count) FILTER (
        WHERE h.outcome IN ('client_error', 'server_error', 'network')
      )::NUMERIC / NULLIF(SUM(h.count), 0) * 100, 1
    ) AS failure_rate
  FROM public.endpoint_health h
  WHERE h.endpoint_key = p_endpoint_key
    AND h.bucket_hour >= NOW() - (p_days * INTERVAL '1 day')
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_endpoint_health_history(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_endpoint_health_history(TEXT, INT) TO authenticated;

-- =============================================================================
-- 5. endpoint_health_reports - delivery log (original 031)
-- =============================================================================
-- endpoint_health answers "which endpoints are failing". It cannot answer "is
-- anything reporting at all", and those are different questions: an empty
-- dashboard looks identical whether every endpoint is healthy, no build has
-- shipped, every install is signed out, or the ingest is silently rejecting
-- every row. One row per accepted report, so the console can show the arrival
-- rate and the accept/reject split. Same privacy contract: NO user_id, and
-- nothing per-endpoint here - just counts and the extension version.

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

REVOKE ALL ON TABLE public.endpoint_health_reports FROM PUBLIC, anon, authenticated;

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
-- 6. public_endpoint_health() - anonymous read for /docs/status (original 032)
-- =============================================================================
-- admin_endpoint_health() cannot serve the public status page: it re-checks
-- is_admin(), which additionally requires AAL2. This is a separate,
-- deliberately narrower function for anonymous callers:
--   * endpoint_health carries NO user_id, so there is nothing personal here.
--   * Only aggregate columns, and only outcomes that describe an ENDPOINT
--     failing - the page can never turn one user's CAPTCHA wall into a public
--     claim about Vinted being down.
--   * No status codes, no per-report rows, no extension versions. Those are
--     triage detail for the admin console, not facts a competitor should be
--     able to poll.
-- The public thresholds deliberately live in lib/docs/feature-status.ts, so
-- tuning them is a deploy rather than a migration; this just returns counts.

CREATE OR REPLACE FUNCTION public.public_endpoint_health(p_window_hours INT DEFAULT 48)
RETURNS TABLE (
  endpoint_key TEXT,
  platform TEXT,
  total_calls BIGINT,
  failures BIGINT,
  failure_rate NUMERIC,
  installs BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clamp: this is an anonymous, cacheable endpoint, so the window must not be
  -- usable to force an unbounded scan.
  p_window_hours := LEAST(GREATEST(COALESCE(p_window_hours, 48), 1), 168);

  RETURN QUERY
  WITH recent AS (
    SELECT * FROM public.endpoint_health
    WHERE bucket_hour >= NOW() - (p_window_hours * INTERVAL '1 hour')
  )
  SELECT
    r.endpoint_key,
    MAX(r.platform) AS platform,
    SUM(r.count) AS total_calls,
    COALESCE(
      SUM(r.count) FILTER (
        WHERE r.outcome IN ('client_error', 'server_error', 'network')
      ),
      0
    ) AS failures,
    ROUND(
      COALESCE(
        SUM(r.count) FILTER (
          WHERE r.outcome IN ('client_error', 'server_error', 'network')
        ),
        0
      )::NUMERIC / NULLIF(SUM(r.count), 0) * 100,
      1
    ) AS failure_rate,
    -- Report rows behind the failures, used as the install floor. Counting
    -- rows rather than a distinct id because there is no id to count: the
    -- table is anonymous by design, and one row is one install's hour bucket.
    COUNT(*) FILTER (
      WHERE r.outcome IN ('client_error', 'server_error', 'network')
    ) AS installs
  FROM recent r
  GROUP BY r.endpoint_key;
END;
$$;

-- Anonymous by design: the status page is public and rendered without a
-- session.
REVOKE ALL ON FUNCTION public.public_endpoint_health(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_endpoint_health(INT) TO anon, authenticated;

-- =============================================================================
-- 7. prune_endpoint_health() - 90 day retention (final form, original 031)
-- =============================================================================
-- Prunes both tables so there is one job to schedule, not two.

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
