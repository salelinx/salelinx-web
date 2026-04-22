"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }

    router.push("/account");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("login.title")}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          autoComplete="current-password"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "submitting"
            ? t("login.submitSubmitting")
            : t("login.submitIdle")}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-between text-sm">
        <Link href="/auth/signup" className="underline">
          {t("login.createAccount")}
        </Link>
        <Link href="/auth/forgot-password" className="underline">
          {t("login.forgotPassword")}
        </Link>
      </div>
    </main>
  );
}
