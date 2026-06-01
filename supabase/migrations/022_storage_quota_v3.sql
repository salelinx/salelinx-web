-- Cloud storage quota v3: enforce on BOTH AFTER INSERT and AFTER UPDATE.
--
-- v2 assumed Supabase Storage always writes the row in two passes — INSERT
-- with NULL metadata, then UPDATE with size — and moved enforcement to
-- AFTER UPDATE. In some environments the Storage API populates metadata.size
-- on the initial INSERT and never UPDATEs, so the v2 AFTER UPDATE trigger
-- never fires and uploads silently slip through.
--
-- v3 covers both behaviours by running the same bump-and-check on both
-- events, using OLD/NEW delta math so the count is exact regardless of
-- which path Storage takes:
--   • AFTER INSERT: delta = NEW.size  (OLD is implicitly 0)
--   • AFTER UPDATE: delta = NEW.size - OLD.size
-- If Storage populates metadata at INSERT, AFTER INSERT bumps and any
-- subsequent UPDATE has delta 0. If Storage populates at UPDATE, AFTER
-- INSERT bumps 0 and AFTER UPDATE does the work. Either way, total = size.

-- =============================================================================
-- 1. Shared bump + cap-check (used by both INSERT and UPDATE triggers)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_storage_delta(p_user_id UUID, p_delta BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current BIGINT;
  v_cap BIGINT;
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_storage (user_id, bytes_used, updated_at)
  VALUES (p_user_id, GREATEST(0, p_delta), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET bytes_used = GREATEST(0, public.user_storage.bytes_used + p_delta),
        updated_at = NOW()
  RETURNING bytes_used INTO v_current;

  v_cap := public.get_user_storage_cap(p_user_id);
  IF v_cap IS NULL THEN
    RETURN;
  END IF;

  IF v_current > v_cap THEN
    RAISE EXCEPTION 'cloud_storage_quota_exceeded'
      USING DETAIL = format(
        'user=%s used=%s delta=%s cap=%s', p_user_id, v_current, p_delta, v_cap
      );
  END IF;
END;
$$;

-- =============================================================================
-- 2. AFTER INSERT — bump by NEW.size when populated up-front
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bump_user_storage_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_size BIGINT;
BEGIN
  IF NEW.bucket_id <> 'listing-images' THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(NEW.name))[1] !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  v_user_id := (storage.foldername(NEW.name))[1]::UUID;

  v_size := COALESCE((NEW.metadata->>'size')::BIGINT, 0);
  PERFORM public.apply_storage_delta(v_user_id, v_size);

  RETURN NULL;
END;
$$;

-- =============================================================================
-- 3. AFTER UPDATE — bump by NEW.size - OLD.size when populated later
-- =============================================================================

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
  PERFORM public.apply_storage_delta(v_user_id, v_new_size - v_old_size);

  RETURN NULL;
END;
$$;

-- =============================================================================
-- 4. Make sure both triggers are installed (idempotent)
-- =============================================================================
-- v2 already installed user_storage_track_update; v1 installed
-- user_storage_track_insert. Re-create both so the trigger definitions
-- match the new function bodies even if someone manually dropped them.

DROP TRIGGER IF EXISTS user_storage_track_insert ON storage.objects;
CREATE TRIGGER user_storage_track_insert
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_user_storage_on_insert();

DROP TRIGGER IF EXISTS user_storage_track_update ON storage.objects;
CREATE TRIGGER user_storage_track_update
  AFTER UPDATE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_user_storage_on_update();

-- =============================================================================
-- 5. Re-backfill to correct any drift from v2's no-op AFTER INSERT period
-- =============================================================================
-- If any uploads slipped through during the time AFTER INSERT was a no-op
-- AND AFTER UPDATE never fired, user_storage will under-count them. Rebuild
-- from scratch.

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
