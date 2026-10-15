"use client";

// "Latest payments" on the /admin overview: the most recent successful
// payments, newest first. Read from Stripe through the admin-list-payments
// Edge Function, because the database keeps only each customer's first payment
// (see that function's header).
//
// Loaded after the page renders, the same way the users drawer calls its Edge
// Functions, so a slow or failing Stripe call never holds up the rest of the
// overview. A failure is one line in this card and nothing else.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { UserEmailLink } from "@/components/admin/UserEmailLink";
import { relativeAge } from "@/lib/admin/relative-time";
import { useClientNow } from "@/lib/admin/use-client-now";
import type { AdminPayment } from "@/lib/types/admin";

// Stripe's billing_reason, in words. Anything else (a one-off invoice, a
// manual charge) reads as a plain payment.
const REASON_LABEL: Record<string, string> = {
  subscription_create: "First payment",
  subscription_cycle: "Renewal",
  subscription_update: "Plan change",
};

type State = { payments: AdminPayment[] } | { error: string } | null;

function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LatestPayments() {
  const [state, setState] = useState<State>(null);
  // Null through hydration, then ticking; see lib/admin/use-client-now.ts.
  const now = useClientNow();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setState({ error: "Sign in again to load payments." });
        return;
      }
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-list-payments`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        const body = (await res.json().catch(() => null)) as {
          payments?: AdminPayment[];
        } | null;
        if (cancelled) return;
        if (!res.ok || !body?.payments) {
          setState({ error: "Could not load payments from Stripe." });
          return;
        }
        setState({ payments: body.payments });
      } catch {
        if (!cancelled) {
          setState({ error: "Could not reach the payments function." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Latest payments</h2>
        <Link
          href="/admin/subscriptions"
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          View subscriptions
        </Link>
      </div>
      {state === null ? (
        <p className="px-4 py-6 text-sm text-zinc-500">Loading from Stripe...</p>
      ) : "error" in state ? (
        <p className="px-4 py-6 text-sm text-red-600">{state.error}</p>
      ) : state.payments.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {state.payments.map((p) => (
            <li
              key={p.invoice_id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 text-sm"
            >
              {p.email || p.user_id ? (
                <UserEmailLink
                  userId={p.user_id}
                  email={p.email}
                  className="text-zinc-800"
                />
              ) : (
                <span className="text-zinc-400">Unknown customer</span>
              )}
              {p.tier && (
                <span className="text-xs capitalize text-zinc-500">
                  {p.tier}
                </span>
              )}
              <span className="text-xs text-zinc-400">
                {REASON_LABEL[p.reason ?? ""] ?? "Payment"}
              </span>
              <span className="ml-auto font-mono text-xs text-zinc-900">
                {formatMoney(p.amount, p.currency)}
              </span>
              {p.refunded > 0 && (
                <span className="text-xs font-medium text-amber-700">
                  {p.refunded >= p.amount
                    ? "refunded"
                    : `${formatMoney(p.refunded, p.currency)} refunded`}
                </span>
              )}
              <span
                className="w-16 text-right text-xs text-zinc-500"
                title={formatWhen(p.paid_at)}
              >
                {now === null ? "" : relativeAge(p.paid_at, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
