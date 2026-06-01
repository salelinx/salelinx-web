-- Restore columns that were dropped in 007_drop_unused_columns.sql
-- Cloud table now stores both Depop and Vinted listings again

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'vinted'
    CHECK (platform IN ('depop', 'vinted')),
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS colour TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS shipping TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at BIGINT NOT NULL DEFAULT 0;

-- Restore indexes
CREATE INDEX IF NOT EXISTS idx_listings_platform
  ON public.listings(user_id, platform);

-- Drop and recreate status index to include platform again
DROP INDEX IF EXISTS idx_listings_status;
CREATE INDEX idx_listings_status
  ON public.listings(user_id, platform, status);
