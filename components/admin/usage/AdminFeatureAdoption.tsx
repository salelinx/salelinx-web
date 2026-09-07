"use client";

// Feature adoption: which extension features people actually use, across
// users. Renders the AdoptionReport computed server-side (lib/admin/adoption.ts)
// and adds only client-side sorting. Read-only, no mutations.
//
// Layout, top to bottom:
//   1. KPI row: active users, actions, features in use, returning users.
//   2. Adoption table: one row per feature (zero rows included, dimmed), with
//      distinct users, share of the base, delta vs the previous window,
//      actions, median per user, and a 6-month sparkline of users.
//   3. Tier matrix: the same features by plan, so "nobody on Pro uses X" and
//      "Starter users all use Y" are visible; cells a plan cannot use are
//      greyed out rather than shown as 0%.
//
// Everything is measured in DISTINCT USERS first. Action counts are shown but
// never drive the sort by default: one bulk run inflates them.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  AdoptionReport,
  FeatureAdoption,
  TierCell,
} from "@/lib/admin/adoption";
import { monthLabel, shortMonthLabel } from "@/lib/admin/adoption";
import { Sparkline } from "@/components/admin/usage/Sparkline";

type Props = {
  report: AdoptionReport;
  toolbar?: ReactNode;
};

type SortKey = "users" | "adoption" | "delta" | "actions" | "median";

const num = (n: number) => n.toLocaleString("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmtPct(p: number | null): string {
  if (p === null) return "-";
  if (p > 0 && p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

function tierLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

const BASE_DESCRIPTION: Record<AdoptionReport["window"]["base"], string> = {
  active: "users who recorded any extension activity in the window",
  paid: "users on a paid tier with an active or trialing subscription",
  all: "every account",
};

export function AdminFeatureAdoption({ report, toolbar }: Props) {
  const { window: win } = report;
  const [sort, setSort] = useState<SortKey>("users");

  const sorted = useMemo(() => {
    const rows = [...report.features];
    const delta = (f: FeatureAdoption) =>
      f.compareUsers === null ? Number.NEGATIVE_INFINITY : f.users - f.compareUsers;
    const by: Record<SortKey, (f: FeatureAdoption) => number> = {
      users: (f) => f.users,
      adoption: (f) => f.adoption ?? -1,
      delta,
      actions: (f) => f.actions,
      median: (f) => f.medianPerUser ?? -1,
    };
    const key = by[sort];
    rows.sort(
      (a, b) => key(b) - key(a) || b.users - a.users || a.label.localeCompare(b.label),
    );
    return rows;
  }, [report.features, sort]);

  const trendLabels = win.trendMonths.map(shortMonthLabel);
  const unused = report.featuresTotal - report.featuresUsed;
  const compareText = win.compareLabel ? `vs ${win.compareLabel}` : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Feature adoption
          <span className="ml-2 font-normal text-zinc-400">{win.label}</span>
        </h1>
        <div className="flex items-center gap-3">
          {toolbar}
          <Link
            href="/admin/usage"
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Per-user view
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-4">
          {report.unmeasuredMonths.length > 0 && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Activity counters (everything except crosslist, relist, refresh,
              follow and unfollow) only started recording on 26 Aug 2026 with
              extension 1.1.5. {report.unmeasuredMonths.map(monthLabel).join(", ")}{" "}
              {report.unmeasuredMonths.length === 1 ? "is" : "are"} partly or
              wholly unmeasured for those features, and users on older builds
              still report nothing.
            </p>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Active users"
              value={num(report.activeUsers)}
              delta={
                report.compareActiveUsers === null
                  ? null
                  : report.activeUsers - report.compareActiveUsers
              }
              deltaLabel={compareText}
              hint="recorded any extension activity"
              trend={report.monthlyActiveUsers}
              trendLabels={trendLabels}
              trendName="Active users"
            />
            <StatTile
              label="Actions"
              value={compact.format(report.totalActions)}
              delta={
                report.compareTotalActions === null
                  ? null
                  : report.totalActions - report.compareTotalActions
              }
              deltaLabel={compareText}
              hint="counter increments across every feature"
              trend={report.monthlyActions}
              trendLabels={trendLabels}
              trendName="Actions"
            />
            <StatTile
              label="Features in use"
              value={`${report.featuresUsed} of ${report.featuresTotal}`}
              hint={
                unused === 0
                  ? "every tracked feature has at least one user"
                  : `${unused} ${unused === 1 ? "feature has" : "features have"} no users in this window`
              }
              accent={unused > 0}
            />
            {report.returningUsers !== null && win.compareLabel ? (
              <StatTile
                label="Returning users"
                value={num(report.returningUsers)}
                hint={`of ${num(report.activeUsers)} active were also active in ${win.compareLabel}`}
              />
            ) : (
              <StatTile
                label="Adoption base"
                value={num(report.baseUsers)}
                hint={BASE_DESCRIPTION[win.base]}
              />
            )}
          </div>

          {/* Adoption table */}
          <section className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">By feature</h2>
              <p className="text-xs text-zinc-500">
                Users are distinct accounts. Adoption is users as a share of{" "}
                {BASE_DESCRIPTION[win.base]} ({num(report.baseUsers)}).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 pl-4 pr-3 font-medium">Feature</th>
                    <th className="px-3 py-2 font-medium">Plan</th>
                    <SortTh k="users" sort={sort} setSort={setSort}>
                      Users
                    </SortTh>
                    <SortTh k="adoption" sort={sort} setSort={setSort}>
                      Adoption
                    </SortTh>
                    <SortTh
                      k="delta"
                      sort={sort}
                      setSort={setSort}
                      title={compareText ?? "No previous window to compare"}
                    >
                      Change
                    </SortTh>
                    <SortTh k="actions" sort={sort} setSort={setSort}>
                      Actions
                    </SortTh>
                    <SortTh
                      k="median"
                      sort={sort}
                      setSort={setSort}
                      title="Median actions per user who used the feature"
                    >
                      Median / user
                    </SortTh>
                    <th className="px-3 py-2 pr-4 font-medium">
                      Users, {trendLabels[0]} to {trendLabels[trendLabels.length - 1]}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((f) => (
                    <tr
                      key={f.feature}
                      className={
                        "border-t border-[var(--admin-border)] " +
                        (f.users === 0 ? "text-zinc-400" : "")
                      }
                    >
                      <td className="whitespace-nowrap py-2 pl-4 pr-3">
                        <span className={f.users === 0 ? "" : "text-zinc-900"}>
                          {f.label}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-zinc-400">
                          {f.feature}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <PlanBadge minTier={f.minTier} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        {num(f.users)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <AdoptionBar pct={f.adoption} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        <Delta
                          value={
                            f.compareUsers === null ? null : f.users - f.compareUsers
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        {num(f.actions)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                        {f.medianPerUser === null ? (
                          <span className="text-zinc-300">-</span>
                        ) : (
                          num(f.medianPerUser)
                        )}
                      </td>
                      <td className="px-3 py-1 pr-4">
                        <Sparkline
                          values={f.trend}
                          labels={trendLabels}
                          name={f.label}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tier matrix */}
          <section className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">By plan</h2>
              <p className="flex items-center gap-3 text-xs text-zinc-500">
                <span>Share of each plan&apos;s base users</span>
                <span className="flex items-center gap-1" aria-hidden>
                  {["bg-blue-50", "bg-blue-100", "bg-blue-200", "bg-blue-300", "bg-blue-400"].map(
                    (c) => (
                      <span key={c} className={`inline-block h-3 w-3 rounded-sm ${c}`} />
                    ),
                  )}
                  <span className="ml-1">low to high</span>
                </span>
                <span className="flex items-center gap-1">
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 rounded-sm bg-zinc-100 text-center text-[9px] leading-3 text-zinc-400"
                  >
                    -
                  </span>
                  not on plan
                </span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 pl-4 pr-3 font-medium">Feature</th>
                    {report.tiers.map((t) => (
                      <th
                        key={t.tier_id}
                        className="px-3 py-2 text-right font-medium"
                      >
                        {tierLabel(t.tier_id)}
                        <span className="ml-1 font-normal text-zinc-400">
                          {num(t.base)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((f) => (
                    <tr
                      key={f.feature}
                      className="border-t border-[var(--admin-border)]"
                    >
                      <td
                        className={
                          "whitespace-nowrap py-1.5 pl-4 pr-3 " +
                          (f.users === 0 ? "text-zinc-400" : "text-zinc-900")
                        }
                      >
                        {f.label}
                      </td>
                      {report.tiers.map((t) => (
                        <MatrixCell
                          key={t.tier_id}
                          cell={t.cells[f.feature]}
                          tier={t.tier_id}
                          feature={f.label}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-xs text-zinc-400">
            Source: usage_counters, extension counters only. Monthly buckets;
            refresh, follow and unfollow are summed from their daily buckets.
            Plan eligibility uses the current tier_limits definition, so a
            grandfathered user may differ.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  trend,
  trendLabels,
  trendName,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  deltaLabel?: string | null;
  trend?: number[];
  trendLabels?: string[];
  trendName?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold">{value}</p>
        {trend && trend.length > 0 && (
          <Sparkline
            values={trend}
            labels={trendLabels}
            name={trendName}
            width={96}
            height={28}
          />
        )}
      </div>
      <p
        className={
          "mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs " +
          (accent ? "font-medium text-amber-700" : "text-zinc-500")
        }
      >
        {delta !== undefined && delta !== null && (
          <>
            <Delta value={delta} />
            {deltaLabel && <span>{deltaLabel}</span>}
            <span aria-hidden>&middot;</span>
          </>
        )}
        <span>{hint}</span>
      </p>
    </div>
  );
}

// Signed so direction never rides on color alone.
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-300">-</span>;
  if (value === 0) return <span className="text-zinc-400">0</span>;
  const up = value > 0;
  return (
    <span
      className={
        "font-medium tabular-nums " + (up ? "text-emerald-700" : "text-red-600")
      }
    >
      {up ? "+" : "-"}
      {num(Math.abs(value))}
    </span>
  );
}

function AdoptionBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-zinc-300">-</span>;
  const width = Math.max(0, Math.min(100, pct));
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-blue-100"
        aria-hidden
      >
        <span
          className="block h-full rounded-full bg-blue-600"
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="w-10 font-mono text-xs tabular-nums text-zinc-700">
        {fmtPct(pct)}
      </span>
    </span>
  );
}

function PlanBadge({ minTier }: { minTier: string | null }) {
  if (minTier === null) {
    return <span className="text-xs text-zinc-400">Any</span>;
  }
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
      {tierLabel(minTier)}
      {minTier === "business" ? "" : "+"}
    </span>
  );
}

function cellFill(p: number): string {
  if (p === 0) return "";
  if (p < 10) return "bg-blue-50";
  if (p < 25) return "bg-blue-100";
  if (p < 50) return "bg-blue-200";
  if (p < 75) return "bg-blue-300";
  return "bg-blue-400";
}

function MatrixCell({
  cell,
  tier,
  feature,
}: {
  cell: TierCell | undefined;
  tier: string;
  feature: string;
}) {
  if (!cell) return <td className="px-3 py-1.5" />;
  if (!cell.eligible) {
    return (
      <td
        className="bg-zinc-100 px-3 py-1.5 text-right text-zinc-300"
        title={`${feature} is not included on ${tierLabel(tier)}`}
      >
        -
      </td>
    );
  }
  if (cell.adoption === null) {
    return (
      <td
        className="px-3 py-1.5 text-right text-zinc-300"
        title={`No ${tierLabel(tier)} users in the base`}
      >
        -
      </td>
    );
  }
  return (
    <td
      className={
        "px-3 py-1.5 text-right font-mono text-xs tabular-nums " +
        (cell.users === 0 ? "text-zinc-400 " : "text-zinc-900 ") +
        cellFill(cell.adoption)
      }
      title={`${num(cell.users)} ${tierLabel(tier)} ${cell.users === 1 ? "user" : "users"} used ${feature}`}
    >
      {fmtPct(cell.adoption)}
    </td>
  );
}

function SortTh({
  k,
  sort,
  setSort,
  title,
  children,
}: {
  k: SortKey;
  sort: SortKey;
  setSort: (k: SortKey) => void;
  title?: string;
  children: ReactNode;
}) {
  const active = sort === k;
  return (
    <th
      className="px-3 py-2 font-medium"
      title={title}
      aria-sort={active ? "descending" : undefined}
    >
      <button
        type="button"
        onClick={() => setSort(k)}
        className={
          "inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-zinc-100 " +
          (active ? "text-zinc-900" : "")
        }
      >
        {children}
        <span aria-hidden className={active ? "text-zinc-500" : "text-zinc-300"}>
          &#9662;
        </span>
      </button>
    </th>
  );
}
