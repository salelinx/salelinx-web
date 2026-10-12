"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";

// The portal return URL is decided by the Edge Function, not sent from here.
export async function openBillingPortal(): Promise<boolean> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-portal-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: "{}",
      },
    );
    if (!res.ok) return false;
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}

export function ManageSubscriptionButton({
  secondary = false,
}: {
  secondary?: boolean;
}) {
  const t = useTranslations("ManageSubscription");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    setError(false);
    setLoading(true);
    if (!(await openBillingPortal())) {
      setLoading(false);
      setError(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`mt-4 rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-60 ${
          secondary
            ? "border border-black/10 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            : "bg-black text-white dark:bg-white dark:text-black"
        }`}
      >
        {loading ? t("loading") : t("cta")}
      </button>
      {error && (
        <p className="mt-2 w-full text-sm text-red-600 dark:text-red-400">
          {t("errorAlert")}
        </p>
      )}
    </>
  );
}
