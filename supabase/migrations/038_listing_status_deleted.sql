-- Adds 'deleted' to the listing statuses.
--
-- A listing deleted from Depop or Vinted can keep its cloud backup (the
-- relister and restocker rebuild items from it). The extension had no way to
-- record that, so it wrote 'sold', the only non-live status, and My Listings
-- showed every deleted listing's backup as a sale. The extension now writes
-- 'deleted' for these rows, and falls back to 'sold' while this constraint
-- still refuses it.
--
-- Widening a CHECK only allows more values, so every existing row stays valid
-- and nothing else changes. One statement, so the table is never without the
-- constraint.

ALTER TABLE public.listings
  DROP CONSTRAINT listings_status_check,
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'sold', 'reserved', 'draft', 'hidden', 'delayed', 'unknown', 'deleted'));
