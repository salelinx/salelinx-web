"use client";

// Step-up reauth modal shared by every destructive admin action (ticket
// delete, Stripe plan change, account deletion). It asks for whatever
// requireReauth() will verify: a 6-digit authenticator code when the admin
// has a TOTP factor enrolled (which also keeps the session at AAL2), or the
// password as the pre-enrollment fallback. The caller passes the collected
// secret to requireReauth() inside onConfirm.

import { useEffect, useState } from "react";
import { getReauthKind, type ReauthKind } from "@/lib/admin/reauth";

type Props = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busyLabel: string;
  danger: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (secret: string) => void;
};

export function ReauthModal({
  title,
  description,
  confirmLabel,
  busyLabel,
  danger,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [secret, setSecret] = useState("");
  const [kind, setKind] = useState<ReauthKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReauthKind().then((k) => {
      if (!cancelled) setKind(k);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isTotp = kind === "totp";
  const ready = kind !== null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--admin-border)] bg-white p-5 shadow-xl">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {description}{" "}
          {ready &&
            (isTotp
              ? "Enter the 6-digit code from your authenticator app to continue."
              : "Re-enter your password to continue.")}
        </p>
        <input
          type={isTotp ? "text" : "password"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={!ready || busy}
          autoComplete={isTotp ? "one-time-code" : "current-password"}
          inputMode={isTotp ? "numeric" : undefined}
          maxLength={isTotp ? 6 : undefined}
          placeholder={isTotp ? "123456" : "Your password"}
          className="mt-3 w-full rounded-md border border-[var(--admin-border)] bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(secret)}
            disabled={!ready || busy || !secret}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 " +
              (danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-zinc-900 hover:bg-zinc-700")
            }
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
