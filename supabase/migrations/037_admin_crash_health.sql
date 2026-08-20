-- =============================================================================
-- 037: Admin read RPC for crash health
-- =============================================================================
-- Read side of crash_health (migration 036) for /admin/health. Same shape as
-- admin_endpoint_health_reports: is_admin() gate, STABLE SECURITY DEFINER,
-- clamped window. Aggregates by context + kind + error name so the dashboard
-- answers "did the new build start throwing" at a glance.

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

-- CREATE OR REPLACE resets grants to PUBLIC (024 gotcha): the RPC gates on
-- is_admin() internally, but keep the surface tight anyway.
REVOKE EXECUTE ON FUNCTION public.admin_crash_health(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crash_health(integer) TO authenticated;
