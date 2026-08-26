// Pure reward arithmetic for the referral program - no Deno APIs, so the
// same file the Edge Function runs is also imported by the vitest suite
// (tests/referral-reward-math.test.ts). Keep it dependency-free.
//
// The reward is a FRACTION of the referrer's own monthly price, keyed on the
// tier the REFEREE bought: Starter = a week, Pro = two weeks, Business = a
// month. "A week" is deliberately a quarter of a month rather than 7/30.44
// days: it keeps the arithmetic customers actually do exact - 4 Starters,
// 2 Pros or 1 Business all come to precisely one free month, on every plan.

/** Fraction of the referrer's monthly price per referee tier, in basis
 *  points so receipts store exact integers (2500 = 25%).
 *
 *  A tier missing from this table is NOT given a default. Guessing would
 *  either overpay (100%) or shortchange (25%) on a plan nobody priced the
 *  reward for, so an unknown tier defers with an error log, the same as a
 *  non-monthly price does. Keep in step with COUPON_TIERS in
 *  referral-coupons.ts and the table in docs/REFERRALS.md. */
export const REWARD_FRACTION_BP: Record<string, number> = {
  starter: 2500,
  pro: 5000,
  business: 10000,
};

/** For the Stripe description on the credit, which the referrer reads on
 *  their invoice. Fractions not listed fall back to a plain percentage. */
const REWARD_LABEL: Record<number, string> = {
  2500: "1 week free",
  5000: "2 weeks free",
  10000: "1 month free",
};

export interface RewardComputation {
  /** Credit in minor units (pence/cents), always > 0. */
  amountCents: number;
  /** The fraction applied, in basis points - stamped into txn metadata. */
  fractionBp: number;
  /** Invoice-facing description suffix, e.g. "2 weeks free". */
  label: string;
}

/**
 * The credit earned for one conversion: `unitAmountCents` is the referrer's
 * own monthly price, `refereeTierId` the tier the referee is on at payout.
 *
 * Returns null when no reward can be derived faithfully - unknown/missing
 * tier, or a non-positive price - so the caller defers instead of guessing.
 *
 * Math.round on the fraction: every current price/fraction pair lands on a
 * whole number of pence anyway (799 * 25% = 199.75 -> 200 is the one that
 * rounds), and a half-penny must not block a payout.
 */
export function computeReferralReward(
  unitAmountCents: number,
  refereeTierId: string | null | undefined,
): RewardComputation | null {
  if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) return null;
  const fractionBp = REWARD_FRACTION_BP[refereeTierId ?? ""];
  if (!fractionBp) return null;
  const amountCents = Math.round((unitAmountCents * fractionBp) / 10000);
  if (amountCents <= 0) return null;
  return {
    amountCents,
    fractionBp,
    label: REWARD_LABEL[fractionBp] ?? `${fractionBp / 100}% of a month`,
  };
}
