"use client";

import { useTranslations } from "next-intl";
import {
  useReferralDiscount,
  applyDiscount,
  discountDurationKey,
} from "@/lib/referral-discount";

// Price line on a pricing card. Renders the plain price for everyone, and
// strikes it through against the referred price once we know the visitor has
// a pending referral AND the coupon can be applied faithfully (see
// applyDiscount). PricingSection is a server component, so the per-user part
// has to live in a client island like this one.
/** Shared height for the price block on every pricing card, so the CTA below it
 *  lines up across all four. The trial card carries a "then £x/month" line and a
 *  referred card carries a duration note, which otherwise pushed their buttons
 *  down while the plain cards' buttons sat higher. */
export const PRICE_BLOCK = "mt-6 min-h-[4.5rem]";

export function ReferralPrice({
  price,
  suffix,
}: {
  price: string;
  suffix: string;
}) {
  const t = useTranslations("Invited");
  const { pending, discount } = useReferralDiscount();
  const discounted = pending ? applyDiscount(price, discount) : null;

  // A `once` coupon is the normal case, so the struck-through price must not
  // read as the ongoing rate. Without this the card said "£7.99 £6.39 /month"
  // while the banner directly above it said "off your first month".
  const durationNote =
    discounted && discount
      ? {
          "first-month": t("priceNoteFirstMonth"),
          months: t("priceNoteMonths", {
            months: discount.durationInMonths ?? 0,
          }),
          forever: null,
        }[discountDurationKey(discount)]
      : null;

  if (!discounted) {
    return (
      <div className={PRICE_BLOCK}>
        <p className="text-4xl font-bold">
          {price}
          <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
            {suffix}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className={PRICE_BLOCK}>
      <p className="text-4xl font-bold">
        <span className="mr-2 text-2xl font-semibold text-zinc-400 line-through dark:text-zinc-500">
          {price}
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          {discounted}
        </span>
        <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
          {suffix}
        </span>
      </p>
      {durationNote && (
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
          {durationNote}
        </p>
      )}
    </div>
  );
}
