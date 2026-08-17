"use client";

import { useTranslations } from "next-intl";
import {
  useReferralDiscount,
  discountValueLabel,
} from "@/lib/referral-discount";

// Green "your referral discount is active" strip. The referee-side discount
// was otherwise invisible until Stripe checkout (has_pending_referral gates
// the coupon server-side in create-checkout-session), which reads as "the
// discount didn't work" to anyone checking after signup. Renders nothing
// unless the signed-in user actually has a pending referral, so it is safe
// to mount anywhere.
export function ReferralDiscountBanner() {
  const t = useTranslations("Invited");
  const { pending, discount } = useReferralDiscount();

  if (!pending) return null;

  // Terms come from the coupon itself; until they load (or if the coupon is
  // unreadable) we still confirm the discount exists, just without numbers.
  const value = discount ? discountValueLabel(discount) : null;
  let offer = t("discountBanner");
  if (value && discount) {
    if (discount.duration === "forever") {
      offer = t("discountOffForever", { value });
    } else if (
      discount.duration === "repeating" &&
      (discount.durationInMonths ?? 0) > 1
    ) {
      offer = t("discountOffMonths", {
        value,
        months: discount.durationInMonths!,
      });
    } else {
      offer = t("discountOffFirstMonth", { value });
    }
  }

  return (
    <div className="mb-8 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
      <span aria-hidden="true">🎁</span>
      {offer}
    </div>
  );
}
