import { createServerClient } from "./server";
import type { TierConfig } from "@/lib/types/tiers";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier_id: string;
  tier_version: number;
  status: "active" | "past_due" | "canceled" | "incomplete" | "trialing";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  /** When this subscription first took a successful payment; null = never. */
  first_paid_at: string | null;
  /** When the current run of failed payments started. */
  past_due_since: string | null;
};

/** Tier row a trialing subscription resolves to, whatever Stripe billed. */
const TRIAL_TIER_ID = "trial";

// Statuses that represent the user's current plan. Preferred over lapsed
// rows when a user has more than one (e.g. an old canceled trial plus a
// live subscription); "newest row wins" alone would let a stale row shadow
// the real plan.
const CURRENT_STATUSES = new Set<SubscriptionRow["status"]>([
  "active",
  "trialing",
  "past_due",
]);

export async function getCurrentSubscription(
  userId: string,
): Promise<{ subscription: SubscriptionRow | null; tier: TierConfig | null }> {
  const supabase = await createServerClient();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (subs ?? []) as SubscriptionRow[];
  const subscription =
    rows.find((r) => CURRENT_STATUSES.has(r.status)) ?? rows[0] ?? null;
  if (!subscription) return { subscription: null, tier: null };

  // A trialing row resolves to the "trial" tier, not the Starter tier Stripe
  // billed it against. The trial is deliberately capped tighter than Starter,
  // which is what makes upgrading worth doing, so it owns a row of its own.
  // Keep this in step with the extension's utils/cloud/subscription.ts.
  const tierId =
    subscription.status === "trialing" ? TRIAL_TIER_ID : subscription.tier_id;

  const { data: tier } = await supabase
    .from("tier_limits")
    .select("*")
    .eq("tier_id", tierId)
    .eq(
      "version",
      tierId === TRIAL_TIER_ID ? 1 : subscription.tier_version,
    )
    .maybeSingle();

  return {
    subscription,
    tier: (tier as TierConfig | null) ?? null,
  };
}

/**
 * How long a paying customer keeps access after a failed payment.
 * Mirrors GRACE_DAYS in supabase/functions/_shared/entitlement.ts.
 */
export const GRACE_DAYS = 7;

/**
 * Is this subscription entitled right now?
 *
 * MIRROR of isSubscriptionEntitled in
 * supabase/functions/_shared/entitlement.ts, which cannot be imported here
 * because supabase/functions is excluded from this repo's tsconfig. Unlike the
 * other keep-in-sync pairs, this one is checked: tests/entitlement.test.ts
 * runs the same matrix through both and fails if they diverge.
 *
 * This used to exclude past_due outright while getCurrentSubscription's
 * CURRENT_STATUSES included it, and the extension and resolve-category both
 * granted it unconditionally - so the same user was entitled or not depending
 * on which code path asked. All three now agree.
 *
 * Since migration 021 a comp row (no stripe_subscription_id) is also refused
 * once current_period_end has passed, which is what makes a comped month end
 * on its own.
 */
/**
 * A comp row (no Stripe subscription) past its end date. An undefined id means
 * a caller that did not select the column, which keeps the old behaviour rather
 * than reading a paying customer's renewal date as a deadline.
 */
function compExpired(sub: SubscriptionRow, now: number): boolean {
  if (sub.stripe_subscription_id !== null) return false;
  return past(sub.current_period_end, now);
}

/**
 * A trial whose end date has passed. Stripe moves a trial on the moment it
 * ends, so a `trialing` row still sitting past its end means that event never
 * landed - not that the trial runs forever.
 */
function trialExpired(sub: SubscriptionRow, now: number): boolean {
  if (sub.status !== "trialing") return false;
  return past(sub.current_period_end, now);
}

/** An end date that has gone by. Absent or unparseable is never "expired". */
function past(value: string | null | undefined, now: number): boolean {
  if (!value) return false;
  const end = new Date(value).getTime();
  return !Number.isNaN(end) && now >= end;
}

export function isEntitled(
  sub: SubscriptionRow | null,
  now: number = Date.now(),
): boolean {
  if (!sub) return false;
  if (compExpired(sub, now) || trialExpired(sub, now)) return false;
  if (sub.status === "active" || sub.status === "trialing") return true;
  if (sub.status !== "past_due") return false;

  // Never paid: a failed trial conversion, not a billing hiccup. Granting a
  // grace period here would extend the trial with an empty card.
  if (!sub.first_paid_at) return false;

  // Predates the rule; deny rather than grant forever.
  if (!sub.past_due_since) return false;

  const since = new Date(sub.past_due_since).getTime();
  if (Number.isNaN(since)) return false;
  return now - since < GRACE_DAYS * 24 * 60 * 60 * 1000;
}

export function trialDaysRemaining(sub: SubscriptionRow | null): number | null {
  if (!sub || sub.status !== "trialing" || !sub.current_period_end) return null;
  const ms = new Date(sub.current_period_end).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
