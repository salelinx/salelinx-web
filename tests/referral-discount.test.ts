// Referee-facing price display: the struck-through referred price on the
// pricing cards must never show a number checkout would contradict.
import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  discountDurationKey,
  discountValueLabel,
  type ReferralDiscount,
} from "@/lib/referral-discount";

const gbpOff = (pence: number): ReferralDiscount => ({
  percentOff: null,
  amountOff: pence,
  currency: "gbp",
  duration: "once",
  durationInMonths: null,
});

describe("applyDiscount", () => {
  it("computes the live per-tier first-month prices from the coupon amounts", () => {
    // The three live coupons (docs/STRIPE.md): 3.00 / 5.00 / 10.00 off.
    expect(applyDiscount("£7.99", gbpOff(300))).toBe("£4.99");
    expect(applyDiscount("£14.99", gbpOff(500))).toBe("£9.99");
    expect(applyDiscount("£24.99", gbpOff(1000))).toBe("£14.99");
  });

  it("applies percent coupons", () => {
    const pct: ReferralDiscount = {
      percentOff: 50,
      amountOff: null,
      currency: null,
      duration: "once",
      durationInMonths: null,
    };
    expect(applyDiscount("£14.99", pct)).toBe("£7.50");
  });

  it("refuses an amount_off in a different (or unprovable) currency", () => {
    expect(applyDiscount("£7.99", { ...gbpOff(300), currency: "usd" })).toBe(
      null,
    );
    expect(applyDiscount("£7.99", { ...gbpOff(300), currency: "cad" })).toBe(
      null,
    );
    expect(applyDiscount("£7.99", { ...gbpOff(300), currency: null })).toBe(
      null,
    );
    expect(applyDiscount("7.99", gbpOff(300))).toBe(null); // no symbol on the price
  });

  it("floors at zero rather than showing a negative price", () => {
    expect(applyDiscount("£7.99", gbpOff(1000))).toBe("£0.00");
  });

  it("returns null for unparseable prices and empty discounts", () => {
    expect(applyDiscount("Contact us", gbpOff(300))).toBe(null);
    expect(applyDiscount("£7.99", null)).toBe(null);
    expect(
      applyDiscount("£7.99", { ...gbpOff(300), amountOff: null }),
    ).toBe(null);
  });
});

describe("discountValueLabel", () => {
  it("renders percent and amount headlines", () => {
    expect(
      discountValueLabel({
        percentOff: 20,
        amountOff: null,
        currency: null,
        duration: "once",
        durationInMonths: null,
      }),
    ).toBe("20%");
    expect(discountValueLabel(gbpOff(300))).toBe("£3.00");
  });

  it("refuses an amount in an unknown currency (would read as site currency)", () => {
    expect(discountValueLabel({ ...gbpOff(300), currency: "cad" })).toBe(null);
  });
});

describe("discountDurationKey", () => {
  it("maps coupon durations to the price-note copy", () => {
    expect(discountDurationKey(gbpOff(300))).toBe("first-month");
    expect(
      discountDurationKey({
        ...gbpOff(300),
        duration: "repeating",
        durationInMonths: 2,
      }),
    ).toBe("months");
    expect(
      discountDurationKey({ ...gbpOff(300), duration: "forever" }),
    ).toBe("forever");
  });
});
