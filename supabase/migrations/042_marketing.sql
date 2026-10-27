-- Marketing: SaleLinx's own YouTube, Instagram and TikTok accounts, their
-- videos, and a daily snapshot of each video's and account's numbers, for
-- /admin/marketing. Company data about our own channels, not user data: no
-- user_id, so nothing for the GDPR inventory or the deletion runbook.
--
-- Written only by the marketing-sync and marketing-oauth Edge Functions (service
-- role). Admins read the stats tables directly and the accounts through
-- admin_marketing_accounts(), which leaves the tokens out.

CREATE TABLE public.marketing_accounts (
  platform TEXT PRIMARY KEY CHECK (platform IN ('youtube', 'instagram', 'tiktok')),
  handle TEXT,
  external_id TEXT,
  -- Instagram and TikTok logins. YouTube reads public stats with an API key.
  access_token TEXT,
  access_expires_at TIMESTAMPTZ,
  refresh_token TEXT,
  refresh_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  -- The last sync's failure, cleared by the next good one.
  last_error TEXT
);

-- RLS on with no policies: tokens are for the service role only.
ALTER TABLE public.marketing_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_accounts FROM PUBLIC, anon, authenticated;

CREATE TABLE public.marketing_videos (
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok')),
  external_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  PRIMARY KEY (platform, external_id)
);

-- One row per video per day the sync ran; growth is the difference between days.
CREATE TABLE public.marketing_video_stats (
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  day DATE NOT NULL,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  PRIMARY KEY (platform, external_id, day),
  FOREIGN KEY (platform, external_id)
    REFERENCES public.marketing_videos (platform, external_id) ON DELETE CASCADE
);

CREATE TABLE public.marketing_account_stats (
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok')),
  day DATE NOT NULL,
  followers BIGINT,
  PRIMARY KEY (platform, day)
);

ALTER TABLE public.marketing_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_video_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_account_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_videos, public.marketing_video_stats, public.marketing_account_stats
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketing_videos, public.marketing_video_stats, public.marketing_account_stats
  TO authenticated;

CREATE POLICY "Admins can read marketing videos"
  ON public.marketing_videos FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can read marketing video stats"
  ON public.marketing_video_stats FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can read marketing account stats"
  ON public.marketing_account_stats FOR SELECT
  USING (public.is_admin());

-- The connected accounts without their tokens, for the admin page.
CREATE FUNCTION public.admin_marketing_accounts()
RETURNS TABLE (
  platform TEXT,
  handle TEXT,
  connected_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  last_error TEXT,
  logged_in BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.platform, a.handle, a.connected_at, a.synced_at, a.last_error,
    a.access_token IS NOT NULL
  FROM public.marketing_accounts a
  WHERE public.is_admin();
$function$;

REVOKE ALL ON FUNCTION public.admin_marketing_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_accounts() TO authenticated, service_role;
