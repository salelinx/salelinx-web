"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("pwTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("pwMismatch"));
      return;
    }

    setStatus("submitting");
    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/account`,
        data: { preferred_locale: locale },
      },
    });

    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }

    // If email confirmation is disabled in Supabase, we get a session immediately.
    if (data.session) {
      window.location.href = "/account";
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
          {t.rich("signup.checkEmailBody", {
            email: () => <strong>{email}</strong>,
          })}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("signup.title")}
      </h1>

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
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("signup.passwordPlaceholder")}
          autoComplete="new-password"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("signup.confirmPlaceholder")}
          autoComplete="new-password"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "submitting"
            ? t("signup.submitSubmitting")
            : t("signup.submitIdle")}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 text-sm">
        {t("signup.haveAccount")}{" "}
        <Link href="/auth/login" className="underline">
          {t("signup.signIn")}
        </Link>
      </div>
    </main>
  );
}
