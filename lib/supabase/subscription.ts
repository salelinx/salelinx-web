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
};

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

  const { data: tier } = await supabase
    .from("tier_limits")
    .select("*")
    .eq("tier_id", subscription.tier_id)
    .eq("version", subscription.tier_version)
    .maybeSingle();

  return {
    subscription,
    tier: (tier as TierConfig | null) ?? null,
  };
}

const ENTITLED_STATUSES = new Set<SubscriptionRow["status"]>([
  "active",
  "trialing",
]);

export function isEntitled(sub: SubscriptionRow | null): boolean {
  return sub !== null && ENTITLED_STATUSES.has(sub.status);
}

export function trialDaysRemaining(sub: SubscriptionRow | null): number | null {
  if (!sub || sub.status !== "trialing" || !sub.current_period_end) return null;
  const ms = new Date(sub.current_period_end).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
