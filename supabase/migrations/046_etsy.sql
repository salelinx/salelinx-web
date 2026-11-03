-- Etsy linking: tokens live where only the service role can read them.

ALTER TABLE public.linked_accounts DROP CONSTRAINT linked_accounts_platform_check;
ALTER TABLE public.linked_accounts ADD CONSTRAINT linked_accounts_platform_check
  CHECK (platform IN ('depop', 'vinted', 'ebay', 'etsy'));

CREATE TABLE public.etsy_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  etsy_user_id TEXT NOT NULL UNIQUE,
  shop_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on with no policies: only the service role (edge functions) gets in.
ALTER TABLE public.etsy_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.etsy_tokens FROM PUBLIC, anon, authenticated;
