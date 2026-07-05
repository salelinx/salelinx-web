"use client";

// Read-only cross-user usage table for the current period. One row per
// (user, feature). Sorts by percent-of-cap by default so users near or over
// their limit float to the top. Filter by feature, search by email. Rows are
// pre-computed on the server (count / cap / percent); this is a pure renderer
// with NO mutations.

import { useMemo, useState } from "react";

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
};

type SortKey = "percent" | "count" | "feature";

export function AdminUsageTable({ rows, periodLabel }: Props) {
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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Usage
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
          options={featureOptions.map((f) => [f, f === "all" ? "All" : f])}
          onChange={setFeature}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No usage recorded for this period.
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
                <th className="px-3 py-2 font-medium">Cap</th>
                <SortableTh
                  label="% of cap"
                  active={sortKey === "percent"}
                  onClick={() => setSortKey("percent")}
                />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
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
                    {r.feature}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-800">
                    {r.count}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-500">
                    {r.cap === null ? "unlimited" : r.cap}
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
