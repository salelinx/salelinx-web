"use client";

// Read-only admin audit log. Filter by action and actor, search target id, and
// expand a row to see its metadata JSONB. The table is append-only at the DB
// level, so there are no mutations here. Newest first.

import { useMemo, useState } from "react";
import type { AdminAuditRow } from "@/lib/types/admin";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";

type Props = {
  entries: AdminAuditRow[];
  emails: Record<string, string>;
  capped: boolean;
  limit: number;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminAuditTable({ entries, emails, capped, limit }: Props) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [actor, setActor] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.action);
    return ["all", ...Array.from(set).sort()];
  }, [entries]);

  const actorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.actor_id) set.add(e.actor_id);
    return ["all", ...Array.from(set)];
  }, [entries]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (action !== "all" && e.action !== action) return false;
      if (actor !== "all" && e.actor_id !== actor) return false;
      if (term) {
        const haystack =
          `${e.target_id ?? ""} ${e.target_table ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [entries, search, action, actor]);

  // Cap how many rows reach the DOM. Filtering/sorting above still runs over
  // the whole set, so this bounds rendering only (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

  function metaIsEmpty(meta: Record<string, unknown>): boolean {
    return !meta || Object.keys(meta).length === 0;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Audit log
          <span className="ml-2 font-normal text-zinc-400">
            {entries.length}
            {capped ? `+ (showing latest ${limit})` : ""}
          </span>
        </h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search target id or table"
          className="w-72 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
        />
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs">
        <FilterGroup
          label="Action"
          value={action}
          options={actionOptions.map((a) => [a, a === "all" ? "All" : a])}
          onChange={setAction}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Actor:</span>
          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="rounded border border-[var(--admin-border)] bg-white px-2 py-0.5 text-zinc-700 outline-none focus:border-zinc-400"
          >
            {actorOptions.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "All" : (emails[a] ?? a)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No audit entries match these filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {win.windowed.map((e) => {
                const empty = metaIsEmpty(e.metadata);
                const isExpanded = expanded === e.id;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--admin-border)] align-top hover:bg-zinc-50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {formatWhen(e.created_at)}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2 text-zinc-700">
                      {(e.actor_id ? emails[e.actor_id] : null) ?? (
                        <span className="font-mono text-xs text-zinc-400">
                          {e.actor_id ?? "Deleted admin"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-800">
                      {e.action}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                      {e.target_table && (
                        <span className="text-zinc-400">
                          {e.target_table}:
                        </span>
                      )}
                      {e.target_id ? (
                        <span className="break-all">{e.target_id}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {empty ? (
                        <span className="text-zinc-300">-</span>
                      ) : isExpanded ? (
                        <pre className="max-w-md whitespace-pre-wrap break-all rounded bg-zinc-50 p-2 font-mono text-[11px] text-zinc-700">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpanded(e.id)}
                          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
                        >
                          {Object.keys(e.metadata).length} field
                          {Object.keys(e.metadata).length === 1 ? "" : "s"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
        noun="entries"
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
                : "rounded px-2 py-0.5 font-mono text-zinc-600 hover:bg-zinc-100"
            }
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
