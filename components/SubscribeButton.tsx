"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { openBillingPortal } from "@/components/ManageSubscriptionButton";

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
  className?: string;
  /** Display price and plan name for the end-trial confirmation. */
  price?: string;
  planName?: string;
};

export function SubscribeButton({
  priceId,
  label,
  highlight,
  withTrial = false,
  upgradeFromTrial = false,
  tierId,
  className,
  price,
  planName,
}: Props) {
  const t = useTranslations("Subscribe");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
      setError(null);
      dialogRef.current?.showModal();
      return;
    }

    setError(null);
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
        // Already subscribed: plan changes happen in the Customer Portal.
        const portal = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-portal-session`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (portal.ok) {
          const { url } = (await portal.json()) as { url: string };
          window.location.href = url;
        } else {
          router.push("/account");
        }
        return;
      }

      if (!res.ok) {
        setLoading(false);
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? t("errorAlert"));
        return;
      }

      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      // Network failure. Without this the promise rejects and the button stays
      // stuck on its disabled loading state with no explanation.
      setLoading(false);
      setError(t("errorAlert"));
    }
  }

  async function startPlan() {
    setError(null);
    setDeclined(false);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/change-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(tierId ? { tierId } : {}),
        },
      );
      if (!res.ok) {
        setLoading(false);
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (body?.error === "stripe_update_failed") {
          setDeclined(true);
          return;
        }
        setError(
          body?.error === "downgrade_not_supported"
            ? t("downgradeViaPortal")
            : (body?.error ?? t("errorAlert")),
        );
        return;
      }
      dialogRef.current?.close();
      router.push(`/account/started?type=paid&tier=${tierId ?? "starter"}`);
    } catch {
      setLoading(false);
      setError(t("errorAlert"));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={
          className ??
          `mt-6 w-full rounded-full py-2.5 text-sm font-medium transition disabled:opacity-60 ${
            highlight
              ? "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              : "border border-black/10 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          }`
        }
      >
        {loading ? t("loading") : (label ?? t("label"))}
      </button>
      {error && !upgradeFromTrial && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {upgradeFromTrial && (
        <dialog
          ref={dialogRef}
          onClose={() => {
            setLoading(false);
            setDeclined(false);
          }}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-6 text-left text-zinc-900 shadow-xl scale-95 opacity-0 transition-all transition-discrete duration-200 ease-out backdrop:bg-black/0 backdrop:transition-all backdrop:transition-discrete backdrop:duration-200 open:scale-100 open:opacity-100 open:backdrop:bg-black/40 starting:open:scale-95 starting:open:opacity-0 starting:open:backdrop:bg-black/0 motion-reduce:transition-none dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <h2 className="text-lg font-semibold">
            {t("endTrialTitle", { plan: planName ?? "" })}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("endTrialBody", { plan: planName ?? "", price: price ?? "" })}
          </p>
          {declined && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900/60 dark:bg-red-950/40"
            >
              <p className="font-semibold text-red-700 dark:text-red-300">
                {t("declinedTitle")}
              </p>
              <p className="mt-1 text-red-700/90 dark:text-red-300/90">
                {t("declinedBody")}
              </p>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={loading}
              className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
            >
              {t("cancel")}
            </button>
            {declined && (
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  if (!(await openBillingPortal())) {
                    setLoading(false);
                    setError(t("errorAlert"));
                  }
                }}
                disabled={loading}
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
              >
                {t("updateCard")}
              </button>
            )}
            <button
              type="button"
              onClick={startPlan}
              disabled={loading}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {loading
                ? t("loading")
                : declined
                  ? t("tryAgain")
                  : t("endTrialCta", { price: price ?? "" })}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
