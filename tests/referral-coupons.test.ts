// Referee-side coupon resolution: create-checkout-session (applies the
// coupon) and get-referral-discount (displays its terms) must agree, and
// both go through referralCouponFor. The module reads Deno.env, so a
// minimal Deno stub is installed before import.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const env = new Map<string, string>();
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (k: string) => env.get(k) },
};

const { COUPON_TIERS, referralCouponFor } = await import(
  "../supabase/functions/_shared/referral-coupons"
);

describe("referralCouponFor", () => {
  beforeEach(() => env.clear());
  afterEach(() => env.clear());

  it("resolves each paid tier to its own coupon when set", () => {
    env.set("REFERRAL_COUPON_STARTER", "cs");
    env.set("REFERRAL_COUPON_PRO", "cp");
    env.set("REFERRAL_COUPON_BUSINESS", "cb");
    env.set("REFERRAL_COUPON_ID", "shared");
    expect(referralCouponFor("starter")).toBe("cs");
    expect(referralCouponFor("pro")).toBe("cp");
    expect(referralCouponFor("business")).toBe("cb");
  });

  it("falls back to the shared coupon for a tier without its own", () => {
    env.set("REFERRAL_COUPON_ID", "shared");
    env.set("REFERRAL_COUPON_PRO", "cp");
    expect(referralCouponFor("starter")).toBe("shared");
    expect(referralCouponFor("pro")).toBe("cp");
    expect(referralCouponFor("business")).toBe("shared");
  });

  it("gives an unknown tier only the shared coupon, never another plan's", () => {
    env.set("REFERRAL_COUPON_STARTER", "cs");
    env.set("REFERRAL_COUPON_ID", "shared");
    expect(referralCouponFor("enterprise")).toBe("shared");
    expect(referralCouponFor("free")).toBe("shared");
  });

  it("returns empty string (no discount) when nothing is configured", () => {
    expect(referralCouponFor("starter")).toBe("");
    expect(referralCouponFor("enterprise")).toBe("");
  });

  it("keeps the coupon tier list in step with the reward fraction table", async () => {
    const { REWARD_FRACTION_BP } = await import(
      "../supabase/functions/_shared/referral-reward-math"
    );
    expect([...COUPON_TIERS].sort()).toEqual(
      Object.keys(REWARD_FRACTION_BP).sort(),
    );
  });
});
