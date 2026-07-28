"use client";

// Dense user roster for the admin console: search by email, filter by tier and
// status, sort, and open a detail drawer per user. Models the support table
// (components/admin/support/AdminTicketTable.tsx). The drawer's subscription
// edit reports back via onSubscriptionChange so the roster row updates without
// a refetch.

import { useMemo, useState } from "react";
import type { TierConfig } from "@/lib/types/tiers";
import type { AdminUserRow } from "@/lib/types/admin";
import { AdminUserDetail } from "./AdminUserDetail";

type Props = {
  initialUsers: AdminUserRow[];
  tiers: TierConfig[];
};

type SortKey = "created_at" | "last_sign_in_at" | "email" | "tier_id";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  trialing: "bg-sky-50 text-sky-700",
  past_due: "bg-amber-50 text-amber-700",
  canceled: "bg-zinc-100 text-zinc-600",
  incomplete: "bg-zinc-100 text-zinc-600",
};

export function AdminUserTable({ initialUsers, tiers }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tierOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) if (u.tier_id) set.add(u.tier_id);
    return ["all", ...Array.from(set).sort()];
  }, [users]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      const effectiveTier = u.tier_id ?? "free";
      if (tier !== "all" && effectiveTier !== tier) return false;
      if (status !== "all") {
        const effectiveStatus = u.status ?? "none";
        if (effectiveStatus !== status) return false;
      }
      if (term) {
        const haystack = `${u.email ?? ""} ${u.user_id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "email":
          return (a.email ?? "").localeCompare(b.email ?? "");
        case "tier_id":
          return (a.tier_id ?? "free").localeCompare(b.tier_id ?? "free");
        case "last_sign_in_at":
          return (b.last_sign_in_at ?? "").localeCompare(
            a.last_sign_in_at ?? "",
          );
        case "created_at":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [users, search, tier, status, sortKey]);

  const selected = selectedId
    ? (users.find((u) => u.user_id === selectedId) ?? null)
    : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Users
          <span className="ml-2 font-normal text-zinc-400">{users.length}</span>
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
          label="Tier"
          value={tier}
          options={tierOptions.map((t) => [t, t === "all" ? "All" : t])}
          onChange={setTier}
        />
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
            ["none", "No subscription"],
          ]}
          onChange={setStatus}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No users match these filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <SortableTh
                  label="Email"
                  active={sortKey === "email"}
                  onClick={() => setSortKey("email")}
                />
                <SortableTh
                  label="Tier"
                  active={sortKey === "tier_id"}
                  onClick={() => setSortKey("tier_id")}
                />
                <th className="px-3 py-2 font-medium">Status</th>
                <SortableTh
                  label="Joined"
                  active={sortKey === "created_at"}
                  onClick={() => setSortKey("created_at")}
                />
                <SortableTh
                  label="Last sign-in"
                  active={sortKey === "last_sign_in_at"}
                  onClick={() => setSortKey("last_sign_in_at")}
                />
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr
                  key={u.user_id}
                  onClick={() => setSelectedId(u.user_id)}
                  className={
                    "cursor-pointer border-b border-[var(--admin-border)] hover:bg-zinc-50 " +
                    (selectedId === u.user_id ? "bg-zinc-100" : "")
                  }
                >
                  <td className="max-w-[18rem] px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {u.email ? (
                        <span className="truncate text-zinc-800">
                          {u.email}
                        </span>
                      ) : (
                        <span className="truncate font-mono text-xs text-zinc-400">
                          {u.user_id}
                        </span>
                      )}
                      {u.is_admin && <AdminTag />}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 capitalize text-zinc-700">
                    {u.tier_id ?? "free"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {u.status ? (
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (STATUS_TONE[u.status] ?? "bg-zinc-100 text-zinc-600")
                        }
                      >
                        {u.status}
                      </span>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                    {formatDate(u.last_sign_in_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <AdminUserDetail
          key={selected.user_id}
          user={selected}
          tiers={tiers}
          onClose={() => setSelectedId(null)}
          onSubscriptionChange={(userId, tierId, status) =>
            setUsers((prev) =>
              prev.map((u) =>
                u.user_id === userId
                  ? { ...u, tier_id: tierId, status }
                  : u,
              ),
            )
          }
        />
      )}
    </div>
  );
}

// Small "(Admin)" pill shown next to admins in the roster. Display-only.
function AdminTag() {
  return (
    <span className="shrink-0 rounded-full border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
      Admin
    </span>
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
