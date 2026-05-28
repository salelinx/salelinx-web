-- Cloud storage quota: per-user byte tracking + hard cap enforcement.
-- Closes the cloud_storage_bytes gap noted in docs/technical/ENTITLEMENTS.md.
--
-- Pro is capped at 500 MB (524288000) and Business at 1 GB (1073741824) by
-- the seed in 011_billing.sql. Until now nothing measured bucket usage or
-- rejected overages. This migration adds:
--
--   1. user_storage table — running byte total per user (a gauge, not the
--      per-period counter pattern used by usage_counters).
--   2. AFTER INSERT/DELETE triggers on storage.objects keeping the gauge in
--      lockstep with the listing-images bucket.
--   3. BEFORE INSERT trigger that rejects uploads which would push the user
--      over their tier cap — the upload returns 403 to the extension and
--      the existing warn-and-continue path in listing-enricher.ts handles
--      it gracefully.
--   4. One-time backfill so existing users get an accurate baseline.
--   5. RLS read policy so the panel can render a storage meter.
--
-- Path convention: listing-enricher uploads as `{userId}/{listingId}/photo_N.jpg`.
-- storage.foldername(name)[1] therefore yields the owning user_id.

-- =============================================================================
-- 1. user_storage — running byte total per user (gauge)
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
-- Missing key  = not applicable to this tier  = treated as zero (no quota).
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
-- 3. Trigger functions on storage.objects
-- =============================================================================

-- BEFORE INSERT: reject uploads that would breach the cap. Reading the
-- pre-existing total + the new object's size, blocking when sum > cap.
-- NULL cap means unlimited (no check). Cap of 0 / missing key means
-- the tier has no storage allowance and every upload to the bucket is
-- rejected.
CREATE OR REPLACE FUNCTION public.enforce_cloud_storage_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_size BIGINT;
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

  v_new_size := COALESCE((NEW.metadata->>'size')::BIGINT, 0);
  v_cap := public.get_user_storage_cap(v_user_id);

  -- Unlimited tier — short-circuit.
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(bytes_used, 0) INTO v_current
  FROM public.user_storage
  WHERE user_id = v_user_id;

  IF COALESCE(v_current, 0) + v_new_size > v_cap THEN
    RAISE EXCEPTION 'cloud_storage_quota_exceeded'
      USING DETAIL = format(
        'user=%s used=%s new=%s cap=%s',
        v_user_id, COALESCE(v_current, 0), v_new_size, v_cap
      );
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER INSERT: bump the running total.
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
  IF v_size = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_storage (user_id, bytes_used, updated_at)
  VALUES (v_user_id, v_size, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET bytes_used = public.user_storage.bytes_used + EXCLUDED.bytes_used,
        updated_at = NOW();

  RETURN NULL;
END;
$$;

-- AFTER DELETE: decrement, clamped at zero.
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
-- 4. Triggers on storage.objects
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

DROP TRIGGER IF EXISTS user_storage_track_delete ON storage.objects;
CREATE TRIGGER user_storage_track_delete
  AFTER DELETE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_user_storage_on_delete();

-- =============================================================================
-- 5. Backfill — one-shot sum of existing listing-images objects per user
-- =============================================================================
-- Safe to re-run: the INSERT...ON CONFLICT replaces the row with the freshly
-- computed total rather than additively double-counting. The regex pre-filter
-- skips any first-segment that isn't a UUID so a single bad folder name
-- (legacy uploads, manual debugging, test fixtures) can't error the whole
-- statement out via a failing ::UUID cast.

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
