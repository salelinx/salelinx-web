-- Shopify as a fourth platform, the seller's own store: listings and linked
-- accounts accept 'shopify', and the Admin API tokens the shopify edge function
-- uses live in a table no client role can read. Mirrors 040_ebay.sql.

ALTER TABLE public.listings DROP CONSTRAINT listings_platform_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_platform_check
  CHECK (platform IN ('depop', 'vinted', 'ebay', 'shopify'));

ALTER TABLE public.linked_accounts DROP CONSTRAINT linked_accounts_platform_check;
ALTER TABLE public.linked_accounts ADD CONSTRAINT linked_accounts_platform_check
  CHECK (platform IN ('depop', 'vinted', 'ebay', 'shopify'));

-- One row per user. shop_id is the numeric part of Shopify's Shop GID, the
-- same value as linked_accounts.platform_user_id. Shopify rotates the refresh
-- token on every refresh, so refreshing_until is a short lock: a second refresh
-- at the same time would leave this row holding a token Shopify has retired.
CREATE TABLE public.shopify_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL UNIQUE,
  shop_domain TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  access_token TEXT NOT NULL,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token TEXT NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  refreshing_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on with no policies: only the service role (edge functions) gets in.
ALTER TABLE public.shopify_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopify_tokens FROM PUBLIC, anon, authenticated;
