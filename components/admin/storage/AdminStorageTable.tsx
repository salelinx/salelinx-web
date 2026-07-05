"use client";

// Read-only cross-user cloud storage table. One row per user with a
// user_storage gauge row (i.e. anyone who has ever uploaded to the
// listing-images bucket). Sorts by percent-of-cap by default so users near or
// over their allowance float to the top. Search by email or user ID. Rows are
// pre-computed on the server (bytes / cap / percent, labels pre-formatted);
// this is a pure renderer with NO mutations.

import { useMemo, useState } from "react";

export type StorageTableRow = {
  user_id: string;
  email: string | null;
  tier_id: string;
  bytes_used: number;
  bytes_label: string;
  cap_label: string;
  percent: number | null;
  updated_at: string;
};

type Props = {
  rows: StorageTableRow[];
};

type SortKey = "percent" | "bytes";

export function AdminStorageTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("percent");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (term) {
        const haystack = `${r.email ?? ""} ${r.user_id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "bytes":
          return b.bytes_used - a.bytes_used;
        case "percent":
        default: {
          // Rows with no finite cap (unlimited / no allowance) sort to the
          // bottom.
          const ap = a.percent ?? -1;
          const bp = b.percent ?? -1;
          return bp - ap;
        }
      }
    });
    return sorted;
  }, [rows, search, sortKey]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Storage
          <span className="ml-2 font-normal text-zinc-400">
            listing-images bucket
          </span>
        </h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or user ID"
          className="w-72 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No storage usage recorded.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <SortableTh
                  label="Used"
                  active={sortKey === "bytes"}
                  onClick={() => setSortKey("bytes")}
                />
                <th className="px-3 py-2 font-medium">Cap</th>
                <SortableTh
                  label="% of cap"
                  active={sortKey === "percent"}
                  onClick={() => setSortKey("percent")}
                />
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.user_id}
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
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-800">
                    {r.bytes_label}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-500">
                    {r.cap_label}
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
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                    {new Date(r.updated_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
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
