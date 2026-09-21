// Reading the subscription id off an invoice, across Stripe API versions.
//
// This has a test because it broke in production and nothing noticed. Both
// invoice handlers read `invoice.subscription`, returned early when it was
// null, and answered 200. Stripe moved the field to
// `parent.subscription_details.subscription` in 2025-04-30.basil, and webhook
// payloads render at the ACCOUNT's API version rather than the one the
// function pins, so the shape changed with no deploy on our side.
//
// The damage was invisible: first_paid_at was never stamped, so every paying
// customer looked like they had never paid and would be locked out the instant
// a renewal bounced instead of getting the 7-day grace; past_due_since was
// never stamped or cleared; and referral conversions, which hang off the
// success handler, never fired at all.

import { describe, expect, it } from "vitest";

const { subscriptionIdFromInvoice, isSubscriptionInvoice } = await import(
  "../supabase/functions/_shared/stripe-invoice"
);

type Invoice = Parameters<typeof subscriptionIdFromInvoice>[0];
const invoice = (shape: Record<string, unknown>) => shape as unknown as Invoice;

describe("subscriptionIdFromInvoice", () => {
  it("reads the pre-basil field", () => {
    expect(subscriptionIdFromInvoice(invoice({ subscription: "sub_123" }))).toBe("sub_123");
  });

  it("reads the basil field, which is where production actually is", () => {
    expect(
      subscriptionIdFromInvoice(
        invoice({ parent: { subscription_details: { subscription: "sub_456" } } }),
      ),
    ).toBe("sub_456");
  });

  it("accepts an expanded object in either position", () => {
    expect(subscriptionIdFromInvoice(invoice({ subscription: { id: "sub_789" } }))).toBe("sub_789");
    expect(
      subscriptionIdFromInvoice(
        invoice({ parent: { subscription_details: { subscription: { id: "sub_abc" } } } }),
      ),
    ).toBe("sub_abc");
  });

  it("returns null for a one-off invoice", () => {
    expect(subscriptionIdFromInvoice(invoice({}))).toBeNull();
    expect(subscriptionIdFromInvoice(invoice({ parent: { type: "quote_details" } }))).toBeNull();
  });
});

describe("isSubscriptionInvoice", () => {
  // The handlers throw when an invoice belongs to a subscription but the id
  // cannot be read, and return quietly when there is genuinely no subscription.
  // Getting this backwards either hides the next breakage or throws on every
  // one-off invoice.
  it("is true whenever a subscription marker is present", () => {
    expect(isSubscriptionInvoice(invoice({ subscription: "sub_123" }))).toBe(true);
    expect(
      isSubscriptionInvoice(invoice({ parent: { subscription_details: { subscription: null } } })),
    ).toBe(true);
  });

  it("is false for a one-off invoice", () => {
    expect(isSubscriptionInvoice(invoice({}))).toBe(false);
    expect(isSubscriptionInvoice(invoice({ parent: { type: "quote_details" } }))).toBe(false);
  });
});
