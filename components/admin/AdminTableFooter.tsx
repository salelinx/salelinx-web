"use client";

// Footer shown under a windowed admin table. Renders nothing when the whole
// filtered set is already on screen, so short tables look exactly as before.
//
// The counts describe the FILTERED set, not the fetched set: "100 of 1,247"
// means the current filters match 1,247 rows and 100 are rendered. Filtering and
// search still run across everything (see lib/admin/use-windowed-rows.ts), so
// this is a rendering boundary, never a data one.

export function AdminTableFooter({
  shown,
  total,
  hasMore,
  onShowMore,
  onShowAll,
  noun,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  onShowMore: () => void;
  onShowAll: () => void;
  noun: string;
}) {
  if (!hasMore) return null;

  return (
    <div
      className="flex items-center justify-center gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-xs"
      role="status"
      aria-live="polite"
    >
      <span className="text-[var(--admin-muted)]">
        Showing {shown.toLocaleString("en-US")} of{" "}
        {total.toLocaleString("en-US")} {noun}
      </span>
      <button
        type="button"
        onClick={onShowMore}
        className="rounded border border-[var(--admin-border)] px-2 py-1 font-medium hover:bg-zinc-50"
      >
        Show more
      </button>
      <button
        type="button"
        onClick={onShowAll}
        className="rounded px-2 py-1 text-[var(--admin-muted)] underline-offset-2 hover:underline"
      >
        Show all
      </button>
    </div>
  );
}
