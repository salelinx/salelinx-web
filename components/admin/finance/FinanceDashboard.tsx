"use client";

// /admin/finance: revenue, MRR and customer counts from Stripe, through the
// admin-finance-stats Edge Function. Loaded after the page renders, like the
// overview's Latest payments, so a slow Stripe read never blocks the console.

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";
import { UserEmailLink } from "@/components/admin/UserEmailLink";
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

function monthLabel(
  key: string,
  style: "short" | "full" | "year" = "short",
): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: style === "short" ? "short" : "long",
    timeZone: "UTC",
    ...(style === "year" ? { year: "numeric" } : {}),
  });
}

/** "+£48 on September", "-£12 on September", or "Same as September". */
function versus(
  now: number,
  before: number,
  currency: string,
  lastMonth: string,
): string {
  const diff = now - before;
  const name = monthLabel(lastMonth, "full");
  if (diff === 0) return `Same as ${name}`;
  return `${diff > 0 ? "+" : "-"}${money(Math.abs(diff), currency)} on ${name}`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-zinc-500">
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              className={`py-1.5 font-medium ${i ? "text-right" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={String(r[0])}
            className="border-t border-[var(--admin-border)]"
          >
            {r.map((c, i) => (
              <td
                key={i}
                className={`py-1.5 ${i ? "text-right font-mono" : "text-zinc-700"}`}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({
  label,
  value,
  hint,
  note,
}: {
  label: string;
  value: string;
  hint?: string;
  // How the figure is worked out, on hover.
  note: string;
}) {
  return (
    <div
      title={note}
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3"
    >
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

function RowTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {children}
    </h2>
  );
}

/** A share as a whole percentage, or null with nothing to divide by. */
function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
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
  const symbol = money(0, cur).replace(/[\d.,\s]/g, "");
  const lastMonthKey =
    stats?.by_month[stats.by_month.length - 2]?.month ?? stats?.month ?? "";

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          Finance
          {stats && (
            <span className="ml-2 font-normal text-zinc-400">
              {monthLabel(stats.month, "year")}
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
              <RowTitle>All time</RowTitle>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="Revenue all time"
                  value={money(stats.all_time.gross, cur)}
                  hint={
                    stats.first_payment_at
                      ? `Since ${monthLabel(stats.first_payment_at.slice(0, 7), "year")}`
                      : undefined
                  }
                  note="Everything customers have ever been charged, as Stripe settled it, before fees and refunds."
                />
                <Stat
                  label="Kept all time"
                  value={money(stats.all_time.net, cur)}
                  hint={`After ${money(stats.all_time.fees, cur)} fees, ${money(stats.all_time.refunds, cur)} refunds`}
                  note="All-time revenue minus every Stripe fee and refund."
                />
                <Stat
                  label={`Revenue in ${stats.month.slice(0, 4)}`}
                  value={money(stats.this_year.gross, cur)}
                  hint={`${money(stats.this_year.net, cur)} kept`}
                  note="Charged since 1 January, before fees and refunds."
                />
                <Stat
                  label="ARR"
                  value={money(stats.arr, cur)}
                  hint={`${money(stats.arpu, cur)} per paying customer a month`}
                  note="MRR times twelve: what a year looks like if every subscription stays as it is today."
                />
              </div>

              <RowTitle>Stripe balance</RowTitle>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat
                  label="Available"
                  value={money(stats.balance.available, cur)}
                  note="Settled in Stripe and ready to pay out."
                />
                <Stat
                  label="On the way"
                  value={money(stats.balance.pending, cur)}
                  note="Payments Stripe has taken but not settled yet. They become available after Stripe's payout delay."
                />
                <Stat
                  label="Next payout"
                  value={
                    stats.balance.next_payout
                      ? money(stats.balance.next_payout.amount, cur)
                      : "None"
                  }
                  hint={
                    stats.balance.next_payout
                      ? `Arrives ${day(stats.balance.next_payout.arrives)}`
                      : "Nothing on its way to the bank"
                  }
                  note="The soonest payout Stripe has created that is pending or in transit to the bank."
                />
              </div>

              <RowTitle>This month</RowTitle>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="MRR"
                  value={money(stats.mrr, cur)}
                  hint={`${money(stats.arr, cur)} a year`}
                  note="Each active subscription's last real payment, after discounts and in the currency Stripe settled it, counted per month. Yearly plans count a twelfth."
                />
                <Stat
                  label="Revenue this month"
                  value={money(stats.this_month.gross, cur)}
                  hint={versus(
                    stats.this_month.gross,
                    stats.last_month.gross,
                    cur,
                    lastMonthKey,
                  )}
                  note="Everything customers were charged this month, as Stripe settled it into the account, before fees and refunds."
                />
                <Stat
                  label="Kept this month"
                  value={money(stats.this_month.net, cur)}
                  hint={`After ${money(stats.this_month.fees, cur)} Stripe fees`}
                  note="Revenue minus Stripe's fees and any refunds paid back this month."
                />
                <Stat
                  label="Refunded this month"
                  value={money(stats.this_month.refunds, cur)}
                  note="Money paid back to customers this month."
                />
              </div>

              <RowTitle>Customers</RowTitle>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="Paying"
                  value={String(stats.paying)}
                  hint={[
                    `${stats.trialing} on a trial`,
                    stats.paid_nothing
                      ? `${stats.paid_nothing} on a free or comped plan`
                      : "",
                    stats.past_due ? `${stats.past_due} payment failing` : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  note="Active subscriptions whose last bill was paid with real money. Free plans, 100% coupons and comps are counted separately."
                />
                <Stat
                  label="New this month"
                  value={
                    stats.new_paying === null ? "-" : String(stats.new_paying)
                  }
                  note="Customers whose first ever payment was this month."
                />
                <Stat
                  label="Cancelled this month"
                  value={String(stats.cancelled)}
                  hint={[
                    stats.cancel_rate === null
                      ? ""
                      : `${stats.cancel_rate}% of those paying at the start of the month`,
                    stats.trials_ended
                      ? `${stats.trials_ended} trials ended unpaid`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  note="Paying subscriptions that ended this month. Trials that ended before their first payment are counted separately."
                />
                <Stat
                  label="Net change"
                  value={
                    stats.net_change === null
                      ? "-"
                      : `${stats.net_change > 0 ? "+" : ""}${stats.net_change}`
                  }
                  note="New this month minus cancelled this month."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Box
                    title={`Revenue by month (${symbol})`}
                    hint="Charged, before fees and refunds"
                  >
                    <ColumnChart
                      name="Revenue by month"
                      values={stats.by_month.map((m) =>
                        Math.round(m.gross / 100),
                      )}
                      labels={stats.by_month.map((m) => monthLabel(m.month))}
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

              <RowTitle>Coming up</RowTitle>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <Box title="Next 30 days">
                  <ul className="space-y-1.5 text-sm">
                    <li
                      className="flex justify-between"
                      title="Paying subscriptions whose period ends in the next 30 days and are not set to cancel, at what their last bill settled."
                    >
                      <span className="text-zinc-700">
                        {stats.renewals_30d.count} renewals due
                      </span>
                      <span className="font-mono">
                        about {money(stats.renewals_30d.amount, cur)}
                      </span>
                    </li>
                    <li
                      className="flex justify-between"
                      title="Paying subscriptions set to end at their period end, and the MRR they take with them."
                    >
                      <span className="text-zinc-700">
                        {stats.setting_to_cancel.count} set to cancel
                      </span>
                      <span className="font-mono">
                        -{money(stats.setting_to_cancel.mrr, cur)} MRR
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-zinc-700">
                        {stats.trials_ending_30d} trials ending
                      </span>
                      <span className="text-xs text-zinc-400">
                        {stats.trialing} on a trial now
                      </span>
                    </li>
                  </ul>
                </Box>
                <Box
                  title="Payments failing"
                  hint={
                    stats.failing.length
                      ? "Oldest first, worth chasing"
                      : undefined
                  }
                >
                  {stats.failing.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No failing payments.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {stats.failing.map((f, i) => (
                        <li
                          key={`${f.email}-${i}`}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0 truncate">
                            <UserEmailLink userId={f.user_id} email={f.email} />
                            <span className="ml-2 text-xs capitalize text-zinc-400">
                              {f.tier}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono">
                            {money(f.amount, f.currency)}
                            <span className="ml-2 text-xs text-zinc-400">
                              since {day(f.since)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Box>
              </div>

              <RowTitle>Growth</RowTitle>
              <Box
                title="MRR movement"
                hint="Last 6 months. A plan change shows at the renewal it pays for."
              >
                <Table
                  head={[
                    "Month",
                    "New",
                    "Upgrades",
                    "Downgrades",
                    "Cancelled",
                    "Net",
                    "MRR",
                  ]}
                  rows={stats.mrr_movement
                    .slice(-6)
                    .reverse()
                    .map((m) => {
                      const net =
                        m.new + m.expansion - m.contraction - m.churned;
                      return [
                        monthLabel(m.month, "year"),
                        m.new ? `+${money(m.new, cur)}` : "-",
                        m.expansion ? `+${money(m.expansion, cur)}` : "-",
                        m.contraction ? `-${money(m.contraction, cur)}` : "-",
                        m.churned ? `-${money(m.churned, cur)}` : "-",
                        `${net < 0 ? "-" : "+"}${money(Math.abs(net), cur)}`,
                        money(m.mrr, cur),
                      ];
                    })}
                />
              </Box>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Box title="Trials" hint="By the month the trial started">
                    <Table
                      head={[
                        "Month",
                        "Started",
                        "Paid",
                        "Still in trial",
                        "Converted",
                      ]}
                      rows={stats.trials
                        .slice(-6)
                        .reverse()
                        .map((t) => {
                          const rate = percentOf(
                            t.converted,
                            t.started - t.running,
                          );
                          return [
                            monthLabel(t.month, "year"),
                            t.started,
                            t.converted,
                            t.running || "-",
                            rate === null ? "-" : `${rate}%`,
                          ];
                        })}
                    />
                  </Box>
                </div>
                <Box title="Referral credits">
                  {stats.referral_credits.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No referral rewards paid yet.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {stats.referral_credits.map((c) => (
                        <li key={c.currency} className="flex justify-between">
                          <span className="text-zinc-700">
                            {c.count} rewards
                          </span>
                          <span className="font-mono">
                            {money(c.amount, c.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {stats.referrals_waiting > 0 && (
                    <p className="mt-2 text-xs text-zinc-400">
                      {stats.referrals_waiting} more converted, waiting out the
                      hold before their reward
                    </p>
                  )}
                </Box>
              </div>

              <p className="text-xs text-zinc-400">
                All money is in {cur.toUpperCase()}, as Stripe settled it:
                payments in other currencies are converted at the rate Stripe
                used. Hover a figure to see how it is worked out.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
