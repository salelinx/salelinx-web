"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";

// Green "your referral discount is active" strip. The referee-side discount
// is otherwise invisible until Stripe checkout (has_pending_referral gates
// the coupon server-side in create-checkout-session), which reads as "the
// discount didn't work" to anyone checking after signup. Renders nothing
// unless the signed-in user actually has a pending referral, so it's safe to
// mount anywhere.
export function ReferralDiscountBanner() {
  const t = useTranslations("Invited");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      supabase.rpc("has_pending_referral").then(({ data: pending, error }) => {
        if (!cancelled && !error && pending === true) setShow(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="mb-8 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
      <span aria-hidden="true">🎁</span>
      {t("discountBanner")}
    </div>
  );
}
