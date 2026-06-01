-- Widen the listings.status CHECK constraint to match the app's Listing type.
--
-- Migration 001 only allowed ('active', 'sold', 'reserved', 'draft', 'unknown'),
-- but `Listing['status']` in src/utils/storage/listings-store.ts also emits
-- 'hidden' (user-hidden Vinted items that are still editable) and 'delayed'
-- (Vinted moderation-locked items). Upserts of those listings were dying with
-- `listings_status_check` violations, breaking cloud sync for any seller with
-- hidden/delayed items.
--
-- IF EXISTS + re-ADD so re-running is safe on environments where the
-- constraint may already have been altered by hand.

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
    CHECK (status IN ('active', 'sold', 'reserved', 'draft', 'hidden', 'delayed', 'unknown'));
