-- Add link_id column to listings for cross-platform item linking
-- Listings sharing the same link_id represent the same physical item across platforms

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS link_id UUID;

CREATE INDEX IF NOT EXISTS idx_listings_link_id
  ON public.listings(user_id, link_id)
  WHERE link_id IS NOT NULL;
