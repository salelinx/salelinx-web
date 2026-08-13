"use client";

// Self-serve GDPR account deletion (docs/GDPR.md). Click-through: the button
// opens an inline confirm panel that requires the user's password. The
// password recheck is the same step-up pattern as the admin console
// (lib/admin/reauth.ts): signInWithPassword proves current possession of the
// password, blunting a hijacked-but-idle session. Then the delete-account
// Edge Function runs the erasure (storage, Stripe customer, auth user).
// On success we drop the local session and hard-navigate home; the server
// session is already gone with the user.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";

type Status = "idle" | "open" | "deleting";

export function DeleteAccountCard({ email }: { email: string }) {
  const t = useTranslations("DeleteAccount");
  const [status, setStatus] = useState<Status>("idle");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (status === "deleting" || !password) return;
    setError(null);
    setStatus("deleting");

    const supabase = createBrowserClient();

    const { error: pwErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (pwErr) {
      setStatus("open");
      setError(t("errorWrongPassword"));
      return;
    }

    // Session AFTER the recheck (signInWithPassword rotates it).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setStatus("open");
      setError(t("errorGeneric"));
      return;
    }

    let res: Response;
    try {
      res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
    } catch {
      setStatus("open");
      setError(t("errorGeneric"));
      return;
    }

    if (!res.ok) {
      let message = t("errorGeneric");
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error === "admin_account") message = t("errorAdmin");
      } catch {
        // non-JSON error body; keep the generic message
      }
      setStatus("open");
      setError(message);
      return;
    }

    // The auth user is gone; clear the local session only (a server signOut
    // would 403) and leave the account area entirely.
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/");
  }

  return (
    <section className="mt-6 rounded-2xl border border-red-500/30 p-6">
      <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
        {t("title")}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("body")}
      </p>

      {status === "idle" ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStatus("open");
          }}
          className="mt-4 rounded-full border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          {t("cta")}
        </button>
      ) : (
        <form
          onSubmit={confirmDelete}
          className="mt-4 flex max-w-sm flex-col gap-3 rounded-xl border border-red-500/30 bg-red-50 p-4 dark:bg-red-950/30"
        >
          <p className="text-sm text-red-900 dark:text-red-200">
            {t.rich("confirmBody", {
              email: () => <strong>{email}</strong>,
            })}
          </p>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t("passwordPlaceholder")}
            autoComplete="current-password"
            className="w-full rounded-lg border border-red-500/30 bg-white px-4 py-3 text-sm dark:bg-transparent"
          />
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={status === "deleting" || !password}
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {status === "deleting" ? t("deleting") : t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setPassword("");
                setError(null);
              }}
              disabled={status === "deleting"}
              className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium disabled:opacity-60 dark:border-white/20"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
