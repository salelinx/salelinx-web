-- Two repairs to the payment path, both found auditing why one user's card was
-- never charged (it was: the charge was attempted and declined).

-- =============================================================================
-- 1. The status CHECK did not cover every Stripe status
-- =============================================================================
-- Stripe has eight subscription statuses. This allowed five. `unpaid`,
-- `incomplete_expired` and `paused` all violated the constraint, so
-- handleSubscriptionUpdated threw, the webhook answered 500, Stripe retried
-- until it gave up, and the row kept whatever status it had before.
--
-- That is not a theoretical hole: the database holds a row still marked
-- `trialing` whose trial ended on 31 August, three weeks before this migration.
-- A row frozen mid-transition is exactly what a rejected status write leaves
-- behind.
--
-- Entitlement is unaffected by widening it. CURRENT_STATUSES and
-- isSubscriptionEntitled both work from an allowlist, so the three new values
-- read as "lapsed" and grant nothing, which is what they mean.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'active'::TEXT,
    'past_due'::TEXT,
    'canceled'::TEXT,
    'incomplete'::TEXT,
    'incomplete_expired'::TEXT,
    'trialing'::TEXT,
    'unpaid'::TEXT,
    'paused'::TEXT
  ]));

-- =============================================================================
-- 2. first_paid_at, for customers who paid while the stamp was broken
-- =============================================================================
-- invoice.payment_succeeded never resolved its subscription id (see
-- _shared/stripe-invoice.ts), so first_paid_at was never stamped by the
-- webhook. Migration 020 backfilled it once, but only for rows that were
-- `active` at that moment; a row sitting in past_due that day got the
-- past_due_since backfill instead and then recovered to active with
-- first_paid_at still null.
--
-- This matters because isSubscriptionEntitled refuses a past_due row that has
-- never paid. Such a customer is one bounced renewal away from being locked out
-- with no grace period at all, despite having paid every month.
--
-- Stripe-managed and active is the test for "money has arrived": a trial that
-- never converted is `past_due` or `canceled`, and a comp row has no Stripe id.
-- created_at is the same proxy migration 020 used; only non-nullness matters.

UPDATE public.subscriptions
SET first_paid_at = created_at
WHERE status = 'active'
  AND stripe_subscription_id IS NOT NULL
  AND first_paid_at IS NULL;

-- A past_due clock on an active row is stale by definition: the failure run
-- ended when the payment went through. handlePaymentSucceeded clears it, and
-- never ran either, so the rows that recovered still carry one. Left alone it
-- would shorten the next real grace window, because the stamp is only written
-- when absent.
UPDATE public.subscriptions
SET past_due_since = NULL
WHERE status = 'active' AND past_due_since IS NOT NULL;
