-- eBay as a third platform: listings and linked accounts accept 'ebay', and
-- the OAuth tokens the ebay edge function uses live in a table no client role
-- can read.

ALTER TABLE public.listings DROP CONSTRAINT listings_platform_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_platform_check
  CHECK (platform IN ('depop', 'vinted', 'ebay'));

ALTER TABLE public.linked_accounts DROP CONSTRAINT linked_accounts_platform_check;
ALTER TABLE public.linked_accounts ADD CONSTRAINT linked_accounts_platform_check
  CHECK (platform IN ('depop', 'vinted', 'ebay'));

CREATE TABLE public.ebay_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ebay_user_id TEXT NOT NULL UNIQUE,
  site_id INTEGER NOT NULL,
  access_token TEXT NOT NULL,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token TEXT NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on with no policies: only the service role (edge functions) gets in.
ALTER TABLE public.ebay_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ebay_tokens FROM PUBLIC, anon, authenticated;
