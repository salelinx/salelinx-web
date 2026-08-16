-- Edge hardening round 2: Stripe webhook replay guard + support message caps.

-- =============================================================================
-- 1. stripe_webhook_events - processed-event ids for the replay guard
-- =============================================================================
-- Written only by the stripe-webhook Edge Function (service role). Rows older
-- than 30 days are pruned by the function itself; Stripe never redelivers
-- beyond that horizon.

CREATE TABLE public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_webhook_events_received
  ON public.stripe_webhook_events(received_at);

-- Service role bypasses RLS; enabling it with no policies locks everyone
-- else out entirely.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Support message length caps
-- =============================================================================
-- TEXT columns had no bound, so a multi-megabyte "message" would flow into
-- the staff notification email in full. 10k chars is far above any real
-- ticket. NOT VALID: applies to new rows only, so any oversized historical
-- row cannot break the migration.

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_message_len
    CHECK (char_length(message) <= 10000) NOT VALID;

ALTER TABLE public.support_ticket_replies
  ADD CONSTRAINT support_ticket_replies_body_len
    CHECK (char_length(body) <= 10000) NOT VALID;
