-- Auto-Markdown — per-listing opt-in + config + state
--
-- markdown_enabled          user opts in this listing for scheduled price drops
-- markdown_percent          percentage drop applied each time the interval elapses (1-100)
-- markdown_interval_days    cadence — drop once the listing has aged this many days
--                           since either creation or the last drop (whichever is later)
--
-- original_price            price at the moment of the FIRST drop (source of truth for %-math;
--                           never overwritten — prevents compounding across runs)
-- last_markdown_at          ms timestamp of the most recent drop
-- markdown_drop_count       how many drops have been applied so far. Each cycle drops by
--                           another `markdown_percent`% of `original_price`, so cycle N
--                           targets `original_price * (1 - N*percent/100)`. Persists with
--                           originalPrice — cleared together when disabled or relisted.
-- min_price                 hard per-listing floor. Raw drop clamped to max(computed, min_price).
--                           Null = no floor (apart from platform minimums).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS markdown_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS markdown_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS markdown_interval_days NUMERIC,
  ADD COLUMN IF NOT EXISTS original_price NUMERIC,
  ADD COLUMN IF NOT EXISTS last_markdown_at BIGINT,
  ADD COLUMN IF NOT EXISTS markdown_drop_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_price NUMERIC;
