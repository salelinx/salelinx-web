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

export async function getCurrentSubscription(
  userId: string,
): Promise<{ subscription: SubscriptionRow | null; tier: TierConfig | null }> {
  const supabase = await createServerClient();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const subscription = (subs?.[0] as SubscriptionRow | undefined) ?? null;
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
