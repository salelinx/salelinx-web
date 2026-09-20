"use client";

import { useState, useTransition } from "react";
import { redeemCode, type RedeemResult } from "./actions";

const BUTTON =
  "rounded-full bg-black px-6 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function RedeemForm({ code }: { code: string }) {
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    const until = formatDate(result.expiresAt);
    return (
      <div className="mt-8 rounded-2xl border border-black/10 p-6 text-left dark:border-white/20">
        <p className="text-lg font-medium">You are all set.</p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Your account is on the {result.tierId} plan
          {until ? ` until ${until}` : ""}. Install the extension and sign in
          with this same account.
        </p>
        <a
          className={`${BUTTON} mt-6 inline-block`}
          href="https://chromewebstore.google.com/search/SaleLinx"
        >
          Get the extension
        </a>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        className={BUTTON}
        disabled={pending}
        onClick={() =>
          startTransition(async () => setResult(await redeemCode(code)))
        }
      >
        {pending ? "Redeeming..." : "Redeem this code"}
      </button>
      {result && !result.ok ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
