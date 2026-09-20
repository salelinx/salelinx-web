// Is this subscription entitled right now?
//
// Canonical implementation. Two copies mirror it, because neither can import
// this file: `lib/supabase/subscription.ts` (supabase/functions is excluded
// from the Next tsconfig) and the extension's `utils/cloud/subscription.ts`
// (different repo). Unlike the other "keep in sync" pairs in this codebase,
// this one HAS an automated check: tests/entitlement.test.ts runs the same
// matrix through this and the website copy and fails if they disagree.
//
// The rule, and why:
//
//   active / trialing        entitled.
//
//   past_due                 entitled for GRACE_DAYS, but only if the
//                            subscription has paid at least once.
//
//   any comp row             only until current_period_end, if it has one.
//
// A comp row is one with no stripe_subscription_id: a support comp or a
// redeemed creator code (migration 021), granted by hand rather than billed.
// Those are the only rows whose period end is a deadline. On a Stripe-managed
// row it is a renewal date the webhook keeps moving, and enforcing it would cut
// off paying customers in the gap between a renewal and its webhook. Comp rows
// written before this rule have a null period end and stay open-ended.
//
// The two past_due cases look identical in the database and are completely
// different in kind:
//
//   A paying customer's card bounces in month six. Usually temporary - payday,
//   a replaced card, a bank blocking an unrecognised recurring charge. Cutting
//   them off converts a recoverable payment into a cancellation, so they get a
//   week to fix it.
//
//   A trial converts and the first ever charge fails. That account has paid
//   nothing. Granting it a grace period hands out the paid tier's allowance on
//   top of the trial's, for as long as Stripe's dunning runs - a trial
//   extension bought with an empty card. first_paid_at is null there, so it is
//   refused immediately.
//
// Anything else (canceled, incomplete, unpaid, no row at all) is not entitled.

/** How long a paying customer keeps access after a failed payment. */
export const GRACE_DAYS = 7;

export type EntitlementInput = {
  status: string | null;
  /** When this subscription first took a successful payment; null = never. */
  first_paid_at: string | null;
  /** When the current run of failed payments started. */
  past_due_since: string | null;
  /** Null means a comp row, granted by hand rather than billed by Stripe. */
  stripe_subscription_id?: string | null;
  /** On a comp row, the moment the grant runs out. */
  current_period_end?: string | null;
};

/**
 * A comp row past its end date.
 *
 * Only a caller that selected stripe_subscription_id can tell a comp row from
 * a billed one, so an undefined value means "not asked" and keeps the old
 * behaviour. Guessing the other way would read a paying customer's renewal
 * date as a deadline and cut them off at the end of every month.
 */
function compExpired(sub: EntitlementInput, now: number): boolean {
  if (sub.stripe_subscription_id !== null) return false;
  if (!sub.current_period_end) return false;
  const end = new Date(sub.current_period_end).getTime();
  return !Number.isNaN(end) && now >= end;
}

export function isSubscriptionEntitled(
  sub: EntitlementInput | null,
  now: number = Date.now(),
): boolean {
  if (!sub) return false;
  if (compExpired(sub, now)) return false;
  if (sub.status === "active" || sub.status === "trialing") return true;
  if (sub.status !== "past_due") return false;

  // Never paid: this is a failed trial conversion, not a billing hiccup.
  if (!sub.first_paid_at) return false;

  // A past_due row with no start stamp predates this rule. Deny rather than
  // grant forever, which is the behaviour being removed. The migration
  // backfills the rows that existed when it shipped.
  if (!sub.past_due_since) return false;

  const since = new Date(sub.past_due_since).getTime();
  if (Number.isNaN(since)) return false;
  return now - since < GRACE_DAYS * 24 * 60 * 60 * 1000;
}
