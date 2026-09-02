"use client";

// Grouped, per-user view of extension feature usage for the selected period.
// One collapsible card per user; expanding it shows EVERY extension feature
// counter (zero-count rows included) so it is obvious which features a user
// does and does not touch. Rows are pre-computed on the server
// (loadExtensionUsageByUser); this is a pure renderer with NO mutations.
//
// The flat cross-user table lives on at /admin/usage/web for the web abuse
// rate limits (AdminUsageTable); this component is extension-only.

import { useMemo, useState, type ReactNode } from "react";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { extensionFeatureLabel } from "@/lib/admin/extension-features";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";

export type UserUsageFeatureRow = {
  feature: string;
  count: number;
  cap: number | null;
  percent: number | null;
};

export type UserUsageGroup = {
  user_id: string;
  email: string | null;
  tier_id: string;
  features: UserUsageFeatureRow[];
  totalCount: number;
  // Highest percent-of-cap across the user's metered features, for the
  // near-limit badge on the collapsed header. Null when nothing is capped.
  maxPercent: number | null;
};

type Props = {
  groups: UserUsageGroup[];
  periodLabel: string;
  // Server-rendered period controls (UsageRangePicker) slotted into the
  // header so this component stays a pure renderer of whatever period the
  // page resolved.
  toolbar?: ReactNode;
};

export function AdminUserUsageGroups({ groups, periodLabel, toolbar }: Props) {
  const [search, setSearch] = useState("");
  // Users the admin has explicitly toggled; everyone starts collapsed unless
  // "Expand all" flips the default.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [defaultOpen, setDefaultOpen] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((g) =>
      `${g.email ?? ""} ${g.user_id}`.toLowerCase().includes(term),
    );
  }, [groups, search]);

  const win = useWindowedRows(visible);

  const isOpen = (userId: string) => toggled[userId] ?? defaultOpen;
  const toggle = (userId: string) =>
    setToggled((t) => ({ ...t, [userId]: !isOpen(userId) }));
  const setAll = (open: boolean) => {
    setDefaultOpen(open);
    setToggled({});
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Extension usage
          <span className="ml-2 font-normal text-zinc-400">{periodLabel}</span>
        </h1>
        <div className="flex items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={() => setAll(true)}
            className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            Collapse all
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or user ID"
            className="w-72 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No extension usage recorded for this range.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {win.windowed.map((g) => (
              <li key={g.user_id}>
                <button
                  type="button"
                  onClick={() => toggle(g.user_id)}
                  aria-expanded={isOpen(g.user_id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50"
                >
                  <span
                    aria-hidden
                    className={
                      "text-xs text-zinc-400 transition-transform " +
                      (isOpen(g.user_id) ? "rotate-90" : "")
                    }
                  >
                    &gt;
                  </span>
                  <span className="max-w-[20rem] truncate text-sm">
                    {g.email ? (
                      <span className="text-zinc-800">{g.email}</span>
                    ) : (
                      <span className="font-mono text-xs text-zinc-400">
                        {g.user_id}
                      </span>
                    )}
                  </span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs capitalize text-zinc-600">
                    {g.tier_id}
                  </span>
                  {g.maxPercent !== null && g.maxPercent >= 90 && (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
                      near limit
                    </span>
                  )}
                  <span className="ml-auto whitespace-nowrap font-mono text-xs tabular-nums text-zinc-500">
                    {g.totalCount} actions ·{" "}
                    {g.features.filter((f) => f.count > 0).length} features
                  </span>
                </button>

                {isOpen(g.user_id) && (
                  <table className="w-full border-collapse bg-zinc-50/50 text-sm">
                    <thead className="text-left text-xs text-zinc-500">
                      <tr className="border-t border-[var(--admin-border)]">
                        <th className="py-1.5 pl-11 pr-3 font-medium">
                          Feature
                        </th>
                        <th className="px-3 py-1.5 font-medium">Count</th>
                        <th className="px-3 py-1.5 font-medium">Cap</th>
                        <th className="px-3 py-1.5 font-medium">% of cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.features.map((f) => (
                        <tr
                          key={f.feature}
                          className={
                            "border-t border-[var(--admin-border)] " +
                            (f.count === 0 ? "text-zinc-400" : "")
                          }
                        >
                          <td className="whitespace-nowrap py-1.5 pl-11 pr-3">
                            {extensionFeatureLabel(f.feature)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums">
                            {f.count}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-500">
                            {f.cap === null ? "-" : f.cap}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {f.percent === null ? (
                              <span className="text-zinc-300">-</span>
                            ) : (
                              <span
                                className={
                                  "font-medium tabular-nums " +
                                  (f.percent >= 90
                                    ? "text-red-600"
                                    : f.percent >= 75
                                      ? "text-amber-700"
                                      : "text-zinc-600")
                                }
                              >
                                {Math.round(f.percent)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <AdminTableFooter
        shown={win.shown}
        total={win.total}
        hasMore={win.hasMore}
        onShowMore={win.showMore}
        onShowAll={win.showAll}
        noun="users"
      />
    </div>
  );
}
