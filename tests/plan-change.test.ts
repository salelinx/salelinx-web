// change-plan's decision table.
//
// The point of the function is that a trialing user can stop waiting and
// start paying. The failure that matters most is the quiet one: refusing the
// upgrade, which puts the user back where they started (capped at 50 with no
// way out) but with a button that looks like it should have worked.

import { describe, expect, it } from "vitest";

const { decidePlanChange } = await import(
  "../supabase/functions/_shared/plan-change"
);

describe("decidePlanChange", () => {
  describe("a trialing user upgrading", () => {
    it("ends the trial when no tier is named (start Starter early)", () => {
      const d = decidePlanChange({ status: "trialing", billedTier: "starter" });
      expect(d).toEqual({ kind: "update", endTrial: true, changeToTier: undefined });
    });

    // The whole reason billedTier is read from the Stripe price and not from
    // subscriptions.tier_id. A trialing row says tier_id='starter' while
    // entitlements resolve it to the tighter 'trial' config; comparing the
    // row's tier would rank this trial(0) -> starter(1) as fine, but comparing
    // a *resolved* 'trial' against itself must not look like a no-op either.
    it("ends the trial when the named tier is the one being trialled", () => {
      const d = decidePlanChange({
        status: "trialing",
        billedTier: "starter",
        requestedTier: "starter",
      });
      expect(d).toEqual({ kind: "update", endTrial: true, changeToTier: undefined });
    });

    it("ends the trial AND swaps the price when jumping to Pro", () => {
      const d = decidePlanChange({
        status: "trialing",
        billedTier: "starter",
        requestedTier: "pro",
      });
      expect(d).toEqual({ kind: "update", endTrial: true, changeToTier: "pro" });
    });

    it("ends the trial AND swaps the price when jumping to Business", () => {
      const d = decidePlanChange({
        status: "trialing",
        billedTier: "starter",
        requestedTier: "business",
      });
      expect(d).toEqual({
        kind: "update",
        endTrial: true,
        changeToTier: "business",
      });
    });
  });

  describe("a paying user upgrading", () => {
    it("swaps the price without touching the trial", () => {
      const d = decidePlanChange({
        status: "active",
        billedTier: "starter",
        requestedTier: "pro",
      });
      expect(d).toEqual({ kind: "update", endTrial: false, changeToTier: "pro" });
    });

    it("refuses a no-op rather than making an empty Stripe write", () => {
      const d = decidePlanChange({
        status: "active",
        billedTier: "pro",
        requestedTier: "pro",
      });
      expect(d).toEqual({
        kind: "error",
        error: "already_on_plan",
        status: 409,
      });
    });

    it("refuses when no tier is named and there is no trial to end", () => {
      const d = decidePlanChange({ status: "active", billedTier: "pro" });
      expect(d).toMatchObject({ kind: "error", error: "already_on_plan" });
    });

    // past_due keeps its tier as a payment-retry grace period, so an upgrade
    // from it is a legitimate way to fix a failed payment.
    it("allows an upgrade from past_due", () => {
      const d = decidePlanChange({
        status: "past_due",
        billedTier: "starter",
        requestedTier: "pro",
      });
      expect(d).toEqual({ kind: "update", endTrial: false, changeToTier: "pro" });
    });
  });

  describe("what it refuses", () => {
    it("refuses a downgrade, which belongs in the Customer Portal", () => {
      const d = decidePlanChange({
        status: "active",
        billedTier: "business",
        requestedTier: "starter",
      });
      expect(d).toEqual({
        kind: "error",
        error: "downgrade_not_supported",
        status: 400,
      });
    });

    it("refuses a downgrade even mid-trial, rather than ending the trial anyway", () => {
      const d = decidePlanChange({
        status: "trialing",
        billedTier: "pro",
        requestedTier: "starter",
      });
      expect(d).toMatchObject({ error: "downgrade_not_supported" });
    });

    it("refuses a tier it does not know", () => {
      const d = decidePlanChange({
        status: "trialing",
        billedTier: "starter",
        requestedTier: "enterprise",
      });
      expect(d).toEqual({ kind: "error", error: "unknown_tier", status: 400 });
    });

    it("refuses a canceled subscription", () => {
      const d = decidePlanChange({
        status: "canceled",
        billedTier: "starter",
        requestedTier: "pro",
      });
      expect(d).toEqual({
        kind: "error",
        error: "subscription_canceled",
        status: 409,
      });
    });
  });

  // A custom tier (pro_custom_acme) has no rank. It must not be treated as
  // rank 0 and refused as a downgrade target, nor silently rank-compared.
  it("allows moving off an unranked custom tier", () => {
    const d = decidePlanChange({
      status: "active",
      billedTier: "pro_custom_acme",
      requestedTier: "business",
    });
    expect(d).toEqual({
      kind: "update",
      endTrial: false,
      changeToTier: "business",
    });
  });
});
