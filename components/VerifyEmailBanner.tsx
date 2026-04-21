"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setStatus("sending");
    setError(null);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/account`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-50 p-4 text-sm dark:border-amber-400/30 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Verify your email
          </p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-200/80">
            We sent a link to <strong>{email}</strong>. Click it to activate
            your account.
          </p>
        </div>
        <button
          type="button"
          onClick={resend}
          disabled={status === "sending" || status === "sent"}
          className="rounded-full border border-amber-500/40 px-4 py-1.5 text-amber-900 disabled:opacity-50 dark:text-amber-100"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent"
              ? "Sent - check your inbox"
              : "Resend link"}
        </button>
      </div>
      {error && <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
