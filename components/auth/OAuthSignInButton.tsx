"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";

export type OAuthProvider = "google" | "apple";

type Props = {
  provider: OAuthProvider;
  // Where to land after a successful sign-in, same convention as the
  // password form's `next` param (see lib/auth/safe-next.ts).
  next?: string;
};

/**
 * Shared social sign-in button. Google and Apple differ only in the provider
 * name, the mark, and the label, so they share one flow: Supabase creates the
 * account on first sign-in, and /auth/callback exchanges the code either way.
 *
 * Apple specifics worth knowing when reading this:
 * - Apple only returns the user's name on the FIRST authorization, so nothing
 *   downstream may assume it is present on later sign-ins.
 * - Apple never sees the `redirectTo` below. It returns to Supabase's own
 *   callback (the only URL registerable against a Services ID), and Supabase
 *   forwards here.
 */
export function OAuthSignInButton({ provider, next = "/account" }: Props) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApple = provider === "apple";
  const label = isApple ? t("continueWithApple") : t("continueWithGoogle");
  const loadingLabel = isApple
    ? t("continueWithAppleLoading")
    : t("continueWithGoogleLoading");

  async function onClick() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    // signInWithOAuth cannot set user_metadata (unlike signUp), so the
    // locale rides along to /auth/callback, which backfills
    // preferred_locale after the code exchange. Without it, OAuth users get
    // English auth emails (send-auth-email falls back when the key is absent).
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}&locale=${locale}`,
      },
    });
    // On success the browser navigates away immediately; this only runs if the
    // redirect could not be started - most often because the provider exists in
    // Supabase but was never configured, which returns "provider is not
    // enabled". An alert() was hiding that behind a browser dialog.
    if (oauthError) {
      setLoading(false);
      setError(
        /not enabled/i.test(oauthError.message)
          ? t("providerNotEnabled", { provider: isApple ? "Apple" : "Google" })
          : oauthError.message,
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.06]"
      >
        {isApple ? <AppleIcon /> : <GoogleIcon />}
        {loading ? loadingLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function AppleIcon() {
  // Single currentColor path so the mark follows the button label in both
  // themes, which is what Apple's guidance asks for (black on light, white on
  // dark) without shipping two assets.
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.05 12.72c.02-2.2 1.79-3.26 1.87-3.31-1.02-1.5-2.61-1.7-3.17-1.73-1.35-.1-2.63.79-3.31.79-.7 0-1.75-.77-2.88-.75-1.48.02-2.85.86-3.61 2.19-1.54 2.68-.39 6.65 1.11 8.83.74 1.06 1.62 2.25 2.78 2.21 1.11-.04 1.54-.72 2.89-.72 1.34 0 1.73.72 2.9.7 1.2-.02 1.97-1.09 2.71-2.16.85-1.23 1.2-2.42 1.22-2.48-.03-.01-2.34-.9-2.36-3.57zM14.9 5.87c.6-.73 1-1.74.89-2.75-.86.04-1.91.58-2.53 1.3-.56.64-1.03 1.67-.9 2.66.96.07 1.94-.49 2.54-1.21z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.68-3.87 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
