"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export type ReferralDiscount = {
  percentOff: number | null;
  amountOff: number | null; // minor units (pence/cents), primary currency
  currency: string | null;
  // amount_off per currency for multi-currency coupons, keyed by lowercase
  // code. Absent on percent coupons and on responses cached from before the
  // endpoint exposed it.
  amountOffByCurrency?: Record<string, number> | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  gbp: "£",
  usd: "$",
  eur: "€",
};

// Reverse map: the symbol on a display price identifies its currency, so a
// multi-currency coupon can resolve the matching amount_off.
const SYMBOL_CURRENCIES: Record<string, string> = {
  "£": "gbp",
  $: "usd",
  "€": "eur",
};

/** How long the coupon lasts, as a short label for the price card. A `once`
 *  coupon is the normal case and must NOT be rendered as if it were the
 *  ongoing price. */
export function discountDurationKey(
  discount: ReferralDiscount,
): "first-month" | "months" | "forever" {
  if (discount.duration === "forever") return "forever";
  if (
    discount.duration === "repeating" &&
    (discount.durationInMonths ?? 0) > 1
  ) {
    return "months";
  }
  return "first-month";
}

/** What the coupon endpoint returns: the shared coupon (legacy, and still the
 *  fallback for any tier without its own) plus the per-tier terms. */
export type ReferralDiscountTerms = {
  shared: ReferralDiscount | null;
  byTier: Partial<Record<string, ReferralDiscount | null>>;
};

// Coupon terms are the same for every visitor, so one fetch per page load is
// plenty - module scope dedupes it across the banner and every price card.
let discountPromise: Promise<ReferralDiscountTerms> | null = null;

const NO_TERMS: ReferralDiscountTerms = { shared: null, byTier: {} };

function fetchDiscount(): Promise<ReferralDiscountTerms> {
  if (discountPromise) return discountPromise;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return Promise.resolve(NO_TERMS);
  discountPromise = fetch(`${base}/functions/v1/get-referral-discount`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => ({
      // `discount` is the endpoint's original single-coupon field. It is still
      // read here so a response cached from before per-tier pricing shipped
      // renders the old offer rather than nothing.
      shared: (body?.discount as ReferralDiscount | null) ?? null,
      byTier:
        (body?.byTier as Record<string, ReferralDiscount | null> | undefined) ??
        {},
    }))
    // A discount we cannot read is shown as no discount - the coupon is
    // still applied server-side at checkout either way.
    .catch(() => NO_TERMS);
  return discountPromise;
}

/**
 * Whether the signed-in user has an unconverted referral, and what the
 * coupon is worth. Both null/false until resolved, so nothing flashes in
 * for users without a referral.
 *
 * Pass `tier` on a pricing card: the offer is a first-month price per plan,
 * so each card needs its own coupon. Called without one (the banner), it
 * reports the shared coupon, which is null once every tier has its own - the
 * banner then falls back to its numberless copy, which is the honest thing to
 * say when there is no single figure to quote.
 */
export function useReferralDiscount(tier?: string): {
  pending: boolean;
  discount: ReferralDiscount | null;
} {
  const [pending, setPending] = useState(false);
  const [terms, setTerms] = useState<ReferralDiscountTerms>(NO_TERMS);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      supabase
        .rpc("has_pending_referral")
        .then(({ data: hasPending, error }) => {
          if (cancelled || error || hasPending !== true) return;
          setPending(true);
          fetchDiscount().then((d) => {
            if (!cancelled) setTerms(d);
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Same resolution order as the server's referralCouponFor: the tier's own
  // coupon, then the shared one. Anything else would advertise a price
  // checkout disagrees with.
  const discount = (tier ? terms.byTier[tier] : null) ?? terms.shared;

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
    // An amount_off is only meaningful in its own currency. The page price's
    // symbol identifies which currency is being displayed; a multi-currency
    // coupon resolves that currency's own amount_off, a single-currency one
    // must match its primary currency exactly. Refuse whenever we cannot
    // PROVE the match - including a currency missing from the maps above,
    // which previously fell through the `expected &&` guard and subtracted
    // e.g. 5 CAD from a GBP price.
    const pageCurrency = SYMBOL_CURRENCIES[symbol.trim()];
    if (!pageCurrency) return null;
    const perCurrency = discount.amountOffByCurrency?.[pageCurrency];
    if (perCurrency != null) {
      discounted = amount - perCurrency / 100;
    } else {
      const expected = discount.currency
        ? CURRENCY_SYMBOLS[discount.currency.toLowerCase()]
        : undefined;
      if (!expected || expected !== symbol.trim()) return null;
      discounted = amount - discount.amountOff / 100;
    }
  } else {
    return null;
  }

  if (discounted < 0) discounted = 0;
  return `${symbol}${discounted.toFixed(2)}`;
}

/** "20%" / "£3.00" - the headline value, for the offer label. */
export function discountValueLabel(discount: ReferralDiscount): string | null {
  if (discount.percentOff != null) {
    const pct = Number.isInteger(discount.percentOff)
      ? discount.percentOff
      : Number(discount.percentOff.toFixed(2));
    return `${pct}%`;
  }
  if (discount.amountOff != null) {
    // Same rule as applyDiscount: an unknown currency would render a bare
    // number ("5.00 off"), which reads as the site's own currency.
    const symbol = discount.currency
      ? CURRENCY_SYMBOLS[discount.currency.toLowerCase()]
      : undefined;
    if (!symbol) return null;
    return `${symbol}${(discount.amountOff / 100).toFixed(2)}`;
  }
  return null;
}
