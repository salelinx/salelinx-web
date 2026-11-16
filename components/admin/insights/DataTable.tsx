"use client";

// A table sorted by clicking any header (again to flip it). Missing values
// always sort last, whichever way, so a column of mostly dashes still leads
// with real numbers. Long tables show the first `pageSize` rows and a Show
// more button.

import { useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: ReactNode;
  title?: string;
  align?: "left" | "right" | "center";
  sort?: (row: T) => number | string | null;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  pageSize = 50,
  minWidth,
  empty = "Nothing to show.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; desc: boolean };
  pageSize?: number;
  minWidth?: number;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [shown, setShown] = useState(pageSize);

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort!.desc ? -c : c;
    });
  }, [rows, columns, sort]);

  if (!rows.length) return <p className="px-4 py-6 text-sm text-zinc-500">{empty}</p>;

  const align = (c: Column<T>) =>
    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
          <thead className="text-xs text-zinc-500">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    title={c.title}
                    aria-sort={active ? (sort!.desc ? "descending" : "ascending") : undefined}
                    className={`whitespace-nowrap px-3 py-2 font-medium first:pl-4 last:pr-4 ${align(c)}`}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort(active ? { key: c.key, desc: !sort!.desc } : { key: c.key, desc: c.align !== "left" })
                        }
                        className={`inline-flex items-center gap-1 hover:text-zinc-900 ${active ? "text-zinc-900" : ""}`}
                      >
                        {c.label}
                        <span aria-hidden className={active ? "" : "text-zinc-300"}>
                          {active ? (sort!.desc ? "↓" : "↑") : "↕"}
                        </span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, shown).map((r) => (
              <tr key={rowKey(r)} className="border-t border-[var(--admin-border)] hover:bg-zinc-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-1.5 first:pl-4 last:pr-4 ${align(c)} ${c.className ?? ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > shown && (
        <div className="flex items-center gap-3 border-t border-[var(--admin-border)] px-4 py-2 text-xs text-zinc-500">
          Showing {shown} of {sorted.length}
          <button type="button" onClick={() => setShown(shown + pageSize * 2)} className="text-zinc-800 hover:underline">
            Show more
          </button>
          <button type="button" onClick={() => setShown(sorted.length)} className="text-zinc-800 hover:underline">
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
