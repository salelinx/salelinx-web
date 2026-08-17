"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import { OAuthSignInButton } from "@/components/auth/OAuthSignInButton";

function LoginForm() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  // Callers send users here with the page they were trying to reach, e.g.
  // SubscribeButton uses ?next=/pricing so the purchase flow resumes after
  // sign-in instead of dumping the buyer on the account page.
  const next = safeNext(searchParams.get("next"));
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

    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("login.title")}
      </h1>

      {/* Sign-in with Google auto-provisions an account for first-time Google
          users, so the terms notice must appear before the button here too. */}
      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        {t.rich("login.legalNotice", {
          terms: (chunks) => (
            <Link href="/legal/terms" className="underline">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/legal/privacy" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <OAuthSignInButton provider="google" next={next} />
        <OAuthSignInButton provider="apple" next={next} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        {t("orDivider")}
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-label={t("emailPlaceholder")}
          autoComplete="email"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          aria-label={t("passwordPlaceholder")}
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

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary or the route opts out of static
  // rendering at build time.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
