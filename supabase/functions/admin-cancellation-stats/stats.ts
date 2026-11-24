// Pure classification for admin-cancellation-stats, kept free of Stripe and
// Deno so vitest can run it. Times are Unix seconds, as Stripe sends them.

/** The parts of a Stripe subscription this function reads. */
export type SubFacts = {
  status: string;
  cancel_at_period_end: boolean;
  // A cancellation scheduled for a set date, the API's other way to end later.
  cancel_at: number | null;
  // For a cancellation at period end, when it was asked for; otherwise when it
  // ended. Stripe documents this, and the day-of-trial figure relies on it.
  canceled_at: number | null;
  ended_at: number | null;
  start_date: number;
  trial_start: number | null;
  trial_end: number | null;
  current_period_end: number;
  // cancellation_details.reason: cancellation_requested, payment_failed,
  // payment_disputed, or null.
  cancel_reason: string | null;
};

// trial: asked to cancel inside the trial, so it never paid.
// paying: asked to cancel after paying (or with no trial at all).
// failed: Stripe ended it because payment failed or was disputed.
export type CancellationKind = "trial" | "paying" | "failed";
// scheduled: still running, set to end. ended: already over.
export type CancellationState = "scheduled" | "ended";

export type Classified = {
  kind: CancellationKind;
  state: CancellationState;
  requestedAt: number;
  endsAt: number;
  // Whole days from the subscription's start to the request. Day 0 is the
  // day it started.
  day: number;
};

const LIVE = new Set(["trialing", "active", "past_due"]);
const INVOLUNTARY = new Set(["payment_failed", "payment_disputed"]);
const DAY = 86400;

/**
 * Whether a subscription has ended or is set to end, and how. Null for one that
 * is running normally or never started (incomplete, incomplete_expired).
 */
export function classifyCancellation(s: SubFacts): Classified | null {
  let state: CancellationState;
  if (s.status === "canceled") state = "ended";
  else if (LIVE.has(s.status) && (s.cancel_at_period_end || s.cancel_at !== null))
    state = "scheduled";
  else return null;

  const endsAt =
    state === "ended"
      ? (s.ended_at ?? s.canceled_at ?? s.current_period_end)
      : (s.cancel_at ?? s.current_period_end);
  const requestedAt = s.canceled_at ?? endsAt;

  let kind: CancellationKind;
  if (s.cancel_reason !== null && INVOLUNTARY.has(s.cancel_reason)) kind = "failed";
  else if (s.trial_end !== null && requestedAt <= s.trial_end) kind = "trial";
  else kind = "paying";

  return {
    kind,
    state,
    requestedAt,
    endsAt,
    day: Math.max(0, Math.floor((requestedAt - s.start_date) / DAY)),
  };
}

/**
 * A trial that is over: when it finished and whether the subscription ever
 * paid. Null for a subscription with no trial or one still in it. A trial
 * cancelled straight away finished when it ended, not at its planned end.
 */
export function finishedTrial(
  s: SubFacts,
  now: number,
  paid: boolean,
): { at: number; paid: boolean } | null {
  if (s.trial_start === null || s.trial_end === null || s.status === "trialing")
    return null;
  const at =
    s.status === "canceled"
      ? Math.min(s.ended_at ?? s.trial_end, s.trial_end)
      : s.trial_end;
  return at <= now ? { at, paid } : null;
}

export type Payment = { at: number; amount: number };

/** The amount of the most recent payment, or null when nothing was paid. */
export function latestAmount(payments: Payment[]): number | null {
  let last: Payment | null = null;
  for (const p of payments) if (!last || p.at > last.at) last = p;
  return last ? last.amount : null;
}
