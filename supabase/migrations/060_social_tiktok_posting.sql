-- Social: TikTok posts go straight to our account through TikTok API for
-- Business (docs/SOCIAL.md "TikTok"), instead of the app's inbox.
--
-- 1. A second TikTok login. The Business login posts; the existing TikTok
--    login keeps reading stats, because the Business API reports views 24 to
--    48 hours late and Stats needs each video's views at 24 hours. It lives in
--    marketing_accounts as platform 'tiktok_business', which only
--    marketing-oauth and marketing-publish read: marketing-sync loops over the
--    four real platforms, and the admin pages pick it out by name.
--
-- 2. A public bucket for TikTok to fetch from. TikTok downloads the video
--    itself, and only from an address our app has proved it owns. Supabase
--    signed URLs cannot be proved (the proof file would need a token too), so
--    marketing-publish copies the video here just before posting and deletes
--    it once TikTok has it. Paths are the post's UUID, nothing lists the
--    bucket (no policies), and the proof file TikTok checks sits at its root.

ALTER TABLE public.marketing_accounts
  DROP CONSTRAINT IF EXISTS marketing_accounts_platform_check,
  ADD CONSTRAINT marketing_accounts_platform_check
    CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'facebook', 'tiktok_business'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-public', 'social-public', true, 1073741824,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;
