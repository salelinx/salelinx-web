// deno-lint-ignore-file
// Which referee coupon applies to which tier.
//
// The referee offer is a first-month PRICE PER PLAN (Starter 4.99, Pro 9.99,
// Business 14.99 against list prices of 7.99, 14.99 and 24.99). Those are
// three different reductions (3.00 / 5.00 / 10.00 off, or 37.5% / 33.4% /
// 40.0%), so they cannot be expressed as one Stripe coupon.
//
// This lives in _shared because two functions have to agree on it exactly:
// `create-checkout-session` applies the coupon, and `get-referral-discount`
// tells the pricing page what to display. If they ever resolved coupons
// differently the site would advertise a price that checkout contradicts,
// which is worse than showing no discount at all.

/** Paid tiers that can carry their own referral coupon. Anything else falls
 *  through to the shared coupon, so a new tier cannot silently pick up
 *  another plan's coupon by name. */
export const COUPON_TIERS = ["starter", "pro", "business"] as const;

export type CouponTier = (typeof COUPON_TIERS)[number];

/**
 * The referee coupon id for `tier`: the per-tier secret when set, otherwise
 * the shared `REFERRAL_COUPON_ID`, otherwise "" meaning no discount.
 *
 * The shared fallback is deliberate. Between deploying this and setting
 * `REFERRAL_COUPON_STARTER` / `_PRO` / `_BUSINESS`, every tier keeps the old
 * single coupon instead of losing its discount, and a tier can be rolled out
 * one at a time. Unset the shared secret once all three are live.
 */
export function referralCouponFor(tier: string): string {
  const shared = Deno.env.get("REFERRAL_COUPON_ID") ?? "";
  if (!(COUPON_TIERS as readonly string[]).includes(tier)) return shared;
  return Deno.env.get(`REFERRAL_COUPON_${tier.toUpperCase()}`) || shared;
}
