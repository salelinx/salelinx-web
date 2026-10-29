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

import { useEffect, useMemo, useState } from "react";
import type { TierConfig } from "@/lib/types/tiers";
import type { AdminDeletedAccount, AdminUserRow, LinkedPlatform } from "@/lib/types/admin";
import {
  mostRecent,
  relativeAge,
  staleness,
  STALENESS_TONE,
} from "@/lib/admin/relative-time";
import { useClientNow } from "@/lib/admin/use-client-now";
import { compareVersions, highestVersion } from "@/lib/admin/version";
import { TIER_ORDER } from "@/lib/admin/tiers";
import { browserName } from "@/lib/admin/browser";
import { platformLabel } from "@/lib/admin/platform-links";
import dynamic from "next/dynamic";
import { SOCIALS } from "@/components/home/SocialLinks";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { createBrowserClient } from "@/lib/supabase/client";
import { deletedEmailHash } from "@/lib/admin/deleted-email-hash";

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
  deletedAccounts: AdminDeletedAccount[];
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
// Every marketplace the extension supports, in the order the Linked filter and
// the roster badges show them. A missing entry here does NOT fail the type
// check (an array literal may be a subset of the union), so a new marketplace
// has to be added by hand. The adjacent PLATFORM_TONE record does fail in that
// case, which is the reminder.
const LINKED_PLATFORMS: LinkedPlatform[] = ["depop", "vinted", "ebay"];

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
SOURCE_ICONS["chatgpt.com"] = {
  name: "ChatGPT",
  color: "text-zinc-950",
  path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
};

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

// Keyed by browserName(); anything else falls back to its name.
const BROWSER_ICONS: Record<string, { path: string; color: string }> = {
  Chrome: {
    color: "text-[#4285F4]",
    path: "M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z",
  },
  Edge: {
    color: "text-[#0078D7]",
    path: "M21.86 17.86q.14 0 .25.12.1.13.1.25t-.11.33l-.32.46-.43.53-.44.5q-.21.25-.38.42l-.22.23q-.58.53-1.34 1.04-.76.51-1.6.91-.86.4-1.74.64t-1.67.24q-.9 0-1.69-.28-.8-.28-1.48-.78-.68-.5-1.22-1.17-.53-.66-.92-1.44-.38-.77-.58-1.6-.2-.83-.2-1.67 0-1 .32-1.96.33-.97.87-1.8.14.95.55 1.77.41.82 1.02 1.5.6.68 1.38 1.21.78.54 1.64.9.86.36 1.77.56.92.2 1.8.2 1.12 0 2.18-.24 1.06-.23 2.06-.72l.2-.1.2-.05zm-15.5-1.27q0 1.1.27 2.15.27 1.06.78 2.03.51.96 1.24 1.77.74.82 1.66 1.4-1.47-.2-2.8-.74-1.33-.55-2.48-1.37-1.15-.83-2.08-1.9-.92-1.07-1.58-2.33T.36 14.94Q0 13.54 0 12.06q0-.81.32-1.49.31-.68.83-1.23.53-.55 1.2-.96.66-.4 1.35-.66.74-.27 1.5-.39.78-.12 1.55-.12.7 0 1.42.1.72.12 1.4.35.68.23 1.32.57.63.35 1.16.83-.35 0-.7.07-.33.07-.65.23v-.02q-.63.28-1.2.74-.57.46-1.05 1.04-.48.58-.87 1.26-.38.67-.65 1.39-.27.71-.42 1.44-.15.72-.15 1.38zM11.96.06q1.7 0 3.33.39 1.63.38 3.07 1.15 1.43.77 2.62 1.93 1.18 1.16 1.98 2.7.49.94.76 1.96.28 1 .28 2.08 0 .89-.23 1.7-.24.8-.69 1.48-.45.68-1.1 1.22-.64.53-1.45.88-.54.24-1.11.36-.58.13-1.16.13-.42 0-.97-.03-.54-.03-1.1-.12-.55-.1-1.05-.28-.5-.19-.84-.5-.12-.09-.23-.24-.1-.16-.1-.33 0-.15.16-.35.16-.2.35-.5.2-.28.36-.68.16-.4.16-.95 0-1.06-.4-1.96-.4-.91-1.06-1.64-.66-.74-1.52-1.28-.86-.55-1.79-.89-.84-.3-1.72-.44-.87-.14-1.76-.14-1.55 0-3.06.45T.94 7.55q.71-1.74 1.81-3.13 1.1-1.38 2.52-2.35Q6.68 1.1 8.37.58q1.7-.52 3.58-.52Z",
  },
  Opera: {
    color: "text-[#FF1B2D]",
    path: "M8.051 5.238c-1.328 1.566-2.186 3.883-2.246 6.48v.564c.061 2.598.918 4.912 2.246 6.479 1.721 2.236 4.279 3.654 7.139 3.654 1.756 0 3.4-.537 4.807-1.471C17.879 22.846 15.074 24 12 24c-.192 0-.383-.004-.57-.014C5.064 23.689 0 18.436 0 12 0 5.371 5.373 0 12 0h.045c3.055.012 5.84 1.166 7.953 3.055-1.408-.93-3.051-1.471-4.81-1.471-2.858 0-5.417 1.42-7.14 3.654h.003zM24 12c0 3.556-1.545 6.748-4.002 8.945-3.078 1.5-5.946.451-6.896-.205 3.023-.664 5.307-4.32 5.307-8.74 0-4.422-2.283-8.075-5.307-8.74.949-.654 3.818-1.703 6.896-.205C22.455 5.25 24 8.445 24 12z",
  },
  Firefox: {
    color: "text-[#FF7139]",
    path: "M8.824 7.287c.008 0 .004 0 0 0zm-2.8-1.4c.006 0 .003 0 0 0zm16.754 2.161c-.505-1.215-1.53-2.528-2.333-2.943.654 1.283 1.033 2.57 1.177 3.53l.002.02c-1.314-3.278-3.544-4.6-5.366-7.477-.091-.147-.184-.292-.273-.446a3.545 3.545 0 01-.13-.24 2.118 2.118 0 01-.172-.46.03.03 0 00-.027-.03.038.038 0 00-.021 0l-.006.001a.037.037 0 00-.01.005L15.624 0c-2.585 1.515-3.657 4.168-3.932 5.856a6.197 6.197 0 00-2.305.587.297.297 0 00-.147.37c.057.162.24.24.396.17a5.622 5.622 0 012.008-.523l.067-.005a5.847 5.847 0 011.957.222l.095.03a5.816 5.816 0 01.616.228c.08.036.16.073.238.112l.107.055a5.835 5.835 0 01.368.211 5.953 5.953 0 012.034 2.104c-.62-.437-1.733-.868-2.803-.681 4.183 2.09 3.06 9.292-2.737 9.02a5.164 5.164 0 01-1.513-.292 4.42 4.42 0 01-.538-.232c-1.42-.735-2.593-2.121-2.74-3.806 0 0 .537-2 3.845-2 .357 0 1.38-.998 1.398-1.287-.005-.095-2.029-.9-2.817-1.677-.422-.416-.622-.616-.8-.767a3.47 3.47 0 00-.301-.227 5.388 5.388 0 01-.032-2.842c-1.195.544-2.124 1.403-2.8 2.163h-.006c-.46-.584-.428-2.51-.402-2.913-.006-.025-.343.176-.389.206-.406.29-.787.616-1.136.974-.397.403-.76.839-1.085 1.303a9.816 9.816 0 00-1.562 3.52c-.003.013-.11.487-.19 1.073-.013.09-.026.181-.037.272a7.8 7.8 0 00-.069.667l-.002.034-.023.387-.001.06C.386 18.795 5.593 24 12.016 24c5.752 0 10.527-4.176 11.463-9.661.02-.149.035-.298.052-.448.232-1.994-.025-4.09-.753-5.844z",
  },
};

const DEVICE_ICONS: Record<string, { label: string; path: string }> = {
  phone: { label: "Phone", path: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2" },
  tablet: { label: "Tablet", path: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2" },
  computer: { label: "Computer", path: "M3 4h18v12H3zM8 20h8M12 16v4" },
};

function DeviceCell({ device }: { device: string | null }) {
  const icon = device ? DEVICE_ICONS[device] : undefined;
  if (!icon) return <span className="text-zinc-400">-</span>;
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-zinc-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={icon.label}
    >
      <title>{icon.label}</title>
      <path d={icon.path} />
    </svg>
  );
}

function BrowserCell({ userAgent }: { userAgent: string | null }) {
  const name = browserName(userAgent);
  if (!name) return <span className="text-zinc-400">-</span>;
  const icon = BROWSER_ICONS[name];
  if (!icon) return <>{name}</>;
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 fill-current ${icon.color}`} aria-label={name}>
      <path d={icon.path} />
    </svg>
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

// Pro and Business match the extension's tier lock colours.
const TIER_TONE: Record<string, string> = {
  none: "bg-zinc-100 text-zinc-500",
  trial: "bg-sky-50 text-sky-700",
  starter: "bg-orange-50 text-orange-700",
  pro: "bg-blue-50 text-blue-700",
  business: "bg-violet-50 text-violet-700",
};

const PLATFORM_TONE: Record<LinkedPlatform, string> = {
  depop: "bg-rose-50 text-rose-700 border-rose-200",
  vinted: "bg-teal-50 text-teal-700 border-teal-200",
  ebay: "bg-blue-50 text-blue-700 border-blue-200",
};

export function AdminUserTable({ initialUsers, deletedAccounts, tiers }: Props) {
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
  const [browser, setBrowser] = useState<string>("all");
  const [device, setDevice] = useState<string>("all");
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
    (browser !== "all" ? 1 : 0) +
    (device !== "all" ? 1 : 0) +
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
    setBrowser("all");
    setDevice("all");
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

  const deviceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const d = u.signup_device ?? "unknown";
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [
      ["all", "All"],
      ...[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([d, n]) => [d, `${DEVICE_ICONS[d]?.label ?? "Unknown"} (${n})`] as [string, string]),
    ] as [string, string][];
  }, [users]);

  const browserOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const b = browserName(u.user_agent) ?? "Unknown";
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return [
      ["all", "All"],
      ...[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([b, n]) => [b, `${b} (${n})`] as [string, string]),
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
        } else if (platform === "multi") {
          // Everyone with at least two marketplaces connected. Worth its own
          // cut: these are the accounts crosslisting actually applies to (any
          // two of Depop, Vinted and eBay), and the single-platform options
          // are inclusive ("has Depop"), so none of them answers this.
          if (LINKED_PLATFORMS.filter((pf) => linked.includes(pf)).length < 2) return false;
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
      if (browser !== "all" && (browserName(u.user_agent) ?? "Unknown") !== browser) return false;
      if (device !== "all" && (u.signup_device ?? "unknown") !== device) return false;
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
  }, [users, search, tier, status, cancelling, platform, activity, source, country, browser, device, version, newestVersion, sortKey, now]);

  // Cap how many rows reach the DOM. Filtering/sorting above still runs over
  // the whole set, so this bounds rendering only (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

  const [termHash, setTermHash] = useState<string | null>(null);
  useEffect(() => {
    const term = search.trim();
    if (!term.includes("@")) return;
    let live = true;
    void deletedEmailHash(term).then((h) => {
      if (live) setTermHash(h);
    });
    return () => {
      live = false;
    };
  }, [search]);
  const emailHash = search.includes("@") ? termHash : null;

  // Shown under the Deleted status, or when a searched email matches one.
  const deletedVisible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (emailHash) return deletedAccounts.filter((d) => d.email_hash === emailHash);
    if (status !== "deleted") return [];
    return term ? deletedAccounts.filter((d) => d.user_id.includes(term)) : deletedAccounts;
  }, [deletedAccounts, emailHash, search, status]);

  const selected = selectedId
    ? (users.find((u) => u.user_id === selectedId) ?? null)
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          Users
          <span className="ml-2 font-normal text-zinc-400">
            {visible.length === users.length
              ? users.length
              : `${visible.length} / ${users.length}`}
          </span>
        </h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or user ID"
            className="min-w-40 flex-1 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400 sm:w-72 sm:flex-none"
          />
          <AdminRefreshButton onRefresh={refreshUsers} />
        </div>
      </header>

      {/* Eleven dropdowns wrap to half a phone screen, so below md they sit
          in one row that swipes sideways. */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-xs md:flex-wrap md:overflow-visible">
        {/* The table sorts from its column headers; the phone cards have
            none, so they get this instead. */}
        <div className="md:hidden">
          <FilterSelect
            label="Sort"
            value={sortKey}
            options={[
              ["created_at", "Newest"],
              ["last_active", "Last active"],
              ["tier_id", "Tier"],
              ["status", "Status"],
              ["email", "Email"],
            ]}
            onChange={(v) => setSortKey(v as SortKey)}
            highlight={false}
          />
        </div>
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
            ["deleted", "Deleted accounts"],
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
            ...LINKED_PLATFORMS.map((p): [string, string] => [p, platformLabel(p)]),
            ["multi", "Two or more"],
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
        <FilterSelect label="Browser" value={browser} options={browserOptions} onChange={setBrowser} />
        <FilterSelect label="Source" value={source} options={sourceOptions} onChange={setSource} />
        <FilterSelect label="Device" value={device} options={deviceOptions} onChange={setDevice} />
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
        {visible.length === 0 && deletedVisible.length === 0 ? (
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
          // Phones: one card per user with what you check on the go (plan,
          // billing, marketplaces, last active). The rest is in the drawer.
          <ul className="divide-y divide-[var(--admin-border)] md:hidden">
            {win.windowed.map((u) => {
              const active = lastActivity(u, now);
              return (
                <li key={u.user_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(u.user_id)}
                    className={
                      "block w-full px-4 py-3 text-left active:bg-zinc-100 " +
                      (selectedId === u.user_id ? "bg-zinc-100" : "")
                    }
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {u.email ? (
                        <span className="truncate text-sm text-zinc-800">
                          {u.email}
                        </span>
                      ) : (
                        <span className="truncate font-mono text-xs text-zinc-400">
                          {u.user_id}
                        </span>
                      )}
                      {u.is_admin && <AdminTag />}
                      <span
                        className={"ml-auto shrink-0 pl-2 text-xs " + active.tone}
                      >
                        {active.label}
                      </span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {/* Unlike the table, no "-" placeholders: there is no
                          column for a blank to hold open. */}
                      <TierBadge tierId={u.tier_id} />
                      {u.status && (
                        <>
                          <StatusBadge status={u.status} />
                          <BillingCell
                            cancelAtPeriodEnd={u.cancel_at_period_end}
                            status={u.status}
                            periodEnd={u.current_period_end}
                            now={now}
                          />
                        </>
                      )}
                      {(u.linked_platforms ?? []).length > 0 && (
                        <PlatformTags platforms={u.linked_platforms} />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {visible.length > 0 && (
          <table className="hidden w-full border-collapse text-sm md:table">
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
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Browser</th>
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
                const active = lastActivity(u, now);
                return (
                  <tr
                    key={u.user_id}
                    onClick={() => setSelectedId(u.user_id)}
                    className={
                      "cursor-pointer border-b border-[var(--admin-border)] hover:bg-zinc-50 " +
                      (selectedId === u.user_id ? "bg-zinc-100" : "")
                    }
                  >
                    <td className="px-3 py-2">
                      <div className="flex max-w-[14rem] items-center gap-1.5">
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
                    <td className="whitespace-nowrap px-3 py-2">
                      <TierBadge tierId={u.tier_id} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {u.status ? (
                        <StatusBadge status={u.status} />
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
                    <td className="whitespace-nowrap px-3 py-2">
                      <DeviceCell device={u.signup_device} />
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
                    <td
                      className="whitespace-nowrap px-3 py-2 text-zinc-700"
                      title={u.user_agent ?? undefined}
                    >
                      <BrowserCell userAgent={u.user_agent} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {formatDate(u.created_at)}
                    </td>
                    <td className={"whitespace-nowrap px-3 py-2 " + active.tone}>
                      {active.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {deletedVisible.length > 0 && (
          <DeletedAccounts
            rows={deletedVisible}
            email={emailHash ? search.trim() : null}
          />
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

// Last active is the more recent of sign-in and device heartbeat (see
// docs/ADMIN.md "User observability"), as a relative age tinted by staleness.
// Falls back to the date until useClientNow has a clock.
function lastActivity(
  u: AdminUserRow,
  now: number | null,
): { label: string; tone: string } {
  const lastActive = mostRecent(u.last_sign_in_at, u.last_device_seen_at);
  const age = now === null ? null : relativeAge(lastActive, now);
  const tone =
    now === null ? "text-zinc-500" : STALENESS_TONE[staleness(lastActive, now)];
  return { label: age ?? formatDate(lastActive), tone };
}

function DeletedAccounts({
  rows,
  email,
}: {
  rows: AdminDeletedAccount[];
  email: string | null;
}) {
  return (
    <section className="border-t border-[var(--admin-border)]">
      <h2 className="px-4 pb-1 pt-4 text-xs font-medium text-zinc-500">
        Deleted accounts ({rows.length})
      </h2>
      <ul className="divide-y divide-[var(--admin-border)]">
        {rows.map((d) => (
          <li
            key={d.user_id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm text-zinc-500"
          >
            <span className="min-w-0 max-w-[16rem] truncate">
              {email ?? (
                <span className="font-mono text-xs text-zinc-400">{d.user_id}</span>
              )}
            </span>
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Deleted {formatDate(d.deleted_at)}
            </span>
            <span className="text-xs">{d.deleted_by_admin ? "by an admin" : "by the user"}</span>
            {d.tier_id && <TierBadge tierId={d.tier_id} />}
            {d.status && <StatusBadge status={d.status} />}
            <span className="text-xs">Joined {formatDate(d.signed_up_at)}</span>
            {d.signup_source && (
              <span className="text-xs">
                <SourceCell source={d.signup_source} />
              </span>
            )}
            {d.country && (
              <span className="text-base" title={d.country}>
                {flag(d.country)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TierBadge({ tierId }: { tierId: string | null }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
        (TIER_TONE[tierId ?? "none"] ?? "bg-zinc-100 text-zinc-700")
      }
    >
      {tierId ?? "none"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium " +
        (STATUS_TONE[status] ?? "bg-zinc-100 text-zinc-600")
      }
    >
      {status}
    </span>
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
      {LINKED_PLATFORMS.filter((p) => platforms.includes(p)).map((p) => (
        <span
          key={p}
          title={platformLabel(p)}
          className={
            "rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase " +
            PLATFORM_TONE[p]
          }
        >
          {platformLabel(p)[0]}
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
  highlight,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  // Dark when the control is narrowing the list. Defaults to "not on All";
  // the sort control passes false, since a sort never hides anyone.
  highlight?: boolean;
}) {
  const set = highlight ?? value !== "all";
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
        className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-700"
        title="Newest reported version"
      >
        {version}
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
