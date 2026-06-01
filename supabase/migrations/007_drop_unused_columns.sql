-- Drop columns that are redundant (always 'vinted' or duplicated in enriched_data)
-- Cloud table is Vinted-only; display fields live in enriched_data JSONB

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS platform,
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS size,
  DROP COLUMN IF EXISTS condition,
  DROP COLUMN IF EXISTS colour,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS shipping,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

-- Drop the indexes that referenced the dropped platform column
DROP INDEX IF EXISTS idx_listings_platform;
DROP INDEX IF EXISTS idx_listings_status;
DROP INDEX IF EXISTS idx_listings_platform_user;

-- Also drop the platform CHECK constraint (on the now-removed column)
-- Re-create a simpler status index without platform
CREATE INDEX IF NOT EXISTS idx_listings_status
  ON public.listings(user_id, status);
