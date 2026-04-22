"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }

    setStatus("done");
  }

  if (status === "done") {
    return (
      <main className="mx-auto w-full max-w-sm px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("checkEmailTitle")}
        </h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t.rich("forgotPassword.checkEmailBody", {
            email: () => <strong>{email}</strong>,
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("forgotPassword.title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("forgotPassword.subtitle")}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "submitting"
            ? t("forgotPassword.submitSubmitting")
            : t("forgotPassword.submitIdle")}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 text-sm">
        <Link href="/auth/login" className="underline">
          {t("forgotPassword.backToSignIn")}
        </Link>
      </div>
    </main>
  );
}
