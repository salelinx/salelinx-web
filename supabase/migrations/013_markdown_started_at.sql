-- Auto-Markdown: per-listing "schedule basis" column.
--
-- When a user opts a listing in, they can now choose whether the drop cadence
-- counts from:
--   (a) the listing's original createdAt (existing behavior — null value), or
--   (b) a manually-chosen starting point (e.g. "Start from now").
--
-- If markdown_started_at IS NULL, the scheduler falls back to created_at as
-- before — so existing opt-ins keep their current schedule.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS markdown_started_at TIMESTAMPTZ NULL;
