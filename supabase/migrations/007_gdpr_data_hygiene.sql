-- GDPR data hygiene (July 2026). See docs/GDPR.md for the runbooks that rely
-- on this migration.
--
-- 1. support_tickets.user_id gains ON DELETE CASCADE so deleting an auth user
--    (right to erasure) no longer fails on their tickets. Every other
--    user-owned table already cascades.
-- 2. listings.buyer_info is dropped. The extension never uploads it
--    (cloud-sync listingToCloud omits the field, cloudToListing nulls it) and
--    the privacy policy promises no buyer data is stored in the cloud.
-- 3. Closed support tickets are purged 24 months after their last update,
--    matching the retention period stated in the privacy policy. Scheduled
--    nightly via pg_cron when the extension is available.

-- =============================================================================
-- 1. Cascade user deletion into support_tickets
-- =============================================================================

ALTER TABLE public.support_tickets
  DROP CONSTRAINT support_tickets_user_id_fkey;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =============================================================================
-- 2. Drop the never-written buyer_info column
-- =============================================================================

ALTER TABLE public.listings DROP COLUMN IF EXISTS buyer_info;

-- =============================================================================
-- 3. Support ticket retention purge
-- =============================================================================
-- No GRANT to authenticated: only the service role or the cron job may run it.

CREATE OR REPLACE FUNCTION public.purge_old_support_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged INTEGER;
BEGIN
  DELETE FROM public.support_tickets
    WHERE status = 'closed'
      AND updated_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_support_tickets() FROM PUBLIC;

-- Schedule nightly at 03:17 UTC. Wrapped so the migration still succeeds on a
-- database without pg_cron; enable the extension in the Supabase dashboard
-- (Database > Extensions > pg_cron) and re-run this block if the NOTICE fires.
DO $$
BEGIN
  PERFORM cron.schedule(
    'purge-old-support-tickets',
    '17 3 * * *',
    $job$SELECT public.purge_old_support_tickets()$job$
  );
EXCEPTION WHEN invalid_schema_name OR undefined_function OR undefined_table THEN
  RAISE NOTICE 'pg_cron not available; schedule purge_old_support_tickets() manually (see docs/GDPR.md)';
END;
$$;
