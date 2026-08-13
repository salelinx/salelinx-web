"use client";

// Final step of self-serve account deletion: the emailed link lands on
// /account/delete-confirm, which renders this. One last explicit click calls
// the delete-account Edge Function with the signed token; the function
// verifies it was minted for the current session's user and runs the erasure.
// On success we drop the local session (the server side is gone with the
// user) and hard-navigate home.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type Status = "idle" | "deleting";

export function DeleteAccountConfirm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const t = useTranslations("DeleteAccountConfirm");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (status === "deleting") return;
    setError(null);
    setStatus("deleting");

    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setStatus("idle");
      setError(t("errorGeneric"));
      return;
    }

    let res: Response;
    try {
      res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ stage: "confirm", token }),
        },
      );
    } catch {
      setStatus("idle");
      setError(t("errorGeneric"));
      return;
    }

    if (!res.ok) {
      let message = t("errorGeneric");
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error === "invalid_token") message = t("errorInvalidToken");
        if (body.error === "admin_account") message = t("errorGeneric");
      } catch {
        // non-JSON error body; keep the generic message
      }
      setStatus("idle");
      setError(message);
      return;
    }

    // The auth user is gone; clear the local session only (a server signOut
    // would 403) and leave the account area entirely.
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/");
  }

  return (
    <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-50 p-6 dark:bg-red-950/30">
      <p className="text-sm text-red-900 dark:text-red-200">
        {t.rich("body", {
          email: () => <strong>{email}</strong>,
        })}
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void confirmDelete()}
          disabled={status === "deleting"}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {status === "deleting" ? t("deleting") : t("confirm")}
        </button>
        <Link
          href="/account"
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium dark:border-white/20"
        >
          {t("keepAccount")}
        </Link>
      </div>
    </div>
  );
}
