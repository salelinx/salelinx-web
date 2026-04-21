"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

type PasswordStatus = "idle" | "sending" | "sent";
type EmailStatus = "idle" | "open" | "sending" | "sent";

export function AccountSecurityCard({ email }: { email: string }) {
  const [pwStatus, setPwStatus] = useState<PasswordStatus>("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function sendPasswordLink() {
    setPwError(null);
    setPwStatus("sending");

    const supabase = createBrowserClient();
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
      setEmailError("Enter the new email address.");
      return;
    }
    if (target.toLowerCase() === email.toLowerCase()) {
      setEmailError("That's already your current email.");
      return;
    }

    setEmailStatus("sending");
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ email: target });

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
      <h2 className="text-xl font-semibold">Security</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Manage the password and email address on your account. Both changes
        require confirming a link we send to you.
      </p>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="text-base font-medium">Password</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            We&apos;ll send a reset link to <strong>{email}</strong>.
          </p>
          {pwStatus === "sent" ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              Link sent. Check <strong>{email}</strong> and click the link to
              set a new password.
            </p>
          ) : (
            <button
              type="button"
              onClick={sendPasswordLink}
              disabled={pwStatus === "sending"}
              className="mt-3 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {pwStatus === "sending" ? "Sending..." : "Send reset link"}
            </button>
          )}
          {pwError && (
            <p className="mt-3 text-sm text-red-600">{pwError}</p>
          )}
        </div>

        <div className="border-t border-black/10 pt-6 dark:border-white/10">
          <h3 className="text-base font-medium">Email</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Current: <strong>{email}</strong>
          </p>

          {emailStatus === "sent" && sentTo ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              Confirmation sent to <strong>{sentTo}</strong>. Click the link
              in that email to finish the change.
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
              Change email
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
                placeholder="new@example.com"
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
                    ? "Sending..."
                    : "Send confirmation"}
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
                  Cancel
                </button>
              </div>
            </form>
          )}
          {emailError && (
            <p className="mt-3 text-sm text-red-600">{emailError}</p>
          )}
        </div>
      </div>
    </section>
  );
}
