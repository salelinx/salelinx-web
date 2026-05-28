-- Add enrichment columns for full detail data from item-level API endpoints
-- enriched_data: full JSON blob from Depop edit-listing or Vinted item_upload endpoint
-- enriched_at: timestamp (ms) of last enrichment

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS enriched_data JSONB;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS enriched_at BIGINT;
