-- Social: our Facebook Page alongside YouTube, Instagram and TikTok, on the
-- Stats, Planner and Experiments pages (docs/SOCIAL.md "Facebook").
--
-- Only the platform checks change. 042 and 052 wrote them inline, so they carry
-- Postgres's default names (<table>_platform_check). marketing_video_stats,
-- marketing_video_hourly and social_experiment_videos have no check of their
-- own: their foreign key to marketing_videos already limits the platform.

ALTER TABLE public.marketing_accounts
  DROP CONSTRAINT IF EXISTS marketing_accounts_platform_check,
  ADD CONSTRAINT marketing_accounts_platform_check
    CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'facebook'));

ALTER TABLE public.marketing_videos
  DROP CONSTRAINT IF EXISTS marketing_videos_platform_check,
  ADD CONSTRAINT marketing_videos_platform_check
    CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'facebook'));

ALTER TABLE public.marketing_account_stats
  DROP CONSTRAINT IF EXISTS marketing_account_stats_platform_check,
  ADD CONSTRAINT marketing_account_stats_platform_check
    CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'facebook'));

ALTER TABLE public.social_post_targets
  DROP CONSTRAINT IF EXISTS social_post_targets_platform_check,
  ADD CONSTRAINT social_post_targets_platform_check
    CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'facebook'));
