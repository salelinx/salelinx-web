"use client";

// Landing page for every auth email link (recovery, signup, magiclink,
// email_change, invite).
//
// CRITICAL: do not verify on mount. The whole point of this page is that mail
// scanners and link-tracking proxies fetch email URLs on delivery, and any GET
// against Supabase's /auth/v1/verify spends the one-time token before the user
// ever clicks. Verification therefore happens only in the button's onClick.
// Adding a useEffect that auto-verifies would reintroduce the exact bug this
// page exists to fix.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type EmailOtpType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email";

// Only same-origin relative paths are safe to forward to. Anything else (a
// full URL, a protocol-relative //evil.com) is discarded for the default.
function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  try {
    const path = raw.startsWith("http") ? new URL(raw).pathname + new URL(raw).search : raw;
    if (!path.startsWith("/") || path.startsWith("//")) return "/account";
    return path;
  } catch {
    return "/account";
  }
}

function normaliseType(raw: string | null): EmailOtpType {
  switch (raw) {
    case "recovery":
    case "signup":
    case "invite":
    case "magiclink":
    case "email_change":
      return raw;
    // Supabase sends email_change_current / email_change_new for the two-sided
    // secure email change; both verify as "email_change".
    case "email_change_current":
    case "email_change_new":
      return "email_change";
    default:
      return "email";
  }
}

// useSearchParams needs a Suspense boundary, otherwise the prerender bails.
export default function ConfirmPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-sm px-6 py-20" />}>
      <ConfirmInner />
    </Suspense>
  );
}

function ConfirmInner() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const params = useSearchParams();

  const tokenHash = params.get("token_hash");
  const type = normaliseType(params.get("type"));
  const next = safeNext(params.get("next"));

  const [status, setStatus] = useState<"idle" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!tokenHash) return;
    setStatus("verifying");
    setError(null);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (!tokenHash) {
    return (
      <main className="mx-auto w-full max-w-sm px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("confirm.invalidTitle")}
        </h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("confirm.invalidBody")}
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-6 inline-block underline"
        >
          {t("confirm.requestNew")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t(type === "recovery" ? "confirm.recoveryTitle" : "confirm.title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t(type === "recovery" ? "confirm.recoveryBody" : "confirm.body")}
      </p>

      <button
        type="button"
        onClick={onConfirm}
        disabled={status === "verifying"}
        className="mt-8 w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {status === "verifying"
          ? t("confirm.submitSubmitting")
          : t(type === "recovery" ? "confirm.recoverySubmit" : "confirm.submit")}
      </button>

      {error && (
        <div className="mt-4">
          <p className="text-sm text-red-600">{error}</p>
          <Link
            href="/auth/forgot-password"
            className="mt-2 inline-block text-sm underline"
          >
            {t("confirm.requestNew")}
          </Link>
        </div>
      )}
    </main>
  );
}
