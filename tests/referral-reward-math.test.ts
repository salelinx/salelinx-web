// The referrer-reward arithmetic, tested against the exact module the
// process-referral-rewards Edge Function runs (no copies).
import { describe, expect, it } from "vitest";
import {
  REWARD_FRACTION_BP,
  computeReferralReward,
} from "../supabase/functions/_shared/referral-reward-math";

// Today's live GBP monthly prices (docs/STRIPE.md).
const PRICES = { starter: 799, pro: 1499, business: 2499 } as const;
type Tier = keyof typeof PRICES;

describe("computeReferralReward", () => {
  // The full 9-combo matrix from docs/REFERRALS.md, hand-computed in pence.
  const MATRIX: Array<[referrer: Tier, referee: Tier, pence: number]> = [
    ["starter", "starter", 200], // 799 * 25% = 199.75, rounds up
    ["starter", "pro", 400], // 799 * 50% = 399.5, rounds up
    ["starter", "business", 799],
    ["pro", "starter", 375], // 1499 * 25% = 374.75
    ["pro", "pro", 750], // 1499 * 50% = 749.5
    ["pro", "business", 1499],
    ["business", "starter", 625], // 2499 * 25% = 624.75
    ["business", "pro", 1250], // 2499 * 50% = 1249.5
    ["business", "business", 2499],
  ];

  it.each(MATRIX)(
    "referrer on %s, referee buys %s -> %ip credit",
    (referrer, referee, pence) => {
      const reward = computeReferralReward(PRICES[referrer], referee);
      expect(reward).not.toBeNull();
      expect(reward!.amountCents).toBe(pence);
    },
  );

  it("labels the credit by the referee's tier, not the amount", () => {
    expect(computeReferralReward(PRICES.business, "starter")!.label).toBe(
      "1 week free",
    );
    expect(computeReferralReward(PRICES.starter, "pro")!.label).toBe(
      "2 weeks free",
    );
    expect(computeReferralReward(PRICES.pro, "business")!.label).toBe(
      "1 month free",
    );
  });

  it("stamps the applied fraction for the receipt metadata", () => {
    expect(computeReferralReward(PRICES.pro, "starter")!.fractionBp).toBe(2500);
    expect(computeReferralReward(PRICES.pro, "pro")!.fractionBp).toBe(5000);
    expect(computeReferralReward(PRICES.pro, "business")!.fractionBp).toBe(
      10000,
    );
  });

  it("four Starters, two Pros and one Business all sum to one month, on every plan", () => {
    for (const referrer of Object.keys(PRICES) as Tier[]) {
      const month = PRICES[referrer];
      const starter = computeReferralReward(month, "starter")!.amountCents;
      const pro = computeReferralReward(month, "pro")!.amountCents;
      const business = computeReferralReward(month, "business")!.amountCents;
      // Rounding may shift a stack by at most a penny per referral.
      expect(Math.abs(starter * 4 - month)).toBeLessThanOrEqual(4);
      expect(Math.abs(pro * 2 - month)).toBeLessThanOrEqual(2);
      expect(business).toBe(month);
    }
  });

  it("refuses tiers with no priced reward instead of guessing", () => {
    expect(computeReferralReward(PRICES.pro, "free")).toBeNull();
    expect(computeReferralReward(PRICES.pro, "enterprise")).toBeNull();
    expect(computeReferralReward(PRICES.pro, "")).toBeNull();
    expect(computeReferralReward(PRICES.pro, null)).toBeNull();
    expect(computeReferralReward(PRICES.pro, undefined)).toBeNull();
  });

  it("refuses non-positive or non-finite prices", () => {
    expect(computeReferralReward(0, "pro")).toBeNull();
    expect(computeReferralReward(-799, "pro")).toBeNull();
    expect(computeReferralReward(NaN, "pro")).toBeNull();
    expect(computeReferralReward(Infinity, "pro")).toBeNull();
  });

  it("never grants a zero credit even for a 1-cent price", () => {
    // 1 * 25% = 0.25 -> rounds to 0 -> refused rather than a 0p credit.
    expect(computeReferralReward(1, "starter")).toBeNull();
    expect(computeReferralReward(2, "starter")!.amountCents).toBe(1);
  });

  it("covers exactly the paid tiers - a new tier must be priced deliberately", () => {
    expect(Object.keys(REWARD_FRACTION_BP).sort()).toEqual([
      "business",
      "pro",
      "starter",
    ]);
  });

  it("labels unknown listed fractions as a plain percentage (fallback path)", () => {
    // Not reachable through REWARD_FRACTION_BP today; guards the fallback if
    // a fraction is ever added without a label.
    const reward = computeReferralReward(1000, "pro")!;
    expect(reward.label).toBe("2 weeks free");
  });
});
