"use client";

import { useReferralDiscount, applyDiscount } from "@/lib/referral-discount";

// Price line on a pricing card. Renders the plain price for everyone, and
// strikes it through against the referred price once we know the visitor has
// a pending referral AND the coupon can be applied faithfully (see
// applyDiscount). PricingSection is a server component, so the per-user part
// has to live in a client island like this one.
export function ReferralPrice({
  price,
  suffix,
}: {
  price: string;
  suffix: string;
}) {
  const { pending, discount } = useReferralDiscount();
  const discounted = pending ? applyDiscount(price, discount) : null;

  if (!discounted) {
    return (
      <p className="mt-6 text-4xl font-bold">
        {price}
        <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
          {suffix}
        </span>
      </p>
    );
  }

  return (
    <p className="mt-6 text-4xl font-bold">
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
  );
}
