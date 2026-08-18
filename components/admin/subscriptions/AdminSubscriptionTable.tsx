"use client";

// Read-only subscriptions table for the admin console: search by email /
// customer id, filter by status and tier, sort by renewal date or status.
// Stripe ids are shown as plain monospace text (no live Stripe API calls in
// this read-only pass). Models the support table; has NO mutations.

import { useMemo, useState } from "react";
import type { AdminSubscriptionRow } from "@/lib/types/admin";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";

type Props = {
  initialSubscriptions: AdminSubscriptionRow[];
  emails: Record<string, string>;
};

type SortKey = "updated_at" | "current_period_end" | "status" | "tier_id";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  trialing: "bg-sky-50 text-sky-700",
  past_due: "bg-amber-50 text-amber-700",
  canceled: "bg-zinc-100 text-zinc-600",
  incomplete: "bg-zinc-100 text-zinc-600",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminSubscriptionTable({
  initialSubscriptions,
  emails,
}: Props) {
  const [subs] = useState<AdminSubscriptionRow[]>(initialSubscriptions);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");

  const tierOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of subs) set.add(s.tier_id);
    return ["all", ...Array.from(set).sort()];
  }, [subs]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = subs.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (tier !== "all" && s.tier_id !== tier) return false;
      if (term) {
        const email = (emails[s.user_id] ?? "").toLowerCase();
        const haystack =
          `${email} ${s.user_id} ${s.stripe_customer_id ?? ""} ${s.stripe_subscription_id ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "current_period_end":
          return (b.current_period_end ?? "").localeCompare(
            a.current_period_end ?? "",
          );
        case "status":
          return a.status.localeCompare(b.status);
        case "tier_id":
          return a.tier_id.localeCompare(b.tier_id);
        case "updated_at":
        default:
          return b.updated_at.localeCompare(a.updated_at);
      }
    });
    return sorted;
  }, [subs, emails, search, status, tier, sortKey]);

  // Cap how many rows reach the DOM. Filtering/sorting above still runs over
  // the whole set, so this bounds rendering only (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Subscriptions
          <span className="ml-2 font-normal text-zinc-400">{subs.length}</span>
        </h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, user ID, or Stripe ID"
          className="w-80 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
        />
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs">
        <FilterGroup
          label="Status"
          value={status}
          options={[
            ["all", "All"],
            ["active", "Active"],
            ["trialing", "Trialing"],
            ["past_due", "Past due"],
            ["canceled", "Canceled"],
            ["incomplete", "Incomplete"],
          ]}
          onChange={setStatus}
        />
        <FilterGroup
          label="Tier"
          value={tier}
          options={tierOptions.map((t) => [t, t === "all" ? "All" : t])}
          onChange={setTier}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No subscriptions match these filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="px-3 py-2 font-medium">Customer</th>
                <SortableTh
                  label="Tier"
                  active={sortKey === "tier_id"}
                  onClick={() => setSortKey("tier_id")}
                />
                <SortableTh
                  label="Status"
                  active={sortKey === "status"}
                  onClick={() => setSortKey("status")}
                />
                <SortableTh
                  label="Renews"
                  active={sortKey === "current_period_end"}
                  onClick={() => setSortKey("current_period_end")}
                />
                <th className="px-3 py-2 font-medium">Stripe customer</th>
              </tr>
            </thead>
            <tbody>
              {win.windowed.map((s) => {
                const email = emails[s.user_id];
                return (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--admin-border)] hover:bg-zinc-50"
                  >
                    <td className="max-w-[16rem] truncate px-3 py-2">
                      {email ? (
                        <span className="text-zinc-800">{email}</span>
                      ) : (
                        <span className="font-mono text-xs text-zinc-400">
                          {s.user_id}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 capitalize text-zinc-700">
                      {s.tier_id}{" "}
                      <span className="text-xs text-zinc-400">
                        v{s.tier_version}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (STATUS_TONE[s.status] ?? "bg-zinc-100 text-zinc-600")
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {formatDate(s.current_period_end)}
                      {s.cancel_at_period_end && (
                        <span
                          title="Cancels at period end"
                          className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                        >
                          cancels
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-400">
                      {s.stripe_customer_id ?? "-"}
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
        noun="subscriptions"
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
                : "rounded px-2 py-0.5 capitalize text-zinc-600 hover:bg-zinc-100"
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
