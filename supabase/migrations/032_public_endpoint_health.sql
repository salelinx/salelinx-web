-- Public read for the marketplace status page (/docs/status).
--
-- The existing admin_endpoint_health() cannot serve this: it re-checks
-- is_admin(), which additionally requires an AAL2 session. This is a separate,
-- deliberately narrower function for anonymous callers.
--
-- What it exposes, and why that is safe:
--   * endpoint_health carries NO user_id and never has (migration 030), so
--     there is nothing personal to leak here in the first place.
--   * Only aggregate columns, and only outcomes that describe an ENDPOINT
--     failing. auth / blocked / no_tab are per-user session conditions and are
--     excluded, so the page can never turn one user's CAPTCHA wall into a
--     public claim about Vinted being down.
--   * No status codes, no per-report rows, no extension versions. Those are
--     triage detail for the admin console, not facts a competitor should be
--     able to poll.
--
-- What it deliberately does NOT do: apply the public thresholds. Those live in
-- lib/docs/feature-status.ts next to the feature map, so tuning them is a
-- deploy rather than a migration. This function just returns the counts.

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
-- session. CREATE OR REPLACE resets grants to EXECUTE-to-PUBLIC, so revoke
-- first and grant explicitly (see CLAUDE.md).
REVOKE ALL ON FUNCTION public.public_endpoint_health(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_endpoint_health(INT) TO anon, authenticated;
