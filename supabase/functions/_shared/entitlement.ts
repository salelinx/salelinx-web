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
};

export function isSubscriptionEntitled(
  sub: EntitlementInput | null,
  now: number = Date.now(),
): boolean {
  if (!sub) return false;
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
