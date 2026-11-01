"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import type { SearchRow } from "@/lib/admin/search-console";

type SortKey = "clicks" | "impressions" | "ctr" | "position";

type Props = {
  rows: SearchRow[];
  days: number;
  periods: number[];
  range?: string;
  error?: string;
};

export function AdminSearchTable({ rows, days, periods, range, error }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [hideEmpty, setHideEmpty] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!term || r.url.toLowerCase().includes(term)) &&
        (!hideEmpty || r.impressions > 0),
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "position")
        return (a.position ?? Infinity) - (b.position ?? Infinity);
      return b[sortKey] - a[sortKey];
    });
  }, [rows, search, sortKey, hideEmpty]);

  const totals = useMemo(
    () => ({
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      impressions: rows.reduce((s, r) => s + r.impressions, 0),
      unseen: rows.filter((r) => r.inSitemap && r.impressions === 0).length,
    }),
    [rows],
  );

  const win = useWindowedRows(visible);

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
            {periods.map((p) => (
              <Link
                key={p}
                href={`/admin/search?days=${p}`}
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
          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
            />
            Hide pages with no impressions
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search URL"
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
          {totals.clicks.toLocaleString()} clicks,{" "}
          {totals.impressions.toLocaleString()} impressions, {totals.unseen}{" "}
          sitemap pages not shown in Google yet. Google&rsquo;s figures run
          about two days behind.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
            <tr className="border-b border-[var(--admin-border)]">
              <th className="px-3 py-2 font-medium">Page</th>
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
            {win.windowed.map((r) => (
              <tr
                key={r.url}
                className="border-b border-[var(--admin-border)] hover:bg-zinc-50"
              >
                <td className="max-w-[28rem] truncate px-3 py-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-800 hover:underline"
                  >
                    {r.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                  </a>
                  {!r.inSitemap && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                      not in sitemap
                    </span>
                  )}
                  {r.title && (
                    <div className="truncate text-xs text-zinc-500">
                      {r.title}
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
      <AdminTableFooter
        shown={win.shown}
        total={win.total}
        hasMore={win.hasMore}
        onShowMore={win.showMore}
        onShowAll={win.showAll}
        noun="pages"
      />
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
