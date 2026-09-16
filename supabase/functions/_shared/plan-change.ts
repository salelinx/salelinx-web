// Decision logic for change-plan, split out so it can be tested without a
// Stripe key or a deployed function. The handler does IO; this decides what
// the Stripe update should be. Same reason _shared/referral-coupons is split.

/** Ladder order, low to high. Only used to refuse downgrades. */
export const TIER_RANK: Record<string, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

export type PlanChangeInput = {
  /** Stripe subscription status. */
  status: string;
  /**
   * Tier the user is BILLED on, read from the Stripe price's metadata.
   *
   * NOT subscriptions.tier_id. A trialing row says 'starter' because that is
   * the price Stripe holds, while entitlements resolve it to the tighter
   * 'trial' config. Comparing the row's tier would make "trialing on Starter,
   * upgrade to Starter" look like a downgrade and refuse the exact case this
   * function exists for.
   */
  billedTier: string;
  /** Tier the user asked for, or undefined to stay put and just start paying. */
  requestedTier?: string;
};

export type PlanChangeDecision =
  | { kind: "error"; error: string; status: number }
  | {
      kind: "update";
      /** End the trial now, so billing starts today. */
      endTrial: boolean;
      /** Tier to move to, or undefined to keep the current price. */
      changeToTier?: string;
    };

/**
 * Work out what change-plan should do. Returns an error decision rather than
 * throwing so the handler can map it straight to a response.
 */
export function decidePlanChange(input: PlanChangeInput): PlanChangeDecision {
  const { status, billedTier, requestedTier } = input;

  if (status === "canceled") {
    return { kind: "error", error: "subscription_canceled", status: 409 };
  }

  const isTrialing = status === "trialing";
  let changeToTier: string | undefined;

  if (requestedTier && requestedTier !== billedTier) {
    const to = TIER_RANK[requestedTier];
    if (to === undefined) {
      return { kind: "error", error: "unknown_tier", status: 400 };
    }
    const from = TIER_RANK[billedTier];
    if (from !== undefined && to < from) {
      // Downgrades go through the Customer Portal on purpose: Stripe owns the
      // proration and refund wording there.
      return { kind: "error", error: "downgrade_not_supported", status: 400 };
    }
    changeToTier = requestedTier;
  }

  // Already on this tier and already paying: nothing to do. Report it rather
  // than making a no-op Stripe write.
  if (!isTrialing && !changeToTier) {
    return { kind: "error", error: "already_on_plan", status: 409 };
  }

  return { kind: "update", endTrial: isTrialing, changeToTier };
}
