"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";

type Props = {
  // Where to land after a successful sign-in, same convention as the
  // password form's `next` param (see lib/auth/safe-next.ts).
  next?: string;
};

export function GoogleSignInButton({ next = "/account" }: Props) {
  const t = useTranslations("Auth");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser navigates away to Google immediately; this only
    // runs if the redirect itself couldn't be started (e.g. provider not
    // configured on the Supabase project).
    if (error) {
      setLoading(false);
      alert(error.message);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.06]"
    >
      <GoogleIcon />
      {loading ? t("continueWithGoogleLoading") : t("continueWithGoogle")}
    </button>
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
