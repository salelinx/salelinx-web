"use client";

// Where Supabase's auth-link failures land. proxy.ts redirects here whenever a
// request carries ?error_code=, which previously just rendered the homepage
// with the explanation sitting unread in the URL.
//
// Supabase repeats the error in the URL hash as well as the query string, and
// the hash never reaches the server, so we read it here as a fallback for any
// path that reached this page without query params.

import { Suspense, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// useSearchParams needs a Suspense boundary, otherwise the prerender bails.
export default function LinkErrorPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-sm px-6 py-20" />}>
      <LinkErrorInner />
    </Suspense>
  );
}

const subscribeToNothing = () => () => {};

function LinkErrorInner() {
  const t = useTranslations("Auth");
  const params = useSearchParams();

  const code = params.get("error_code");
  const description = params.get("error_description");

  // The hash is client-only and never reaches the server, so it is read through
  // useSyncExternalStore rather than an effect. It does not change while the
  // page is mounted, hence the no-op subscribe.
  const hash = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.hash,
    () => "",
  );
  const hashDescription = hash
    ? new URLSearchParams(hash.replace(/^#/, "")).get("error_description")
    : null;

  const detail = description ?? hashDescription;
  const expired = code === "otp_expired";

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t(expired ? "linkError.expiredTitle" : "linkError.title")}
      </h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t(expired ? "linkError.expiredBody" : "linkError.body")}
      </p>

      {detail && (
        <p className="mt-4 rounded-lg border border-black/10 px-4 py-3 text-xs text-zinc-500 dark:border-white/20 dark:text-zinc-400">
          {detail}
        </p>
      )}

      <Link
        href="/auth/forgot-password"
        className="mt-8 block w-full rounded-lg bg-black px-4 py-3 text-center text-white dark:bg-white dark:text-black"
      >
        {t("linkError.requestNew")}
      </Link>

      <div className="mt-6 text-sm">
        <Link href="/auth/login" className="underline">
          {t("forgotPassword.backToSignIn")}
        </Link>
      </div>
    </main>
  );
}
