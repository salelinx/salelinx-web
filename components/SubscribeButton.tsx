"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type Props = {
  priceId: string;
  label?: string;
  highlight?: boolean;
  /** Ask for the free trial. The trial card and the Starter card post the same
   *  price, so this is what tells them apart. Eligibility is still decided
   *  entirely server-side; this only expresses intent. */
  withTrial?: boolean;
  /** The visitor is mid-trial. Checkout refuses them (a trial IS a live
   *  subscription), so this button ends the trial and starts billing instead
   *  - which is the only way a capped trial user can actually upgrade. */
  upgradeFromTrial?: boolean;
  /** Target tier, sent to change-plan so a trialing user can jump straight to
   *  Pro or Business rather than only starting Starter early. */
  tierId?: string;
};

export function SubscribeButton({
  priceId,
  label,
  highlight,
  withTrial = false,
  upgradeFromTrial = false,
  tierId,
}: Props) {
  const t = useTranslations("Subscribe");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push(`/auth/login?next=${encodeURIComponent("/pricing")}`);
      return;
    }

    // Mid-trial: Checkout would 409, so end the trial instead. This bills the
    // card straight away and loses whatever days were left, so it is the one
    // path here that asks first - everything else on this button only ever
    // opens Stripe's own confirm screen.
    if (upgradeFromTrial) {
      if (!confirm(t("endTrialConfirm"))) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/change-plan`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(tierId ? { tierId } : {}),
          },
        );
        if (!res.ok) {
          setLoading(false);
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          alert(
            body?.error === "downgrade_not_supported"
              ? t("downgradeViaPortal")
              : (body?.error ?? t("errorAlert")),
          );
          return;
        }
        // stripe-webhook syncs the row, so /account may lag a second or two.
        router.push("/account");
      } catch {
        setLoading(false);
        alert(t("errorAlert"));
      }
      return;
    }

    setLoading(true);

    // Redirect URLs and trial LENGTH are decided by the Edge Function, not sent
    // from here: they control what the customer is charged and where they land
    // afterwards, so the browser is not allowed a say. `withTrial` is only a
    // request for the standard trial; the function still applies every
    // eligibility gate and caps the length itself.
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ priceId, withTrial }),
        },
      );

      if (res.status === 409) {
        // Already has an active subscription; plan changes happen in the
        // Customer Portal, reachable from the account page.
        router.push("/account");
        return;
      }

      if (!res.ok) {
        setLoading(false);
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(body?.error ?? t("errorAlert"));
        return;
      }

      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      // Network failure. Without this the promise rejects and the button stays
      // stuck on its disabled loading state with no explanation.
      setLoading(false);
      alert(t("errorAlert"));
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`mt-6 w-full rounded-full py-2.5 text-sm font-medium transition disabled:opacity-60 ${
        highlight
          ? "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          : "border border-black/10 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      }`}
    >
      {loading ? t("loading") : (label ?? t("label"))}
    </button>
  );
}
