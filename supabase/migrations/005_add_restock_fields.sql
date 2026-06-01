-- Add restock tracking fields to the listings table.
-- Restock state lives directly on listings — no separate restocker table needed.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS restock_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restock_quantity INTEGER NOT NULL DEFAULT 0;

-- Index for quickly fetching all restock-enabled listings for a user
CREATE INDEX IF NOT EXISTS idx_listings_restock_enabled
  ON public.listings(user_id)
  WHERE restock_enabled = true;
