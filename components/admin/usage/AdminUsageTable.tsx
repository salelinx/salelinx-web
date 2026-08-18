"use client";

// Read-only cross-user usage table for the current period. One row per
// (user, feature). Sorts by percent-of-cap by default so users near or over
// their limit float to the top. Filter by feature, search by email. Rows are
// pre-computed on the server (count / cap / percent); this is a pure renderer
// with NO mutations.
//
// Shared by BOTH usage modules: /admin/usage (extension product metering,
// capped by tier_limits) and /admin/usage/web (web abuse rate limits, capped by
// hardcoded constants in the Edge Functions). The two differ only in which rows
// they are handed and how the cap column is labelled, so `capKind` switches the
// wording rather than forking the component. See lib/admin/usage-sources.ts.

import { useMemo, useState } from "react";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";

export type UsageTableRow = {
  key: string;
  user_id: string;
  email: string | null;
  tier_id: string;
  feature: string;
  period_key: string;
  count: number;
  cap: number | null;
  percent: number | null;
};

type Props = {
  rows: UsageTableRow[];
  periodLabel: string;
  // "tier" = cap comes from the user's tier_limits row (extension metering).
  // "limit" = cap is a fixed per-day safety valve in the calling code.
  capKind?: "tier" | "limit";
  emptyMessage?: string;
  // Optional per-feature display label (web counters have friendly names).
  labelFor?: (feature: string) => string;
};

type SortKey = "percent" | "count" | "feature";

export function AdminUsageTable({
  rows,
  periodLabel,
  capKind = "tier",
  emptyMessage,
  labelFor,
}: Props) {
  const [search, setSearch] = useState("");
  const [feature, setFeature] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("percent");

  const featureOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.feature);
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (feature !== "all" && r.feature !== feature) return false;
      if (term) {
        const haystack = `${r.email ?? ""} ${r.user_id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "count":
          return b.count - a.count;
        case "feature":
          return a.feature.localeCompare(b.feature);
        case "percent":
        default: {
          // Rows with no finite cap (unlimited / unmapped) sort to the bottom.
          const ap = a.percent ?? -1;
          const bp = b.percent ?? -1;
          return bp - ap;
        }
      }
    });
    return sorted;
  }, [rows, search, feature, sortKey]);

  // Cap how many rows reach the DOM. Filtering/sorting above still runs over
  // the whole set, so this bounds rendering only (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          {capKind === "limit" ? "Web usage" : "Extension usage"}
          <span className="ml-2 font-normal text-zinc-400">{periodLabel}</span>
        </h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or user ID"
          className="w-72 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
        />
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs">
        <FilterGroup
          label="Feature"
          value={feature}
          options={featureOptions.map((f) => [
            f,
            f === "all" ? "All" : labelFor ? labelFor(f) : f,
          ])}
          onChange={setFeature}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            {emptyMessage ?? "No usage recorded for this period."}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <SortableTh
                  label="Feature"
                  active={sortKey === "feature"}
                  onClick={() => setSortKey("feature")}
                />
                <SortableTh
                  label="Count"
                  active={sortKey === "count"}
                  onClick={() => setSortKey("count")}
                />
                <th className="px-3 py-2 font-medium">
                  {capKind === "limit" ? "Daily limit" : "Cap"}
                </th>
                <SortableTh
                  label={capKind === "limit" ? "% of limit" : "% of cap"}
                  active={sortKey === "percent"}
                  onClick={() => setSortKey("percent")}
                />
              </tr>
            </thead>
            <tbody>
              {win.windowed.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-[var(--admin-border)] hover:bg-zinc-50"
                >
                  <td className="max-w-[16rem] truncate px-3 py-2">
                    {r.email ? (
                      <span className="text-zinc-800">{r.email}</span>
                    ) : (
                      <span className="font-mono text-xs text-zinc-400">
                        {r.user_id}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 capitalize text-zinc-600">
                    {r.tier_id}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {labelFor ? labelFor(r.feature) : r.feature}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-800">
                    {r.count}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-500">
                    {r.cap === null
                      ? capKind === "limit"
                        ? "-"
                        : "unlimited"
                      : capKind === "limit"
                        ? `${r.cap} / day`
                        : r.cap}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.percent === null ? (
                      <span className="text-zinc-300">-</span>
                    ) : (
                      <span
                        className={
                          "font-medium tabular-nums " +
                          (r.percent >= 90
                            ? "text-red-600"
                            : r.percent >= 75
                              ? "text-amber-700"
                              : "text-zinc-600")
                        }
                      >
                        {Math.round(r.percent)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AdminTableFooter
        shown={win.shown}
        total={win.total}
        hasMore={win.hasMore}
        onShowMore={win.showMore}
        onShowAll={win.showAll}
        noun="rows"
      />
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={
              value === v
                ? "rounded bg-zinc-900 px-2 py-0.5 font-medium text-white"
                : "rounded px-2 py-0.5 text-zinc-600 hover:bg-zinc-100"
            }
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortableTh({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={
          "flex items-center gap-1 " +
          (active ? "text-zinc-900" : "hover:text-zinc-700")
        }
      >
        {label}
        {active && <span aria-hidden>v</span>}
      </button>
    </th>
  );
}
