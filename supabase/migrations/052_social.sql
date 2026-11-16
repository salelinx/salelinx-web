-- Social: the planner, scheduler and A/B experiments on /admin/marketing, on
-- top of the stats tables from 042_marketing.sql. See docs/SOCIAL.md.
--
-- Like 042 this is company data about SaleLinx's own channels: no user_id, so
-- nothing for the GDPR inventory or the deletion runbook. Who did what is in
-- admin_audit_log, which every write below goes through.
--
-- Admins read every table here under RLS and write only through the
-- is_admin()-gated RPCs, which log themselves. The marketing-publish Edge
-- Function (service role) claims due posts through social_claim_targets() and
-- writes their progress directly.
--
-- Numbered 052, not 051, because feat/shopify-link carries a 050 that will be
-- renumbered when it merges.

-- =============================================================================
-- 1. Experiments
-- =============================================================================
-- An A/B test is a set of videos tagged A, B (up to E), compared at the same
-- age after posting, within one platform at a time. Members can be planner
-- posts (they join once they are live) or any video already on our channels.

CREATE TABLE public.social_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  hypothesis TEXT CHECK (char_length(hypothesis) <= 2000),
  -- What decides the winner; lib/social/experiments.ts computes each.
  metric TEXT NOT NULL DEFAULT 'views_24h' CHECK (
    metric IN ('views_1h', 'views_6h', 'views_24h', 'views_72h', 'views_7d', 'engagement_7d')
  ),
  -- [{ "key": "A", "label": "Question hook" }, ...]
  variants JSONB NOT NULL DEFAULT '[{"key":"A","label":""},{"key":"B","label":""}]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'concluded')),
  winner TEXT CHECK (winner ~ '^[A-E]$'),
  conclusion TEXT CHECK (char_length(conclusion) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.social_experiment_videos (
  experiment_id UUID NOT NULL REFERENCES public.social_experiments (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant ~ '^[A-E]$'),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (experiment_id, platform, external_id),
  FOREIGN KEY (platform, external_id)
    REFERENCES public.marketing_videos (platform, external_id) ON DELETE CASCADE
);

-- =============================================================================
-- 2. Planned posts
-- =============================================================================
-- One post is one video going to one or more platforms at one time. Each
-- platform is a row in social_post_targets with its own caption, options and
-- progress, so Instagram can be live while TikTok waits in the inbox.

CREATE TABLE public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Our name for it in the planner, never posted anywhere.
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  -- Objects in the private social-media bucket (section 5).
  media_path TEXT,
  media_bytes BIGINT CHECK (media_bytes > 0),
  media_type TEXT,
  cover_path TEXT,
  -- Drafts are never picked up, whatever their time says.
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled')),
  scheduled_at TIMESTAMPTZ,
  experiment_id UUID REFERENCES public.social_experiments (id) ON DELETE SET NULL,
  variant TEXT CHECK (variant ~ '^[A-E]$'),
  notes TEXT CHECK (char_length(notes) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status = 'draft' OR (scheduled_at IS NOT NULL AND media_path IS NOT NULL))
);

CREATE INDEX social_posts_scheduled_idx
  ON public.social_posts (scheduled_at) WHERE status = 'scheduled';

-- Status, in order:
--   pending     waiting for its time
--   sending     an irreversible call is in flight (upload, publish). A run that
--               dies here is NOT retried: social_claim_targets() fails it so an
--               admin checks the platform first, since a retry could post twice.
--   processing  the platform has the file and is working on it (Instagram
--               container, TikTok upload); the next run checks again
--   inbox       TikTok: in the app's inbox, waiting for someone to tap Post
--   published   live; external_id is the video's id on the platform
--   failed      see error; Retry puts it back to pending
CREATE TABLE public.social_post_targets (
  post_id UUID NOT NULL REFERENCES public.social_posts (id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok')),
  -- YouTube's title. Instagram and TikTok have only the caption.
  title TEXT CHECK (char_length(title) <= 100),
  caption TEXT CHECK (char_length(caption) <= 5000),
  -- Per platform, typed in lib/social/types.ts (SocialTargetOptions).
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sending', 'processing', 'inbox', 'published', 'failed')
  ),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  -- A publish run's claim, so a Cron run and a Post now never both take it.
  locked_until TIMESTAMPTZ,
  -- The platform's ids for work in progress (Instagram container, TikTok
  -- publish_id) and any note from the last step.
  job JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_id TEXT,
  url TEXT,
  error TEXT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, platform)
);

-- =============================================================================
-- 3. Hourly snapshots and deeper stats
-- =============================================================================
-- marketing_video_stats keeps one row per day, which cannot show a video's
-- first hours. marketing-sync also writes a row here on every run for videos
-- under 8 days old, so experiments can compare views at the same age (1h, 6h,
-- 24h, 72h, 7d). A video older than that when it joins an experiment has no
-- early curve, only its lifetime numbers.

CREATE TABLE public.marketing_video_hourly (
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  PRIMARY KEY (platform, external_id, captured_at),
  FOREIGN KEY (platform, external_id)
    REFERENCES public.marketing_videos (platform, external_id) ON DELETE CASCADE
);

-- Lifetime figures only some platforms give. Null where a platform has none:
-- reach and saves are Instagram's; watch time, view percentage and
-- subscribers gained are YouTube Analytics' (once YouTube is connected), plus
-- Instagram's average Reels watch time. TikTok's Display API has none.
ALTER TABLE public.marketing_video_stats
  ADD COLUMN reach BIGINT,
  ADD COLUMN saves BIGINT,
  ADD COLUMN watch_seconds BIGINT,
  ADD COLUMN avg_watch_seconds NUMERIC,
  ADD COLUMN avg_view_pct NUMERIC,
  ADD COLUMN subscribers_gained BIGINT;

-- =============================================================================
-- 4. Read access
-- =============================================================================

ALTER TABLE public.social_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_experiment_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_video_hourly ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.social_experiments, public.social_experiment_videos,
  public.social_posts, public.social_post_targets, public.marketing_video_hourly
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.social_experiments, public.social_experiment_videos,
  public.social_posts, public.social_post_targets, public.marketing_video_hourly
  TO authenticated;

CREATE POLICY "Admins can read social experiments"
  ON public.social_experiments FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can read social experiment videos"
  ON public.social_experiment_videos FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can read social posts"
  ON public.social_posts FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can read social post targets"
  ON public.social_post_targets FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can read hourly video stats"
  ON public.marketing_video_hourly FOR SELECT USING (public.is_admin());

-- =============================================================================
-- 5. The video bucket
-- =============================================================================
-- Private. Admins upload from the planner with their own session; the
-- publisher reads with the service role (signed URLs for Instagram to fetch,
-- byte ranges for YouTube and TikTok). The 1 GB cap only works if the
-- project's global upload limit (Storage settings) is at least that.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media', 'social-media', false, 1073741824,
  ARRAY['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can read social media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-media' AND public.is_admin());
CREATE POLICY "Admins can upload social media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media' AND public.is_admin());
CREATE POLICY "Admins can delete social media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-media' AND public.is_admin());

-- =============================================================================
-- 6. admin_save_social_post() - create or edit a post and its platforms
-- =============================================================================
-- p_id NULL creates. p_targets is the full list, [{platform, title, caption,
-- options}], and replaces what was there, so it is refused once any platform
-- has started (or a run holds it): from then on the targets are history.
-- p_schedule false keeps it a draft (or unschedules it).

CREATE OR REPLACE FUNCTION public.admin_save_social_post(
  p_id UUID,
  p_name TEXT,
  p_media_path TEXT,
  p_media_bytes BIGINT,
  p_media_type TEXT,
  p_cover_path TEXT,
  p_schedule BOOLEAN,
  p_scheduled_at TIMESTAMPTZ,
  p_experiment_id UUID,
  p_variant TEXT,
  p_notes TEXT,
  p_targets JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := p_id;
  v_targets JSONB := COALESCE(p_targets, '[]'::jsonb);
  v_target JSONB;
  v_previous JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF jsonb_typeof(v_targets) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_targets');
  END IF;
  IF p_schedule AND (
    p_media_path IS NULL OR p_scheduled_at IS NULL OR jsonb_array_length(v_targets) = 0
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'A scheduled post needs a video, a time and at least one platform.');
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.social_posts (
      name, media_path, media_bytes, media_type, cover_path, status,
      scheduled_at, experiment_id, variant, notes
    ) VALUES (
      p_name, p_media_path, p_media_bytes, p_media_type, p_cover_path,
      CASE WHEN p_schedule THEN 'scheduled' ELSE 'draft' END,
      p_scheduled_at, p_experiment_id, p_variant, p_notes
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT to_jsonb(p) INTO v_previous
    FROM public.social_posts p WHERE p.id = v_id FOR UPDATE;
    IF v_previous IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.social_post_targets t
      WHERE t.post_id = v_id
        AND (t.status <> 'pending' OR t.locked_until > NOW())
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'This post has started posting, so it can no longer be edited.');
    END IF;
    UPDATE public.social_posts SET
      name = p_name,
      media_path = p_media_path,
      media_bytes = p_media_bytes,
      media_type = p_media_type,
      cover_path = p_cover_path,
      status = CASE WHEN p_schedule THEN 'scheduled' ELSE 'draft' END,
      scheduled_at = p_scheduled_at,
      experiment_id = p_experiment_id,
      variant = p_variant,
      notes = p_notes,
      updated_at = NOW()
    WHERE id = v_id;
    DELETE FROM public.social_post_targets WHERE post_id = v_id;
  END IF;

  FOR v_target IN SELECT * FROM jsonb_array_elements(v_targets) LOOP
    INSERT INTO public.social_post_targets (post_id, platform, title, caption, options)
    VALUES (
      v_id,
      v_target->>'platform',
      NULLIF(v_target->>'title', ''),
      NULLIF(v_target->>'caption', ''),
      COALESCE(v_target->'options', '{}'::jsonb)
    );
  END LOOP;

  PERFORM public.log_admin_action(
    CASE WHEN p_id IS NULL THEN 'social.post_create' ELSE 'social.post_update' END,
    'social_posts',
    v_id::text,
    jsonb_build_object(
      'name', p_name,
      'status', CASE WHEN p_schedule THEN 'scheduled' ELSE 'draft' END,
      'scheduled_at', p_scheduled_at,
      'platforms', (SELECT jsonb_agg(t->>'platform') FROM jsonb_array_elements(v_targets) t),
      'old', v_previous
    )
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_social_post(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_social_post(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 7. admin_delete_social_post() - remove a post from the planner
-- =============================================================================
-- Removes our plan, never the video on the platform. Refused while a platform
-- is mid-send. Returns the files no other post uses, for the caller to delete
-- from the bucket.

CREATE OR REPLACE FUNCTION public.admin_delete_social_post(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.social_posts%ROWTYPE;
  v_orphans TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_post FROM public.social_posts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.social_post_targets t
    WHERE t.post_id = p_id AND (t.status = 'sending' OR t.locked_until > NOW())
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'A platform is mid-upload. Try again in a few minutes.');
  END IF;

  SELECT COALESCE(array_agg(f), '{}') INTO v_orphans
  FROM unnest(ARRAY[v_post.media_path, v_post.cover_path]) f
  WHERE f IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.social_posts o
      WHERE o.id <> p_id AND (o.media_path = f OR o.cover_path = f)
    );

  PERFORM public.log_admin_action(
    'social.post_delete', 'social_posts', p_id::text,
    jsonb_build_object(
      'old', to_jsonb(v_post),
      'targets', (SELECT jsonb_agg(to_jsonb(t) - 'job') FROM public.social_post_targets t WHERE t.post_id = p_id)
    )
  );
  DELETE FROM public.social_posts WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'orphaned_files', to_jsonb(v_orphans));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_social_post(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_social_post(UUID) TO authenticated;

-- =============================================================================
-- 8. admin_retry_social_target() - put a failed platform back in the queue
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_retry_social_target(p_post_id UUID, p_platform TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_error TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT t.error INTO v_error
  FROM public.social_post_targets t
  WHERE t.post_id = p_post_id AND t.platform = p_platform AND t.status = 'failed'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a failed platform can be retried.');
  END IF;

  UPDATE public.social_post_targets SET
    status = 'pending', attempts = 0, next_attempt_at = NULL,
    locked_until = NULL, job = '{}'::jsonb, error = NULL, updated_at = NOW()
  WHERE post_id = p_post_id AND platform = p_platform;

  PERFORM public.log_admin_action(
    'social.target_retry', 'social_post_targets', p_post_id::text || ':' || p_platform,
    jsonb_build_object('previous_error', v_error)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retry_social_target(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_social_target(UUID, TEXT) TO authenticated;

-- =============================================================================
-- 9. Experiment writes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_save_social_experiment(
  p_id UUID,
  p_name TEXT,
  p_hypothesis TEXT,
  p_metric TEXT,
  p_variants JSONB,
  p_status TEXT,
  p_winner TEXT,
  p_conclusion TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := p_id;
  v_previous JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) NOT BETWEEN 2 AND 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'An experiment needs 2 to 5 variants.');
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.social_experiments (name, hypothesis, metric, variants, status, winner, conclusion)
    VALUES (p_name, p_hypothesis, p_metric, p_variants, p_status, p_winner, p_conclusion)
    RETURNING id INTO v_id;
  ELSE
    SELECT to_jsonb(e) INTO v_previous FROM public.social_experiments e WHERE e.id = v_id FOR UPDATE;
    IF v_previous IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    UPDATE public.social_experiments SET
      name = p_name, hypothesis = p_hypothesis, metric = p_metric,
      variants = p_variants, status = p_status, winner = p_winner,
      conclusion = p_conclusion, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN p_id IS NULL THEN 'social.experiment_create' ELSE 'social.experiment_update' END,
    'social_experiments', v_id::text,
    jsonb_build_object('name', p_name, 'status', p_status, 'winner', p_winner, 'old', v_previous)
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_social_experiment(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_social_experiment(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated;

-- Removes the experiment and its memberships; the videos and their stats stay.
CREATE OR REPLACE FUNCTION public.admin_delete_social_experiment(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT to_jsonb(e) INTO v_previous FROM public.social_experiments e WHERE e.id = p_id;
  IF v_previous IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM public.log_admin_action(
    'social.experiment_delete', 'social_experiments', p_id::text,
    jsonb_build_object(
      'old', v_previous,
      'videos', (SELECT jsonb_agg(to_jsonb(v)) FROM public.social_experiment_videos v WHERE v.experiment_id = p_id)
    )
  );
  DELETE FROM public.social_experiments WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_social_experiment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_social_experiment(UUID) TO authenticated;

-- Adds a video to an experiment as a variant, moves it to another variant, or
-- (p_variant NULL) takes it out.
CREATE OR REPLACE FUNCTION public.admin_set_social_experiment_video(
  p_experiment_id UUID,
  p_platform TEXT,
  p_external_id TEXT,
  p_variant TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_variant IS NULL THEN
    DELETE FROM public.social_experiment_videos
    WHERE experiment_id = p_experiment_id AND platform = p_platform AND external_id = p_external_id;
  ELSE
    INSERT INTO public.social_experiment_videos (experiment_id, platform, external_id, variant)
    VALUES (p_experiment_id, p_platform, p_external_id, p_variant)
    ON CONFLICT (experiment_id, platform, external_id) DO UPDATE SET variant = EXCLUDED.variant;
  END IF;

  PERFORM public.log_admin_action(
    'social.experiment_video', 'social_experiments', p_experiment_id::text,
    jsonb_build_object('platform', p_platform, 'external_id', p_external_id, 'variant', p_variant)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_social_experiment_video(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_social_experiment_video(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 10. social_claim_targets() - the publisher's queue (service role only)
-- =============================================================================
-- Takes up to p_limit due platforms and locks each for p_lock_minutes, so two
-- runs never work the same one. Due means: the post is scheduled and its time
-- has come (YouTube an hour early, because it uploads private with a publish
-- time and needs the hour to process), or a step in progress is due a check.
--
-- First it fails any target a dead run left 'sending': retrying blind could
-- post the video twice.

CREATE OR REPLACE FUNCTION public.social_claim_targets(p_limit INT, p_lock_minutes INT)
RETURNS TABLE (
  post_id UUID,
  platform TEXT,
  status TEXT,
  title TEXT,
  caption TEXT,
  options JSONB,
  job JSONB,
  attempts INT,
  scheduled_at TIMESTAMPTZ,
  media_path TEXT,
  media_bytes BIGINT,
  media_type TEXT,
  cover_path TEXT,
  post_name TEXT,
  experiment_id UUID,
  variant TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  UPDATE public.social_post_targets SET
    status = 'failed',
    locked_until = NULL,
    updated_at = NOW(),
    error = 'Interrupted while sending. Check the platform before retrying: it may have posted.'
  WHERE status = 'sending' AND locked_until < NOW();

  RETURN QUERY
  WITH due AS (
    SELECT t.post_id, t.platform
    FROM public.social_post_targets t
    JOIN public.social_posts p ON p.id = t.post_id
    WHERE p.status = 'scheduled'
      AND t.status IN ('pending', 'processing', 'inbox')
      AND (t.locked_until IS NULL OR t.locked_until < NOW())
      AND (t.next_attempt_at IS NULL OR t.next_attempt_at <= NOW())
      AND p.scheduled_at <= NOW() + CASE
        WHEN t.platform = 'youtube' AND t.status = 'pending' THEN INTERVAL '60 minutes'
        ELSE INTERVAL '0 minutes'
      END
    ORDER BY p.scheduled_at
    LIMIT p_limit
    FOR UPDATE OF t SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.social_post_targets t SET
      locked_until = NOW() + make_interval(mins => p_lock_minutes),
      updated_at = NOW()
    FROM due
    WHERE t.post_id = due.post_id AND t.platform = due.platform
    RETURNING t.post_id, t.platform, t.status, t.title, t.caption, t.options,
      t.job, t.attempts
  )
  SELECT c.post_id, c.platform, c.status, c.title, c.caption, c.options, c.job,
    c.attempts, p.scheduled_at, p.media_path, p.media_bytes, p.media_type,
    p.cover_path, p.name, p.experiment_id, p.variant
  FROM claimed c
  JOIN public.social_posts p ON p.id = c.post_id
  ORDER BY p.scheduled_at;
END;
$$;

REVOKE ALL ON FUNCTION public.social_claim_targets(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_claim_targets(INT, INT) TO service_role;

-- 042's accounts list, widened to say which logins can post (the Connect
-- button asks for a reconnect when an older login lacks the scope).
ALTER TABLE public.marketing_accounts ADD COLUMN scopes TEXT;

DROP FUNCTION public.admin_marketing_accounts();
CREATE FUNCTION public.admin_marketing_accounts()
RETURNS TABLE (
  platform TEXT,
  handle TEXT,
  connected_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  last_error TEXT,
  logged_in BOOLEAN,
  scopes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.platform, a.handle, a.connected_at, a.synced_at, a.last_error,
    a.access_token IS NOT NULL, a.scopes
  FROM public.marketing_accounts a
  WHERE public.is_admin();
$function$;

REVOKE ALL ON FUNCTION public.admin_marketing_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_accounts() TO authenticated, service_role;
