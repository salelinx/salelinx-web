-- Grace period on a failed payment, but only for people who have actually paid.
--
-- Until now `past_due` kept full entitlement with no time bound, so two very
-- different situations were treated the same:
--
--   1. A paying customer's card bounces in month six. Usually temporary
--      (payday, a replaced card). Cutting them off turns a recoverable charge
--      into a cancellation. They deserve a grace period.
--   2. A trial converts and the FIRST EVER charge fails. That user has never
--      paid us anything. Under the old rule they kept Starter's 150
--      crosslists for as long as Stripe's dunning ran - on top of the 50 they
--      already had free during the trial. That is a trial extension with an
--      empty card, and the existing abuse guards (disposable email, platform
--      tombstones) do not cover it.
--
-- New rule: `past_due` is entitled only if the subscription has paid at least
-- once AND has been past_due for less than 7 days. Case 2 has no
-- first_paid_at, so it is locked out immediately.
--
-- Two columns rather than asking Stripe per request: entitlement is checked on
-- every gated action, in the extension from a cached blob that may be offline.

alter table public.subscriptions
  add column if not exists first_paid_at timestamptz,
  add column if not exists past_due_since timestamptz;

comment on column public.subscriptions.first_paid_at is
  'When this subscription first took a successful payment. NULL means it has never paid - a trial that has not converted, or one whose first charge failed. Stamped once by stripe-webhook on invoice.payment_succeeded; never cleared.';

comment on column public.subscriptions.past_due_since is
  'When the current run of failed payments started. Set by stripe-webhook on invoice.payment_failed only if not already set, so retries do not extend the grace window. Cleared on a successful payment.';

-- Backfill. `active` means Stripe has taken money (or the row is a comp), so
-- those are established customers and must not be locked out the moment a
-- renewal bounces. created_at is the best proxy we have: there is no payment
-- history table, and the exact date only matters for being non-null.
--
-- Deliberately NOT backfilling `past_due` rows. The only one today is a trial
-- whose first charge failed for insufficient funds, which is precisely case 2
-- above - it should stay NULL and lock out.
update public.subscriptions
set first_paid_at = created_at
where status = 'active' and first_paid_at is null;

-- Any row already sitting in past_due gets its clock started now rather than
-- retroactively, so nobody is locked out by surprise for a window that was
-- never communicated to them.
update public.subscriptions
set past_due_since = now()
where status = 'past_due' and past_due_since is null;
