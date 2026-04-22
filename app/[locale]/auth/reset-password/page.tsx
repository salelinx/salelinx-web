"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
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
    const { error } = await supabase.auth.updateUser({ password });

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
        {t("resetPassword.title")}
      </h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("resetPassword.newPwPlaceholder")}
          autoComplete="new-password"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("resetPassword.confirmPlaceholder")}
          autoComplete="new-password"
          className="w-full rounded-lg border border-black/10 px-4 py-3 dark:border-white/20 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "submitting"
            ? t("resetPassword.submitSubmitting")
            : t("resetPassword.submitIdle")}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
