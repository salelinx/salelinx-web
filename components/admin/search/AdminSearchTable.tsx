"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";

type SortKey = "clicks" | "impressions" | "ctr" | "position";

export type SearchTableRow = {
  key: string;
  label: string;
  href?: string;
  sub?: string;
  tag?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
};

type Props = {
  rows: SearchTableRow[];
  view: "pages" | "searches";
  days: number;
  periods: number[];
  range?: string;
  summary: string;
  error?: string;
};

const VIEWS = [
  { key: "pages", label: "Pages" },
  { key: "searches", label: "Searches" },
] as const;

export function AdminSearchTable({
  rows,
  view,
  days,
  periods,
  range,
  summary,
  error,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [hideEmpty, setHideEmpty] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!term || `${r.label} ${r.sub ?? ""}`.toLowerCase().includes(term)) &&
        (!hideEmpty || r.impressions > 0),
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "position")
        return (a.position ?? Infinity) - (b.position ?? Infinity);
      return b[sortKey] - a[sortKey];
    });
  }, [rows, search, sortKey, hideEmpty]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          Search
          <span className="ml-2 font-normal text-zinc-400">
            Google Search Console{range ? `, ${range}` : ""}
          </span>
        </h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex overflow-hidden rounded-md border border-[var(--admin-border)] text-xs">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={`/admin/search?view=${v.key}&days=${days}`}
                className={
                  "px-2.5 py-1.5 " +
                  (v.key === view
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50")
                }
              >
                {v.label}
              </Link>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-[var(--admin-border)] text-xs">
            {periods.map((p) => (
              <Link
                key={p}
                href={`/admin/search?view=${view}&days=${p}`}
                className={
                  "px-2.5 py-1.5 " +
                  (p === days
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50")
                }
              >
                {p}d
              </Link>
            ))}
          </div>
          {view === "pages" && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
              />
              Hide pages with no impressions
            </label>
          )}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              view === "pages" ? "Search URL or title" : "Search searches"
            }
            className="min-w-40 flex-1 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400 sm:w-56 sm:flex-none"
          />
          <AdminRefreshButton />
        </div>
      </header>

      {error ? (
        <p className="border-b border-[var(--admin-border)] bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {error}
        </p>
      ) : (
        <p className="border-b border-[var(--admin-border)] px-4 py-2 text-xs text-zinc-500">
          {summary} Google&rsquo;s figures run about two days behind.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
            <tr className="border-b border-[var(--admin-border)]">
              <th className="px-3 py-2 font-medium">
                {view === "pages" ? "Page" : "Search"}
              </th>
              <SortableTh
                label="Clicks"
                active={sortKey === "clicks"}
                onClick={() => setSortKey("clicks")}
              />
              <SortableTh
                label="Impressions"
                active={sortKey === "impressions"}
                onClick={() => setSortKey("impressions")}
              />
              <SortableTh
                label="CTR"
                active={sortKey === "ctr"}
                onClick={() => setSortKey("ctr")}
              />
              <SortableTh
                label="Avg position"
                active={sortKey === "position"}
                onClick={() => setSortKey("position")}
              />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.key}
                className="border-b border-[var(--admin-border)] hover:bg-zinc-50"
              >
                <td className="max-w-[28rem] truncate px-3 py-2">
                  {r.href ? (
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-800 hover:underline"
                    >
                      {r.label}
                    </a>
                  ) : (
                    <span className="text-zinc-800">{r.label}</span>
                  )}
                  {r.tag && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                      {r.tag}
                    </span>
                  )}
                  {r.sub && (
                    <div className="truncate text-xs text-zinc-500">
                      {r.sub}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                  {r.clicks}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-600">
                  {r.impressions}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-600">
                  {r.impressions ? `${(r.ctr * 100).toFixed(1)}%` : "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-600">
                  {r.position === null ? "-" : r.position.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="shrink-0 border-t border-[var(--admin-border)] px-4 py-2 text-xs text-zinc-500">
        {visible.length} {view}
      </p>
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
