"use client";

// Dense user roster for the admin console: search by email, filter by tier,
// status, connected marketplace and recent activity, sort, and open a detail
// drawer per user. Models the support table
// (components/admin/support/AdminTicketTable.tsx). The drawer's subscription
// edit reports back via onSubscriptionChange so the roster row updates without
// a refetch.
//
// "Last active" is the more recent of the account's last sign-in and its
// freshest extension heartbeat (device_sessions), not last_sign_in_at alone: a
// long-lived refresh token means a signed-in-months-ago seller who uses the
// extension daily looks dormant by sign-in date. The drawer shows the two
// timestamps separately when the difference matters.

import { useMemo, useState } from "react";
import type { TierConfig } from "@/lib/types/tiers";
import type { AdminUserRow, LinkedPlatform } from "@/lib/types/admin";
import {
  mostRecent,
  relativeAge,
  staleness,
  STALENESS_TONE,
} from "@/lib/admin/relative-time";
import { useClientNow } from "@/lib/admin/use-client-now";
import { AdminUserDetail } from "./AdminUserDetail";

type Props = {
  initialUsers: AdminUserRow[];
  tiers: TierConfig[];
};

type SortKey = "created_at" | "last_active" | "email" | "tier_id";

// Activity buckets, evaluated against the same "last active" value the column
// shows. Thresholds match lib/admin/relative-time.ts's staleness buckets.
type ActivityFilter = "all" | "fresh" | "recent" | "stale" | "none";

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

const PLATFORM_TONE: Record<LinkedPlatform, string> = {
  depop: "bg-rose-50 text-rose-700 border-rose-200",
  vinted: "bg-teal-50 text-teal-700 border-teal-200",
};

export function AdminUserTable({ initialUsers, tiers }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Null on the server and through hydration, a ticking timestamp afterwards,
  // so relative ages cannot cause a mismatch. See lib/admin/use-client-now.ts.
  const now = useClientNow();

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
      if (platform !== "all") {
        const linked = u.linked_platforms ?? [];
        if (platform === "none") {
          if (linked.length > 0) return false;
        } else if (!linked.includes(platform as LinkedPlatform)) {
          return false;
        }
      }
      // Skipped until `now` exists, so the pre-hydration render keeps every row
      // (the default filter is "all", so this only matters if someone could
      // pick a bucket before mount, which they cannot).
      if (activity !== "all" && now !== null) {
        const active = mostRecent(u.last_sign_in_at, u.last_device_seen_at);
        if (staleness(active, now) !== activity) return false;
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
        case "last_active":
          return (
            mostRecent(b.last_sign_in_at, b.last_device_seen_at) ?? ""
          ).localeCompare(
            mostRecent(a.last_sign_in_at, a.last_device_seen_at) ?? "",
          );
        case "created_at":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [users, search, tier, status, platform, activity, sortKey, now]);

  const selected = selectedId
    ? (users.find((u) => u.user_id === selectedId) ?? null)
    : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Users
          <span className="ml-2 font-normal text-zinc-400">
            {visible.length === users.length
              ? users.length
              : `${visible.length} / ${users.length}`}
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
        <FilterGroup
          label="Linked"
          value={platform}
          options={[
            ["all", "All"],
            ["depop", "Depop"],
            ["vinted", "Vinted"],
            ["none", "Nothing linked"],
          ]}
          onChange={setPlatform}
        />
        <FilterGroup
          label="Active"
          value={activity}
          options={[
            ["all", "All"],
            ["fresh", "Last 7 days"],
            ["recent", "Last 30 days"],
            ["stale", "Dormant"],
            ["none", "Never"],
          ]}
          onChange={(v) => setActivity(v as ActivityFilter)}
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
                <th className="px-3 py-2 font-medium">Linked</th>
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
                  label="Last active"
                  active={sortKey === "last_active"}
                  onClick={() => setSortKey("last_active")}
                />
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const lastActive = mostRecent(
                  u.last_sign_in_at,
                  u.last_device_seen_at,
                );
                const age = now === null ? null : relativeAge(lastActive, now);
                const tone =
                  now === null
                    ? "text-zinc-500"
                    : STALENESS_TONE[staleness(lastActive, now)];
                return (
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
                    <td className="whitespace-nowrap px-3 py-2">
                      <PlatformTags platforms={u.linked_platforms ?? []} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 capitalize text-zinc-700">
                      {u.tier_id ?? "free"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {u.status ? (
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-xs font-medium " +
                            (STATUS_TONE[u.status] ??
                              "bg-zinc-100 text-zinc-600")
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
                    <td className={"whitespace-nowrap px-3 py-2 " + tone}>
                      {age ?? formatDate(lastActive)}
                    </td>
                  </tr>
                );
              })}
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
          onDeleted={(userId) => {
            setUsers((prev) => prev.filter((u) => u.user_id !== userId));
            setSelectedId(null);
          }}
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

// Which marketplaces the user has connected. The full username and a link to
// the shop live in the detail drawer; the roster only needs the presence
// signal, so this stays a single initial per platform.
function PlatformTags({ platforms }: { platforms: LinkedPlatform[] }) {
  if (platforms.length === 0) {
    return <span className="text-zinc-300">-</span>;
  }
  return (
    <span className="flex gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          title={p === "depop" ? "Depop" : "Vinted"}
          className={
            "rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase " +
            PLATFORM_TONE[p]
          }
        >
          {p === "depop" ? "D" : "V"}
        </span>
      ))}
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
