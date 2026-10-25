"use client";

// /admin/finance: revenue, MRR and customer counts from Stripe, through the
// admin-finance-stats Edge Function. Loaded after the page renders, like the
// overview's Latest payments, so a slow Stripe read never blocks the console.

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";
import type { AdminFinanceStats } from "@/lib/types/admin";

type State = { stats: AdminFinanceStats } | { error: string } | null;

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function monthLabel(key: string, style: "short" | "long" = "short"): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: style,
    timeZone: "UTC",
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}

function change(now: number, before: number): string | undefined {
  if (before <= 0) return undefined;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% on last month`;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function Box({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

async function fetchStats(): Promise<Exclude<State, null>> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Sign in again to load finance stats." };
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-finance-stats`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );
    const body = (await res.json().catch(() => null)) as
      (AdminFinanceStats & { error?: string }) | null;
    if (!res.ok || !body || body.error) {
      return {
        error:
          body?.error === "mfa_required"
            ? "Verify your MFA code to see finance stats."
            : "Couldn't load finance stats from Stripe.",
      };
    }
    return { stats: body };
  } catch {
    return { error: "Couldn't load finance stats from Stripe." };
  }
}

export function FinanceDashboard() {
  const [state, setState] = useState<State>(null);
  // Bumped by Refresh to run the load again.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchStats().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const stats = state && "stats" in state ? state.stats : null;
  const cur = stats?.currency ?? "gbp";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Finance
          {stats && (
            <span className="ml-2 font-normal text-zinc-400">
              {monthLabel(stats.month, "long")}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={() => {
            setState(null);
            setReload((n) => n + 1);
          }}
          className="ml-auto rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
        >
          Refresh
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-3 p-4">
          {state === null && (
            <p className="text-sm text-zinc-500">Loading from Stripe...</p>
          )}
          {state && "error" in state && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="MRR"
                  value={money(stats.mrr, cur)}
                  hint={`${money(stats.arr, cur)} a year`}
                />
                <Stat
                  label="Revenue this month"
                  value={money(stats.revenue_this_month, cur)}
                  hint={
                    change(
                      stats.revenue_this_month,
                      stats.revenue_last_month,
                    ) ?? `Last month ${money(stats.revenue_last_month, cur)}`
                  }
                />
                <Stat
                  label="Paying customers"
                  value={String(stats.paying_customers)}
                  hint={`${stats.trialing} on a trial`}
                />
                <Stat
                  label="Revenue per customer"
                  value={money(stats.arpu, cur)}
                  hint="a month"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat
                  label="New paying this month"
                  value={
                    stats.new_paying_this_month === null
                      ? "-"
                      : String(stats.new_paying_this_month)
                  }
                />
                <Stat
                  label="Cancelled this month"
                  value={String(stats.cancelled_this_month)}
                />
                <Stat
                  label="Refunded this month"
                  value={money(stats.refunds_this_month, cur)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Box title="Revenue by month" hint="Paid minus refunded">
                    <ColumnChart
                      name="Revenue by month"
                      values={stats.revenue_by_month.map((m) =>
                        Math.round(m.amount / 100),
                      )}
                      labels={stats.revenue_by_month.map((m) =>
                        monthLabel(m.month),
                      )}
                      height={180}
                    />
                  </Box>
                </div>
                <Box title="MRR by plan">
                  {stats.mrr_by_tier.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No paying subscriptions yet.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {[...stats.mrr_by_tier]
                        .sort((a, b) => b.amount - a.amount)
                        .map((t) => (
                          <li
                            key={t.tier}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="capitalize text-zinc-700">
                              {t.tier}
                            </span>
                            <span className="font-mono text-zinc-900">
                              {money(t.amount, cur)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </Box>
              </div>

              <p className="text-xs text-zinc-400">
                MRR is at list price, before coupons and referral credits.
                Amounts are in {cur.toUpperCase()}
                {stats.other_currencies.length > 0 &&
                  `; payments in ${stats.other_currencies.map((c) => c.toUpperCase()).join(", ")} are left out`}
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
