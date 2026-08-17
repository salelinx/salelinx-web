"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export type ReferralDiscount = {
  percentOff: number | null;
  amountOff: number | null; // minor units (pence/cents)
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  gbp: "£",
  usd: "$",
  eur: "€",
};

// Coupon terms are the same for everyone, so one fetch per page load is
// plenty - module scope dedupes it across the banner and every price card.
let discountPromise: Promise<ReferralDiscount | null> | null = null;

function fetchDiscount(): Promise<ReferralDiscount | null> {
  if (discountPromise) return discountPromise;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return Promise.resolve(null);
  discountPromise = fetch(`${base}/functions/v1/get-referral-discount`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => (body?.discount as ReferralDiscount | null) ?? null)
    // A discount we cannot read is shown as no discount - the coupon is
    // still applied server-side at checkout either way.
    .catch(() => null);
  return discountPromise;
}

/**
 * Whether the signed-in user has an unconverted referral, and what the
 * coupon is worth. Both null/false until resolved, so nothing flashes in
 * for users without a referral.
 */
export function useReferralDiscount(): {
  pending: boolean;
  discount: ReferralDiscount | null;
} {
  const [pending, setPending] = useState(false);
  const [discount, setDiscount] = useState<ReferralDiscount | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      supabase.rpc("has_pending_referral").then(({ data: hasPending, error }) => {
        if (cancelled || error || hasPending !== true) return;
        setPending(true);
        fetchDiscount().then((d) => {
          if (!cancelled) setDiscount(d);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { pending, discount };
}

/**
 * Apply a coupon to a display price like "£7.99".
 * Returns null when the discount cannot be applied faithfully - an amount_off
 * in a different currency to the listed price, or an unparseable price - in
 * which case callers show the original price untouched rather than inventing
 * a number that disagrees with Stripe's checkout.
 */
export function applyDiscount(
  price: string,
  discount: ReferralDiscount | null,
): string | null {
  if (!discount) return null;
  const match = price.match(/^(\D*)([\d.,]+)$/);
  if (!match) return null;
  const [, symbol, rawAmount] = match;
  const amount = Number(rawAmount.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;

  let discounted: number;
  if (discount.percentOff != null) {
    discounted = amount * (1 - discount.percentOff / 100);
  } else if (discount.amountOff != null) {
    const expected = discount.currency
      ? CURRENCY_SYMBOLS[discount.currency.toLowerCase()]
      : undefined;
    if (expected && symbol.trim() && expected !== symbol.trim()) return null;
    discounted = amount - discount.amountOff / 100;
  } else {
    return null;
  }

  if (discounted < 0) discounted = 0;
  return `${symbol}${discounted.toFixed(2)}`;
}

/** "20%" / "£3.00" — the headline value, for the offer label. */
export function discountValueLabel(discount: ReferralDiscount): string | null {
  if (discount.percentOff != null) {
    const pct = Number.isInteger(discount.percentOff)
      ? discount.percentOff
      : Number(discount.percentOff.toFixed(2));
    return `${pct}%`;
  }
  if (discount.amountOff != null) {
    const symbol = discount.currency
      ? (CURRENCY_SYMBOLS[discount.currency.toLowerCase()] ?? "")
      : "";
    return `${symbol}${(discount.amountOff / 100).toFixed(2)}`;
  }
  return null;
}
