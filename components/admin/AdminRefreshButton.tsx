"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Refresh the current admin table without a full page reload.
//
// Every admin module is a Server Component that queries Supabase and hands the
// rows to a client table. router.refresh() re-runs just that server render and
// streams the new payload into the existing tree, so the module's data is
// re-fetched while search terms, filters, sort order, the open/closed state of
// AdminSection blocks and the scroll position all survive. A browser reload
// throws away all of it, which is the thing this button exists to avoid.
//
// Two caveats that shaped the API:
//
//   1. A few tables (support, users) snapshot their server props into useState
//      so they can apply local edits optimistically. For those, a server
//      re-render alone does NOT update the rows - the state still holds the old
//      snapshot. They pass onRefresh to re-pull their own data instead; see
//      AdminTicketTable.refreshAll(). Tables that read their props directly
//      (subscriptions, storage, audit, health, usage) need no callback.
//
//   2. useTransition's isPending covers the server round-trip for refresh(),
//      but a very fast refresh would flash the label. The pending state is held
//      for a short floor so the button reads as having done something.

const MIN_PENDING_MS = 400;

export function AdminRefreshButton({
  onRefresh,
  label = "Refresh",
}: {
  // Optional extra work for tables that keep their own copy of the data.
  // Awaited alongside the server re-render.
  onRefresh?: () => Promise<void> | void;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [holding, setHolding] = useState(false);

  // Keep the spinner up for a moment after the work finishes, so a sub-100ms
  // refresh still reads as a deliberate action rather than a flicker.
  useEffect(() => {
    if (!holding) return;
    const t = setTimeout(() => setHolding(false), MIN_PENDING_MS);
    return () => clearTimeout(t);
  }, [holding]);

  const busy = isPending || holding;

  function handleClick() {
    if (busy) return;
    setHolding(true);
    // Fire the client-side refetch (if any) and the server re-render together;
    // they hit different data paths and neither depends on the other.
    void onRefresh?.();
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      // aria-live is deliberately on the label span, not the button: screen
      // readers should hear "Refreshing" without the button losing focus.
      title="Reload this table without reloading the page"
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`inline-block text-[13px] leading-none ${
          busy ? "animate-spin" : ""
        }`}
      >
        &#8635;
      </span>
      <span aria-live="polite">{busy ? "Refreshing" : label}</span>
    </button>
  );
}
