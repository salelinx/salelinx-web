"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";

type PasswordStatus = "idle" | "sending" | "sent";
type EmailStatus = "idle" | "open" | "sending" | "sent";

// Two-factor states: loading (fetching factors), off, enrolling (QR shown,
// waiting for the first code), on, disabling (waiting for a code to confirm).
type MfaStatus = "loading" | "off" | "enrolling" | "on" | "disabling";

export function AccountSecurityCard({
  email,
  hasPassword,
}: {
  email: string;
  // False for Google-only accounts: the reset link then SETS a first
  // password rather than replacing one, and the copy must say so instead of
  // silently offering a "reset" for a password that does not exist.
  hasPassword: boolean;
}) {
  const t = useTranslations("AccountSecurity");
  const locale = useLocale();
  const [pwStatus, setPwStatus] = useState<PasswordStatus>("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [mfaStatus, setMfaStatus] = useState<MfaStatus>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setMfaStatus("off");
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      setFactorId(verified?.id ?? null);
      setMfaStatus(verified ? "on" : "off");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startEnroll() {
    setMfaBusy(true);
    setMfaError(null);
    const supabase = createBrowserClient();

    // Clear any unverified factor left by an abandoned attempt; Supabase
    // rejects a second enrol while one is pending.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setMfaBusy(false);
    if (error || !data) {
      setMfaError(error?.message ?? t("mfaCodeError"));
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setTotpSecret(data.totp.secret);
    setMfaCode("");
    setMfaStatus("enrolling");
  }

  async function cancelEnroll() {
    if (mfaBusy) return;
    const supabase = createBrowserClient();
    if (factorId) {
      // Best-effort cleanup of the unverified factor.
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    }
    setFactorId(null);
    setQrCode(null);
    setTotpSecret(null);
    setMfaError(null);
    setMfaStatus("off");
  }

  // Challenge + verify the entered code against the factor. Used both to
  // activate a new factor and to confirm before disabling (verifying also
  // raises the session to AAL2, which unenroll requires).
  async function verifyCode(id: string): Promise<boolean> {
    const supabase = createBrowserClient();
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge(
      { factorId: id },
    );
    if (chErr || !challenge) {
      setMfaError(chErr?.message ?? t("mfaCodeError"));
      return false;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: id,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    if (vErr) {
      setMfaError(t("mfaCodeError"));
      return false;
    }
    return true;
  }

  async function activateMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || mfaBusy) return;
    setMfaBusy(true);
    setMfaError(null);
    const ok = await verifyCode(factorId);
    setMfaBusy(false);
    if (!ok) return;
    setQrCode(null);
    setTotpSecret(null);
    setMfaCode("");
    setMfaStatus("on");
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || mfaBusy) return;
    setMfaBusy(true);
    setMfaError(null);
    const ok = await verifyCode(factorId);
    if (!ok) {
      setMfaBusy(false);
      return;
    }
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setMfaBusy(false);
    if (error) {
      setMfaError(error.message);
      return;
    }
    setFactorId(null);
    setMfaCode("");
    setMfaStatus("off");
  }

  async function sendPasswordLink() {
    setPwError(null);
    setPwStatus("sending");

    const supabase = createBrowserClient();
    // Refresh the preferred_locale on the signed-in user so the Edge Function
    // sends the reset email in the language the user is currently viewing.
    await supabase.auth.updateUser({ data: { preferred_locale: locale } });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setPwStatus("idle");
      setPwError(error.message);
      return;
    }

    setPwStatus("sent");
  }

  async function sendEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);

    const target = newEmail.trim();
    if (!target) {
      setEmailError(t("errorEnterEmail"));
      return;
    }
    if (target.toLowerCase() === email.toLowerCase()) {
      setEmailError(t("errorSameEmail"));
      return;
    }

    setEmailStatus("sending");
    const supabase = createBrowserClient();

    // updateUser({ email }) sends a confirmation to an attacker-CHOSEN
    // address, so it is the one auth-email path that can pump mail to third
    // parties. GoTrue has its own per-address limits, but add an app-level
    // per-user cap as defense in depth (the RPC is auth.uid()-scoped).
    const dayKey = new Date().toISOString().slice(0, 10);
    const { data: changeCount, error: rlErr } = await supabase.rpc(
      "increment_usage_counter",
      { p_feature: "email_change_requests", p_period_key: dayKey },
    );
    if (rlErr || (typeof changeCount === "number" && changeCount > 5)) {
      setEmailStatus("open");
      setEmailError(t("errorRateLimited"));
      return;
    }

    const { error } = await supabase.auth.updateUser({
      email: target,
      data: { preferred_locale: locale },
    });

    if (error) {
      setEmailStatus("open");
      setEmailError(error.message);
      return;
    }

    setSentTo(target);
    setEmailStatus("sent");
    setNewEmail("");
  }

  return (
    <section className="mt-6 rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("body")}
      </p>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="text-base font-medium">{t("passwordHeading")}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t.rich(hasPassword ? "passwordBody" : "passwordBodyGoogle", {
              email: () => <strong>{email}</strong>,
            })}
          </p>
          {pwStatus === "sent" ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {t.rich("passwordSent", {
                email: () => <strong>{email}</strong>,
              })}
            </p>
          ) : (
            <button
              type="button"
              onClick={sendPasswordLink}
              disabled={pwStatus === "sending"}
              className="mt-3 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {pwStatus === "sending"
                ? t("sending")
                : hasPassword
                  ? t("sendResetLink")
                  : t("setPasswordLink")}
            </button>
          )}
          {pwError && (
            <p className="mt-3 text-sm text-red-600">{pwError}</p>
          )}
        </div>

        <div className="border-t border-black/10 pt-6 dark:border-white/10">
          <h3 className="text-base font-medium">{t("emailHeading")}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t.rich("emailCurrent", {
              email: () => <strong>{email}</strong>,
            })}
          </p>

          {emailStatus === "sent" && sentTo ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {t.rich("emailSent", {
                email: () => <strong>{sentTo}</strong>,
              })}
            </p>
          ) : emailStatus === "idle" ? (
            <button
              type="button"
              onClick={() => {
                setEmailStatus("open");
                setEmailError(null);
              }}
              className="mt-3 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              {t("changeEmail")}
            </button>
          ) : (
            <form
              onSubmit={sendEmailChange}
              className="mt-3 flex max-w-sm flex-col gap-3"
            >
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder={t("newEmailPlaceholder")}
                autoComplete="email"
                className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/20 dark:bg-transparent"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={emailStatus === "sending"}
                  className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {emailStatus === "sending"
                    ? t("sending")
                    : t("sendConfirmation")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailStatus("idle");
                    setNewEmail("");
                    setEmailError(null);
                  }}
                  disabled={emailStatus === "sending"}
                  className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium disabled:opacity-60 dark:border-white/20"
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}
          {emailError && (
            <p className="mt-3 text-sm text-red-600">{emailError}</p>
          )}
        </div>

        <div className="border-t border-black/10 pt-6 dark:border-white/10">
          <h3 className="text-base font-medium">{t("mfaHeading")}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("mfaBody")}
          </p>

          {mfaStatus === "loading" && (
            <p className="mt-3 text-sm text-zinc-500">{t("mfaLoading")}</p>
          )}

          {mfaStatus === "off" && (
            <button
              type="button"
              onClick={startEnroll}
              disabled={mfaBusy}
              className="mt-3 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {mfaBusy ? t("mfaWorking") : t("mfaEnable")}
            </button>
          )}

          {mfaStatus === "enrolling" && qrCode && (
            <form onSubmit={activateMfa} className="mt-3 max-w-sm space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("mfaScan")}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI SVG from supabase-js, not an optimizable asset */}
              <img
                src={qrCode}
                alt={t("mfaQrAlt")}
                className="h-40 w-40 rounded-lg bg-white p-2"
              />
              {totpSecret && (
                <p className="break-all text-xs text-zinc-500">
                  {t("mfaManual")}{" "}
                  <code className="font-mono">{totpSecret}</code>
                </p>
              )}
              <input
                type="text"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder={t("mfaCodePlaceholder")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/20 dark:bg-transparent"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={mfaBusy || mfaCode.trim().length < 6}
                  className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {mfaBusy ? t("mfaWorking") : t("mfaActivate")}
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  disabled={mfaBusy}
                  className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium disabled:opacity-60 dark:border-white/20"
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}

          {mfaStatus === "on" && (
            <div className="mt-3">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {t("mfaOn")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMfaCode("");
                  setMfaError(null);
                  setMfaStatus("disabling");
                }}
                className="mt-3 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium dark:border-white/20"
              >
                {t("mfaDisable")}
              </button>
            </div>
          )}

          {mfaStatus === "disabling" && (
            <form onSubmit={disableMfa} className="mt-3 max-w-sm space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("mfaDisablePrompt")}
              </p>
              <input
                type="text"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder={t("mfaCodePlaceholder")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/20 dark:bg-transparent"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={mfaBusy || mfaCode.trim().length < 6}
                  className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {mfaBusy ? t("mfaWorking") : t("mfaDisable")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaStatus("on");
                    setMfaError(null);
                  }}
                  disabled={mfaBusy}
                  className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium disabled:opacity-60 dark:border-white/20"
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}

          {mfaError && <p className="mt-3 text-sm text-red-600">{mfaError}</p>}
        </div>
      </div>
    </section>
  );
}
