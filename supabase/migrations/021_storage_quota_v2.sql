-- Cloud storage quota v2: enforce on AFTER UPDATE, not BEFORE INSERT.
--
-- Background: 020_cloud_storage_quota.sql tried to reject oversize uploads
-- in a BEFORE INSERT trigger by reading NEW.metadata->>'size'. That never
-- worked because the Supabase Storage API writes the row in two steps:
--   1. INSERT storage.objects with empty/NULL metadata
--   2. PUT bytes to S3
--   3. UPDATE storage.objects with metadata.size populated
-- So the BEFORE INSERT trigger always saw size = NULL, coalesced it to 0,
-- and the `current + 0 > cap` check passed for every upload. The bucket
-- usage gauge also never grew, because AFTER INSERT read the same NULL.
--
-- Fix:
--   • BEFORE INSERT keeps a cheap "already over cap?" pre-flight so users
--     who are already maxed get rejected before the S3 PUT happens at all.
--     (No size check — we just reject any new file when bytes_used >= cap.)
--   • AFTER UPDATE is the new enforcement point. When metadata->>'size'
--     transitions from NULL → a number (Storage API finishing the write),
--     we bump user_storage by that size and raise if it tips over cap.
--     The RAISE rolls back the UPDATE; user_storage is left unchanged.
--   • AFTER INSERT becomes a no-op for size tracking (it was double-counting
--     against AFTER UPDATE in any environment where Storage does populate
--     metadata up-front, and noisy logging when it didn't). It stays
--     installed only as a placeholder so future changes have a clean slot.
--
-- After this migration, the file in S3 from a rejected upload may briefly
-- exist as an orphan (S3 PUT committed, storage.objects metadata UPDATE
-- rolled back, leaving a row with NULL metadata). Supabase's own bucket
-- consistency job cleans these up; if it becomes a real problem we can add
-- a periodic sweep in supabase/scripts/.

-- =============================================================================
-- 1. Replace BEFORE INSERT trigger function — cheap "already over cap" check
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_cloud_storage_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current BIGINT;
  v_cap BIGINT;
BEGIN
  IF NEW.bucket_id <> 'listing-images' THEN
    RETURN NEW;
  END IF;

  IF (storage.foldername(NEW.name))[1] !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NEW;
  END IF;
  v_user_id := (storage.foldername(NEW.name))[1]::UUID;

  v_cap := public.get_user_storage_cap(v_user_id);
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(bytes_used, 0) INTO v_current
  FROM public.user_storage
  WHERE user_id = v_user_id;

  -- Already at or over cap → reject without even trying. The actual size
  -- check happens after the Storage API populates metadata; this is just
  -- a fast-path for the obvious case.
  IF COALESCE(v_current, 0) >= v_cap THEN
    RAISE EXCEPTION 'cloud_storage_quota_exceeded'
      USING DETAIL = format('user=%s used=%s cap=%s', v_user_id, COALESCE(v_current, 0), v_cap);
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. AFTER INSERT becomes a no-op (kept installed for shape)
-- =============================================================================
-- The AFTER UPDATE trigger handles all size tracking now. Leaving the old
-- AFTER INSERT trigger in place would double-count in any environment where
-- the Storage API does write metadata in the initial INSERT.

CREATE OR REPLACE FUNCTION public.bump_user_storage_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

-- =============================================================================
-- 3. AFTER UPDATE — the real enforcement + tracking point
-- =============================================================================
-- Fires when metadata.size transitions from absent → present, OR when it
-- changes value (overwrite uploads). Bumps user_storage by the delta and
-- raises if the new total breaches cap.

CREATE OR REPLACE FUNCTION public.bump_user_storage_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_old_size BIGINT;
  v_new_size BIGINT;
  v_delta BIGINT;
  v_current BIGINT;
  v_cap BIGINT;
BEGIN
  IF NEW.bucket_id <> 'listing-images' THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(NEW.name))[1] !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  v_user_id := (storage.foldername(NEW.name))[1]::UUID;

  v_old_size := COALESCE((OLD.metadata->>'size')::BIGINT, 0);
  v_new_size := COALESCE((NEW.metadata->>'size')::BIGINT, 0);
  v_delta := v_new_size - v_old_size;
  IF v_delta = 0 THEN
    RETURN NULL;
  END IF;

  -- Apply the delta first so the cap check sees the post-write state.
  INSERT INTO public.user_storage (user_id, bytes_used, updated_at)
  VALUES (v_user_id, GREATEST(0, v_delta), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET bytes_used = GREATEST(0, public.user_storage.bytes_used + v_delta),
        updated_at = NOW()
  RETURNING bytes_used INTO v_current;

  v_cap := public.get_user_storage_cap(v_user_id);
  IF v_cap IS NULL THEN
    RETURN NULL; -- unlimited tier
  END IF;

  -- Tipped over the cap → roll back the metadata UPDATE. The S3 object may
  -- be left orphaned briefly; Supabase's storage consistency job sweeps it.
  IF v_current > v_cap THEN
    RAISE EXCEPTION 'cloud_storage_quota_exceeded'
      USING DETAIL = format(
        'user=%s used=%s delta=%s cap=%s', v_user_id, v_current, v_delta, v_cap
      );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_storage_track_update ON storage.objects;
CREATE TRIGGER user_storage_track_update
  AFTER UPDATE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_user_storage_on_update();

-- =============================================================================
-- 4. Re-backfill from scratch
-- =============================================================================
-- Since AFTER INSERT is now a no-op and AFTER UPDATE counts deltas, the
-- existing user_storage values are still correct from the v1 backfill — but
-- run a fresh sweep here to be safe. The regex guard skips any folder name
-- that isn't a UUID so legacy / debug uploads don't break the SUM.

INSERT INTO public.user_storage (user_id, bytes_used, updated_at)
SELECT
  (storage.foldername(name))[1]::UUID            AS user_id,
  COALESCE(SUM((metadata->>'size')::BIGINT), 0)  AS bytes_used,
  NOW()
FROM storage.objects
WHERE bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
GROUP BY 1
ON CONFLICT (user_id) DO UPDATE
  SET bytes_used = EXCLUDED.bytes_used,
      updated_at = NOW();
