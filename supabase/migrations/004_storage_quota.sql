-- Cloud storage quota: per-user byte tracking + hard cap enforcement for the
-- listing-images bucket.
--
-- Consolidated baseline (July 2026). This file is the net result of the
-- original migrations 020-022 (quota v1 -> v2 -> v3). Full history in git.
--
-- Why enforcement runs on BOTH AFTER INSERT and AFTER UPDATE: the Supabase
-- Storage API writes storage.objects in one of two ways depending on the
-- environment. Either it populates metadata.size on the initial INSERT, or it
-- INSERTs with NULL metadata, PUTs the bytes to S3, then UPDATEs the row with
-- the size. Running the same bump-and-check on both events with OLD/NEW delta
-- math covers both paths exactly once:
--   AFTER INSERT: delta = NEW.size (OLD is implicitly 0)
--   AFTER UPDATE: delta = NEW.size - OLD.size
--
-- The BEFORE INSERT trigger is only a cheap pre-flight: a user already at or
-- over cap gets rejected before the S3 PUT happens at all. When the real check
-- raises, the metadata write rolls back and the S3 object may briefly exist as
-- an orphan; Supabase's storage consistency job sweeps those.
--
-- Path convention: listing-enricher uploads as {userId}/{listingId}/photo_N.jpg,
-- so storage.foldername(name)[1] yields the owning user_id. The UUID regex
-- guard skips legacy/debug uploads whose first segment isn't a user id.

-- =============================================================================
-- 1. user_storage - running byte total per user (a gauge, not a per-period
--    counter like usage_counters)
-- =============================================================================

CREATE TABLE public.user_storage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bytes_used BIGINT NOT NULL DEFAULT 0 CHECK (bytes_used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_storage own read"
  ON public.user_storage FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. Helper: resolve the cloud_storage_bytes cap for a given user
-- =============================================================================
-- NULL = unlimited (matches the cached subscription contract).
-- Missing key = not applicable to this tier = treated as zero (no quota).
-- No subscription row = free tier, version 1.

CREATE OR REPLACE FUNCTION public.get_user_storage_cap(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (tl.limits->>'cloud_storage_bytes')::BIGINT
  FROM public.tier_limits tl
  LEFT JOIN public.subscriptions s
    ON s.user_id = p_user_id
   AND s.tier_id = tl.tier_id
   AND s.tier_version = tl.version
  WHERE tl.tier_id = COALESCE(
          (SELECT tier_id FROM public.subscriptions WHERE user_id = p_user_id LIMIT 1),
          'free'
        )
    AND tl.version = COALESCE(
          (SELECT tier_version FROM public.subscriptions WHERE user_id = p_user_id LIMIT 1),
          1
        )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_storage_cap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_storage_cap(UUID) TO authenticated;

-- =============================================================================
-- 3. BEFORE INSERT pre-flight - reject when already at or over cap
-- =============================================================================
-- No size check here (metadata.size may not be populated yet); the exact
-- check happens in apply_storage_delta once the size is known.

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

  -- Already at or over cap -> reject without even trying. The actual size
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
-- 4. Shared bump + cap-check (used by both INSERT and UPDATE triggers)
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
-- 5. AFTER INSERT - bump by NEW.size when populated up-front
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
-- 6. AFTER UPDATE - bump by NEW.size - OLD.size when populated later
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
-- 7. AFTER DELETE - decrement, clamped at zero
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bump_user_storage_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_size BIGINT;
BEGIN
  IF OLD.bucket_id <> 'listing-images' THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(OLD.name))[1] !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  v_user_id := (storage.foldername(OLD.name))[1]::UUID;

  v_size := COALESCE((OLD.metadata->>'size')::BIGINT, 0);
  IF v_size = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.user_storage
     SET bytes_used = GREATEST(0, bytes_used - v_size),
         updated_at = NOW()
   WHERE user_id = v_user_id;

  RETURN NULL;
END;
$$;

-- =============================================================================
-- 8. Triggers on storage.objects
-- =============================================================================

DROP TRIGGER IF EXISTS enforce_cloud_storage_quota ON storage.objects;
CREATE TRIGGER enforce_cloud_storage_quota
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cloud_storage_quota();

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

DROP TRIGGER IF EXISTS user_storage_track_delete ON storage.objects;
CREATE TRIGGER user_storage_track_delete
  AFTER DELETE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_user_storage_on_delete();

-- =============================================================================
-- 9. Backfill - one-shot sum of existing listing-images objects per user
-- =============================================================================
-- Safe to re-run: the INSERT...ON CONFLICT replaces the row with the freshly
-- computed total rather than additively double-counting. The regex pre-filter
-- skips any first-segment that isn't a UUID so a single bad folder name can't
-- error the whole statement out via a failing ::UUID cast.

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
