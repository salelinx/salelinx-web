"use client";

// Two-step verification (MFA challenge). A password login starts the session
// at AAL1; entering a valid authenticator code here upgrades it to AAL2. The
// admin gates (proxy.ts + app/admin/layout.tsx) redirect here with
// ?next=<path> when an admin session is not yet AAL2; is_admin() in Postgres
// enforces the same requirement at the database level (003_support.sql).
//
// After verifying we hard-navigate (window.location.assign) instead of a
// soft router.push: the usual ?next target is /admin, which lives outside the
// [locale] tree (its own <html> root), so a full reload is required anyway,
// and it guarantees the refreshed AAL2 cookies are sent.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";

function MfaChallengeForm() {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [factorId, setFactorId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notEnrolled">(
    "loading",
  );
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();
    supabase.auth.mfa.listFactors().then(({ data, error: listErr }) => {
      if (cancelled) return;
      const verified = data?.totp.find((f) => f.status === "verified");
      if (listErr || !verified) {
        setState("notEnrolled");
        return;
      }
      setFactorId(verified.id);
      setState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || status === "submitting") return;
    setStatus("submitting");
    setError(null);

    const supabase = createBrowserClient();
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge(
      { factorId },
    );
    if (chErr || !challenge) {
      setStatus("idle");
      setError(chErr?.message ?? t("mfa.codeError"));
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (vErr) {
      setStatus("idle");
      setError(t("mfa.codeError"));
      return;
    }

    window.location.assign(next);
  }

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("mfa.title")}
      </h1>

      {state === "loading" && (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">{t("mfa.loading")}</p>
      )}

      {state === "notEnrolled" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("mfa.notEnrolled")}
          </p>
          <Link
            href="/account"
            className="inline-block rounded-lg bg-black px-4 py-3 text-sm text-white dark:bg-white dark:text-black"
          >
            {t("mfa.goToSecurity")}
          </Link>
        </div>
      )}

      {state === "ready" && (
        <>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {t("mfa.body")}
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("mfa.codePlaceholder")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
            />
            <button
              type="submit"
              disabled={status === "submitting" || code.trim().length < 6}
              className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {status === "submitting"
                ? t("mfa.submitSubmitting")
                : t("mfa.submitIdle")}
            </button>
          </form>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </>
      )}
    </main>
  );
}

export default function MfaChallengePage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <Suspense fallback={null}>
      <MfaChallengeForm />
    </Suspense>
  );
}
