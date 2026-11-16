-- Social: tags for what is in each video, its length and caption, and a view
-- that reads views at an age cheaply, for the Stats page's "against typical"
-- index. See docs/SOCIAL.md "Stats" and "Tags".
--
-- Still company data about our own channels (042, 052): no user_id, nothing
-- for the GDPR inventory or the deletion runbook.

-- =============================================================================
-- 1. Tags, length and caption
-- =============================================================================
-- Tags describe the video, not a platform's copy of it: opening, style,
-- topics, sound and a few yes/no flags, as lib/social/tags.ts writes them. A
-- planner post keeps them on social_posts, so all its platforms share them; a
-- video that never went through the planner keeps its own on marketing_videos.
-- Either way they are only ever written through admin_set_social_tags().
--
-- media_seconds is the planner file's length, read in the browser on upload.
-- duration_seconds and caption come from marketing-sync where the platform
-- gives them (YouTube, TikTok and Facebook give a length; Instagram does not).

ALTER TABLE public.social_posts
  ADD COLUMN tags JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(tags) = 'object' AND pg_column_size(tags) <= 4000),
  ADD COLUMN media_seconds NUMERIC
    CHECK (media_seconds > 0 AND media_seconds <= 36000);

ALTER TABLE public.marketing_videos
  ADD COLUMN tags JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(tags) = 'object' AND pg_column_size(tags) <= 4000),
  ADD COLUMN duration_seconds NUMERIC CHECK (duration_seconds > 0),
  ADD COLUMN caption TEXT CHECK (char_length(caption) <= 5000);

-- =============================================================================
-- 2. admin_set_social_tags() - tag a planner post, or a video on its own
-- =============================================================================
-- p_post_id set: the post's tags (and its file length, when given). Allowed
-- at any stage, posted or not, since tags are notes about the video and never
-- reach a platform. p_post_id NULL: that one video's tags. updated_at is left
-- alone so tagging an old post does not move it up the planner.

CREATE OR REPLACE FUNCTION public.admin_set_social_tags(
  p_post_id UUID,
  p_platform TEXT,
  p_external_id TEXT,
  p_tags JSONB,
  p_media_seconds NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_tags IS NULL OR jsonb_typeof(p_tags) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_tags');
  END IF;

  IF p_post_id IS NOT NULL THEN
    SELECT tags INTO v_old FROM public.social_posts WHERE id = p_post_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    UPDATE public.social_posts
    SET tags = p_tags, media_seconds = COALESCE(p_media_seconds, media_seconds)
    WHERE id = p_post_id;
    PERFORM public.log_admin_action(
      'social.tags', 'social_posts', p_post_id::text,
      jsonb_build_object('tags', p_tags, 'old', v_old)
    );
  ELSE
    SELECT tags INTO v_old FROM public.marketing_videos
    WHERE platform = p_platform AND external_id = p_external_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    UPDATE public.marketing_videos SET tags = p_tags
    WHERE platform = p_platform AND external_id = p_external_id;
    PERFORM public.log_admin_action(
      'social.tags', 'marketing_videos', p_platform || ':' || p_external_id,
      jsonb_build_object('tags', p_tags, 'old', v_old)
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_social_tags(UUID, TEXT, TEXT, JSONB, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_social_tags(UUID, TEXT, TEXT, JSONB, NUMERIC) TO authenticated;

-- =============================================================================
-- 3. marketing_video_age_points - the snapshots either side of each age
-- =============================================================================
-- Stats shows each video's views at 24 hours and 7 days against our typical
-- video, so it needs views at an age for every recent video. Reading every
-- hourly snapshot to get there is tens of thousands of rows; this returns, per
-- video and per age (1h, 6h, 24h, 3d, 7d), only the last snapshot at or before
-- it and the first at or after it, and lib/social/experiments.ts valueAtAge()
-- interpolates between them with its usual gap rule.
--
-- Two sources: the hourly rows (exact times, first 8 days only) and the daily
-- rows, which reach back to videos posted before hourly rows existed. A daily
-- row is rewritten by every hourly sync, so a finished day's value is from its
-- last run, taken as 23:00 UTC; today's is skipped because its time is not
-- known. Only the 7-day age is usually close enough to daily rows to pass the
-- gap rule.
--
-- security_invoker, so the RLS policies on the tables underneath apply: an
-- admin sees every row, anyone else none.

CREATE VIEW public.marketing_video_age_points
WITH (security_invoker = true) AS
SELECT
  v.platform,
  v.external_id,
  a.age_hours,
  hb.captured_at AS hourly_before_at,
  hb.views AS hourly_before_views,
  ha.captured_at AS hourly_after_at,
  ha.views AS hourly_after_views,
  (db.day + TIME '23:00') AT TIME ZONE 'UTC' AS daily_before_at,
  db.views AS daily_before_views,
  (da.day + TIME '23:00') AT TIME ZONE 'UTC' AS daily_after_at,
  da.views AS daily_after_views
FROM public.marketing_videos v
CROSS JOIN (VALUES (1), (6), (24), (72), (168)) AS a (age_hours)
LEFT JOIN LATERAL (
  SELECT h.captured_at, h.views
  FROM public.marketing_video_hourly h
  WHERE h.platform = v.platform AND h.external_id = v.external_id
    AND h.views IS NOT NULL
    AND h.captured_at >= v.published_at
    AND h.captured_at <= v.published_at + make_interval(hours => a.age_hours)
  ORDER BY h.captured_at DESC
  LIMIT 1
) hb ON TRUE
LEFT JOIN LATERAL (
  SELECT h.captured_at, h.views
  FROM public.marketing_video_hourly h
  WHERE h.platform = v.platform AND h.external_id = v.external_id
    AND h.views IS NOT NULL
    AND h.captured_at >= v.published_at + make_interval(hours => a.age_hours)
  ORDER BY h.captured_at ASC
  LIMIT 1
) ha ON TRUE
LEFT JOIN LATERAL (
  SELECT s.day, s.views
  FROM public.marketing_video_stats s
  WHERE s.platform = v.platform AND s.external_id = v.external_id
    AND s.views IS NOT NULL
    AND s.day < (NOW() AT TIME ZONE 'UTC')::date
    AND (s.day + TIME '23:00') AT TIME ZONE 'UTC' >= v.published_at
    AND (s.day + TIME '23:00') AT TIME ZONE 'UTC'
      <= v.published_at + make_interval(hours => a.age_hours)
  ORDER BY s.day DESC
  LIMIT 1
) db ON TRUE
LEFT JOIN LATERAL (
  SELECT s.day, s.views
  FROM public.marketing_video_stats s
  WHERE s.platform = v.platform AND s.external_id = v.external_id
    AND s.views IS NOT NULL
    AND s.day < (NOW() AT TIME ZONE 'UTC')::date
    AND (s.day + TIME '23:00') AT TIME ZONE 'UTC'
      >= v.published_at + make_interval(hours => a.age_hours)
  ORDER BY s.day ASC
  LIMIT 1
) da ON TRUE
WHERE v.published_at IS NOT NULL;

REVOKE ALL ON public.marketing_video_age_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketing_video_age_points TO authenticated;
