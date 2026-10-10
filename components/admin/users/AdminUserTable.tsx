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
import { compareVersions, highestVersion } from "@/lib/admin/version";
import { TIER_ORDER } from "@/lib/admin/tiers";
import dynamic from "next/dynamic";
import { SOCIALS } from "@/components/home/SocialLinks";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { createBrowserClient } from "@/lib/supabase/client";

// The detail drawer is ~1k lines (subscription editing, Stripe plan change,
// account deletion, devices, listings) and only ever renders after a row click,
// but a static import bundles it into the roster's own chunk, so every visit
// downloaded and parsed it. Loading it on demand keeps the roster's first paint
// to the table itself. ssr:false is correct here: the drawer is behind client
// state (`selected`) and never part of the server-rendered markup.
const AdminUserDetail = dynamic(
  () => import("./AdminUserDetail").then((m) => m.AdminUserDetail),
  { ssr: false },
);

type Props = {
  initialUsers: AdminUserRow[];
  tiers: TierConfig[];
};

type SortKey = "created_at" | "last_active" | "email" | "tier_id" | "status";

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

// Statuses that mean "entitled right now". past_due is deliberately excluded:
// it can still be entitled, but only inside the bounded grace window (paid at
// least once AND under 7 days past due, migration 020). It is a billing
// problem rather than a healthy customer, and folding it in would hide that.
// Every marketplace the extension supports, for the "Both" cut on the Linked
// filter. A missing entry here does NOT fail the type check (an array literal
// may be a subset of the union), so if a third marketplace is ever added this
// list has to be updated by hand, and "Both" renamed to "All". The adjacent
// PLATFORM_TONE record does fail in that case, which is the reminder.
const LINKED_PLATFORMS: LinkedPlatform[] = ["depop", "vinted"];

const ENTITLED_STATUSES = ["active", "trialing"];

const socialPath = (name: string) => SOCIALS.find((s) => s.name === name)!.path;

// Brand marks for signup sources; anything else falls back to its label.
const SOURCE_ICONS: Record<string, { path: string; color: string; name: string }> = {
  google: {
    name: "Google",
    color: "text-[#4285F4]",
    path: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  },
  facebook: {
    name: "Facebook",
    color: "text-[#0866FF]",
    path: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  },
  x: {
    name: "X",
    color: "text-zinc-950",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  tiktok: { name: "TikTok", color: "text-zinc-950", path: socialPath("TikTok") },
  youtube: { name: "YouTube", color: "text-[#FF0000]", path: socialPath("YouTube") },
  instagram: { name: "Instagram", color: "text-[#FF0069]", path: socialPath("Instagram") },
};
SOURCE_ICONS.meta = { ...SOURCE_ICONS.facebook, name: "Meta" };

// "google_ads" -> the Google mark plus "Ads"; utm values are free text, so
// unknown ones are just tidied up.
function sourceParts(source: string) {
  const ads = source.endsWith("_ads");
  const icon = SOURCE_ICONS[ads ? source.slice(0, -4) : source];
  return { icon, ads };
}

function sourceLabel(source: string) {
  const { icon, ads } = sourceParts(source);
  if (icon) return ads ? `${icon.name} Ads` : icon.name;
  const words = source.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function SourceCell({ source }: { source: string }) {
  const { icon, ads } = sourceParts(source);
  if (!icon) return <>{sourceLabel(source)}</>;
  return (
    <span className="inline-flex items-center gap-1.5" title={sourceLabel(source)}>
      <svg viewBox="0 0 24 24" className={`h-4 w-4 fill-current ${icon.color}`} aria-label={icon.name}>
        <path d={icon.path} />
      </svg>
      {ads && <span className="text-xs text-zinc-500">Ads</span>}
    </span>
  );
}

// ISO 3166-1 alpha-2 code to its regional-indicator flag.
const flag = (code: string) =>
  String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));

// Sort order for the Status column: who is using it, then who is about to stop
// paying, then the rest. Anything unrecognised sorts last.
const STATUS_SORT_ORDER = [
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "canceled",
  "none",
];

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
  // "leaving" is the one that earns its place: paying now, gone at period end,
  // and still reachable. Filtering to it is the whole point of the column.
  const [cancelling, setCancelling] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [source, setSource] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [version, setVersion] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");

  // With nine filter groups it is easy to end up on an empty table and not
  // spot which control is responsible, so offer a single way back. Search is
  // included: it is the most common reason a roster looks empty.
  const activeFilters =
    (tier !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (cancelling !== "all" ? 1 : 0) +
    (platform !== "all" ? 1 : 0) +
    (activity !== "all" ? 1 : 0) +
    (source !== "all" ? 1 : 0) +
    (country !== "all" ? 1 : 0) +
    (version !== "all" ? 1 : 0) +
    (search.trim() ? 1 : 0);

  function clearFilters() {
    setTier("all");
    setStatus("all");
    setCancelling("all");
    setPlatform("all");
    setActivity("all");
    setSource("all");
    setCountry("all");
    setVersion("all");
    setSearch("");
  }

  const supabase = createBrowserClient();

  // The roster is snapshotted into state so the detail drawer can apply its
  // subscription edits and deletions without a refetch. That also means a
  // server re-render alone would leave this list stale, so Refresh re-runs the
  // same is_admin()-gated RPC the page used and replaces the snapshot.
  async function refreshUsers() {
    const { data } = await supabase.rpc("admin_list_users");
    // Leave the current roster in place on a failed call rather than blanking
    // the table; the admin can hit Refresh again.
    if (data) setUsers(data as AdminUserRow[]);
  }

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Null on the server and through hydration, a ticking timestamp afterwards,
  // so relative ages cannot cause a mismatch. See lib/admin/use-client-now.ts.
  const now = useClientNow();

  // "any" and "none" are the two cuts that were missing: the filter logic
  // below has always understood a tier of "none" (never subscribed), but the
  // options were built only from tier ids that exist on a row, so there was no
  // way to select it - and no way to say "anyone with a tier" either.
  //
  // Real tiers are listed in the canonical order from lib/admin/tiers.ts
  // (trial, starter, pro, business) rather than alphabetically, so the buttons
  // read as a ladder. Custom tier ids sort after them.
  const tierOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) if (u.tier_id) set.add(u.tier_id);
    const known = TIER_ORDER.filter((t) => set.has(t));
    const custom = Array.from(set)
      .filter((t) => !TIER_ORDER.includes(t))
      .sort();
    return [
      ["all", "All"],
      ["any", "Any tier"],
      ...[...known, ...custom].map((t) => [t, t] as [string, string]),
      ["none", "No tier"],
    ] as [string, string][];
  }, [users]);

  // Counts in the labels make this filter double as the "where did users come from" breakdown.
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const s = u.signup_source ?? "unknown";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [
      ["all", "All"],
      ...[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => [s, `${sourceLabel(s)} (${n})`] as [string, string]),
    ] as [string, string][];
  }, [users]);

  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const c = u.country ?? "unknown";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [
      ["all", "All"],
      ...[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => [c, `${c === "unknown" ? "Unknown" : `${flag(c)} ${c}`} (${n})`] as [string, string]),
    ] as [string, string][];
  }, [users]);

  // Newest version anyone has reported, used only to tint rows behind it. Read
  // from the whole roster rather than the filtered view so the ceiling does not
  // move when a filter is applied and half the users stop looking outdated.
  const newestVersion = useMemo(
    () => highestVersion(users.map((u) => u.extension_version)),
    [users],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      const effectiveTier = u.tier_id ?? "none";
      if (tier === "any") {
        if (effectiveTier === "none") return false;
      } else if (tier !== "all" && effectiveTier !== tier) {
        return false;
      }
      if (cancelling === "leaving" && !u.cancel_at_period_end) return false;
      if (cancelling === "gone" && u.status !== "canceled") return false;
      if (
        cancelling === "staying" &&
        (u.cancel_at_period_end || u.status === "canceled")
      ) {
        return false;
      }

      if (status !== "all") {
        const effectiveStatus = u.status ?? "none";
        if (status === "using") {
          // Entitled right now, paid or on trial. The everyday "who is
          // actually a customer" cut, which previously meant clicking Active
          // and Trialing separately and comparing two counts.
          if (!ENTITLED_STATUSES.includes(effectiveStatus)) return false;
        } else if (effectiveStatus !== status) {
          return false;
        }
      }
      if (platform !== "all") {
        const linked = u.linked_platforms ?? [];
        if (platform === "none") {
          if (linked.length > 0) return false;
        } else if (platform === "any") {
          if (linked.length === 0) return false;
        } else if (platform === "both") {
          // Everyone who has connected every marketplace we support. Worth its
          // own cut: these are the accounts crosslisting actually applies to,
          // and the single-platform options are inclusive ("has Depop"), so
          // neither of them answers this.
          if (!LINKED_PLATFORMS.every((pf) => linked.includes(pf))) return false;
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
      if (source !== "all" && (u.signup_source ?? "unknown") !== source) return false;
      if (country !== "all" && (u.country ?? "unknown") !== country) return false;
      if (version !== "all") {
        const v = u.extension_version;
        if (version === "none" ? v !== null : v === null) return false;
        if (version !== "none" && newestVersion !== null) {
          const behind = compareVersions(v!, newestVersion) < 0;
          if (behind !== (version === "outdated")) return false;
        }
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
        case "tier_id": {
          // Alphabetical order put business first and trial last, the reverse
          // of the ladder. Rank by TIER_ORDER instead, highest tier first,
          // with no-tier accounts at the bottom.
          const rank = (t: string | null) =>
            t === null ? -1 : TIER_ORDER.length - TIER_ORDER.indexOf(t);
          const d = rank(b.tier_id) - rank(a.tier_id);
          return d !== 0 ? d : (a.email ?? "").localeCompare(b.email ?? "");
        }
        case "status": {
          // Entitled accounts first, then the billing problems, then the rest,
          // so the top of the list is who is actually using the product.
          const rank = (st: string | null) => {
            const i = STATUS_SORT_ORDER.indexOf(st ?? "none");
            return i === -1 ? STATUS_SORT_ORDER.length : i;
          };
          const d = rank(a.status) - rank(b.status);
          return d !== 0 ? d : (a.email ?? "").localeCompare(b.email ?? "");
        }
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
  }, [users, search, tier, status, cancelling, platform, activity, source, country, version, newestVersion, sortKey, now]);

  // Cap how many rows reach the DOM. Filtering/sorting above still runs over
  // the whole set, so this bounds rendering only (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

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
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or user ID"
            className="w-72 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
          />
          <AdminRefreshButton onRefresh={refreshUsers} />
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-xs">
        <FilterSelect
          label="Status"
          value={status}
          options={[
            ["all", "All"],
            ["using", "Active or trialing"],
            ["active", "Active"],
            ["trialing", "Trialing"],
            ["past_due", "Past due"],
            ["canceled", "Canceled"],
            ["incomplete", "Incomplete"],
            ["none", "No subscription"],
          ]}
          onChange={setStatus}
        />
        <FilterSelect label="Tier" value={tier} options={tierOptions} onChange={setTier} />
        <FilterSelect
          label="Cancellation"
          value={cancelling}
          options={[
            ["all", "All"],
            ["leaving", "Ends at period end"],
            ["gone", "Already canceled"],
            ["staying", "Renewing"],
          ]}
          onChange={setCancelling}
        />
        <FilterSelect
          label="Last active"
          value={activity}
          options={[
            ["all", "Any time"],
            ["fresh", "Last 7 days"],
            ["recent", "Last 30 days"],
            ["stale", "Over 30 days ago"],
            ["none", "Never"],
          ]}
          onChange={(v) => setActivity(v as ActivityFilter)}
        />
        <FilterSelect
          label="Linked"
          value={platform}
          options={[
            ["all", "All"],
            ["any", "Any marketplace"],
            ["depop", "Depop"],
            ["vinted", "Vinted"],
            ["both", "Depop and Vinted"],
            ["none", "Nothing linked"],
          ]}
          onChange={setPlatform}
        />
        <FilterSelect
          label="Version"
          value={version}
          options={[
            ["all", "All"],
            ["latest", "Up to date"],
            ["outdated", "Outdated"],
            ["none", "Never reported"],
          ]}
          onChange={setVersion}
        />
        <FilterSelect label="Country" value={country} options={countryOptions} onChange={setCountry} />
        <FilterSelect label="Source" value={source} options={sourceOptions} onChange={setSource} />
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No users match these filters.{" "}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="underline underline-offset-2 hover:text-zinc-800"
              >
                Clear them
              </button>
            )}
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
                <SortableTh
                  label="Status"
                  active={sortKey === "status"}
                  onClick={() => setSortKey("status")}
                />
                <th className="px-3 py-2 font-medium">Billing</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Country</th>
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
              {win.windowed.map((u) => {
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
                      {u.tier_id ?? "none"}
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
                    <td className="whitespace-nowrap px-3 py-2">
                      <BillingCell
                        cancelAtPeriodEnd={u.cancel_at_period_end}
                        status={u.status}
                        periodEnd={u.current_period_end}
                        now={now}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <VersionCell
                        version={u.extension_version}
                        newest={newestVersion}
                      />
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2 text-zinc-700"
                      title={u.signup_campaign ?? undefined}
                    >
                      {u.signup_source ? (
                        <SourceCell source={u.signup_source} />
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2 text-base"
                      title={u.country ?? undefined}
                    >
                      {u.country ? (
                        flag(u.country)
                      ) : (
                        <span className="text-sm text-zinc-400">-</span>
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
      <AdminTableFooter
        shown={win.shown}
        total={win.total}
        hasMore={win.hasMore}
        onShowMore={win.showMore}
        onShowAll={win.showAll}
        noun="users"
      />

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
function BillingCell({
  cancelAtPeriodEnd,
  status,
  periodEnd,
  now,
}: {
  cancelAtPeriodEnd: boolean;
  status: string | null;
  periodEnd: string | null;
  /** From useClientNow in the parent: reading the clock during render is both
   *  impure and a hydration mismatch waiting to happen. Null until hydration,
   *  which is why the countdown degrades to a bare label. */
  now: number | null;
}) {
  if (status === "canceled") {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
        Gone
      </span>
    );
  }

  if (status === "past_due") {
    return (
      <span
        className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
        title="The last payment failed; Stripe is retrying the card"
      >
        Retrying payment
      </span>
    );
  }

  const label = cancelAtPeriodEnd
    ? "Leaving"
    : status === "trialing"
      ? "First payment"
      : status === "active"
        ? "Payment"
        : null;
  if (!label) return <span className="text-zinc-400">-</span>;

  const days =
    periodEnd === null || now === null
      ? null
      : Math.ceil((new Date(periodEnd).getTime() - now) / (24 * 60 * 60 * 1000));
  const tone = cancelAtPeriodEnd
    ? "bg-amber-50 text-amber-700"
    : "bg-emerald-50 text-emerald-700";
  const verb = cancelAtPeriodEnd ? "Access ends" : "Due";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title={periodEnd ? `${verb} ${formatDate(periodEnd)}` : undefined}
    >
      {days === null
        ? label
        : days <= 0
          ? `${label} today`
          : `${label} in ${days}d`}
    </span>
  );
}

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

function FilterSelect({
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
  const set = value !== "all";
  return (
    <label
      className={
        "relative flex cursor-pointer items-center gap-1.5 rounded-md border py-1 pl-2.5 pr-6 " +
        (set
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-[var(--admin-border)] bg-white text-zinc-800 hover:border-zinc-400")
      }
    >
      <span className={set ? "text-zinc-400" : "text-zinc-500"}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent font-medium outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="text-zinc-900">
            {l}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2 h-2.5 w-2.5 opacity-60"
      >
        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </label>
  );
}

// Extension version of the user's freshest install. Amber means they are behind
// the newest version anyone has reported, which is the roster's whole purpose:
// spotting who is still running a build a bug was already fixed in.
//
// "-" covers two different things that look the same here: an install that has
// never checked in at all, and one on a build older than migration
// 015_device_session_version.sql (which reports no version). Both resolve
// themselves once the user updates.
function VersionCell({
  version,
  newest,
}: {
  version: string | null;
  newest: string | null;
}) {
  if (!version) return <span className="text-zinc-400">-</span>;
  const outdated = newest !== null && compareVersions(version, newest) < 0;
  if (!outdated) {
    return (
      <span
        className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700"
        title={version}
      >
        Latest
      </span>
    );
  }
  return (
    <span
      className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-xs text-amber-700"
      title={`Behind the newest reported version (${newest})`}
    >
      {version}
    </span>
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
