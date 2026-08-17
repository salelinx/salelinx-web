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
};

export function SubscribeButton({
  priceId,
  label,
  highlight,
  withTrial = false,
}: Props) {
  const t = useTranslations("Subscribe");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push(`/auth/login?next=${encodeURIComponent("/pricing")}`);
      return;
    }

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
