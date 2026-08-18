"use client";

// Dense support-ticket table for the admin console. Reuses the data + mutation
// model of the old components/support/AdminSupportPanel.tsx but redesigned as a
// scannable table + detail drawer, de-i18n'd (English-only internal tool), and
// wired to the audit log + step-up reauth on destructive actions.
//
// Every mutation is gated by Postgres RLS via public.is_admin(); the admin
// layout/middleware gate only decides whether this renders at all.

import { useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { SupportTicket, SupportReply } from "@/lib/types/support";
import { ticketNeedsReply } from "@/lib/admin/needs-reply";
import dynamic from "next/dynamic";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";

// Same reasoning as the users roster: the ticket drawer (reply box, status
// controls, delete + reauth) only renders after a row click, so it is loaded on
// demand instead of riding along in the table's chunk.
const AdminTicketDetail = dynamic(
  () => import("./AdminTicketDetail").then((m) => m.AdminTicketDetail),
  { ssr: false },
);

type Props = {
  adminId: string;
  initialTickets: SupportTicket[];
  initialReplies: SupportReply[];
  emails: Record<string, string>;
};

type StatusFilter = "open" | "closed" | "all";
type TypeFilter = "all" | "bug" | "feature" | "feedback" | "other";
type SourceFilter = "all" | "web" | "extension" | "email";
type SortKey = "updated_at" | "created_at" | "status" | "type";

const TYPE_LABEL: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  feedback: "Feedback",
  other: "Other",
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date().getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminTicketTable({
  adminId,
  initialTickets,
  initialReplies,
  emails,
}: Props) {
  const supabase = createBrowserClient();

  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [replies, setReplies] = useState<SupportReply[]>(initialReplies);

  const [status, setStatus] = useState<StatusFilter>("open");
  const [type, setType] = useState<TypeFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [needsReplyOnly, setNeedsReplyOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ticket id -> whether it awaits a staff reply (computed from the reply set).
  const needsReplyById = useMemo(() => {
    const byTicket = new Map<string, SupportReply[]>();
    for (const r of replies) {
      const arr = byTicket.get(r.ticket_id);
      if (arr) arr.push(r);
      else byTicket.set(r.ticket_id, [r]);
    }
    const map: Record<string, boolean> = {};
    for (const tk of tickets) {
      map[tk.id] = ticketNeedsReply(tk, byTicket.get(tk.id) ?? []);
    }
    return map;
  }, [tickets, replies]);

  const needsReplyCount = useMemo(
    () => Object.values(needsReplyById).filter(Boolean).length,
    [needsReplyById],
  );

  async function refreshAll() {
    const { data: ts } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
    const nextTickets = (ts as SupportTicket[] | null) ?? [];
    setTickets(nextTickets);

    const ids = nextTickets.map((tk) => tk.id);
    if (ids.length === 0) {
      setReplies([]);
      return;
    }
    const { data: rs } = await supabase
      .from("support_ticket_replies")
      .select("*")
      .in("ticket_id", ids)
      .order("created_at", { ascending: true });
    setReplies((rs as SupportReply[] | null) ?? []);
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = tickets.filter((tk) => {
      if (status !== "all") {
        const isClosed = tk.status === "closed";
        if (status === "closed" && !isClosed) return false;
        if (status === "open" && isClosed) return false;
      }
      if (type !== "all" && tk.type !== type) return false;
      if (source !== "all" && tk.source !== source) return false;
      if (needsReplyOnly && !needsReplyById[tk.id]) return false;
      if (term) {
        const email = (emails[tk.user_id] ?? "").toLowerCase();
        const haystack = `${tk.message} ${email} ${tk.user_id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "created_at":
          return b.created_at.localeCompare(a.created_at);
        case "status":
          return a.status.localeCompare(b.status);
        case "type":
          return a.type.localeCompare(b.type);
        case "updated_at":
        default:
          return b.updated_at.localeCompare(a.updated_at);
      }
    });
    return sorted;
  }, [
    tickets,
    emails,
    status,
    type,
    source,
    needsReplyOnly,
    needsReplyById,
    search,
    sortKey,
  ]);

  // Cap how many rows reach the DOM. Filtering/sorting above still runs over
  // the whole set, so this bounds rendering only (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

  const selected = selectedId
    ? (tickets.find((tk) => tk.id === selectedId) ?? null)
    : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">Support tickets</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search message, email, or user ID"
          className="w-72 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs outline-none focus:border-zinc-400"
        />
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs">
        <FilterGroup
          label="Status"
          value={status}
          options={[
            ["open", "Open"],
            ["closed", "Closed"],
            ["all", "All"],
          ]}
          onChange={(v) => setStatus(v as StatusFilter)}
        />
        <FilterGroup
          label="Type"
          value={type}
          options={[
            ["all", "All"],
            ["bug", "Bug"],
            ["feature", "Feature"],
            ["feedback", "Feedback"],
            ["other", "Other"],
          ]}
          onChange={(v) => setType(v as TypeFilter)}
        />
        <FilterGroup
          label="Source"
          value={source}
          options={[
            ["all", "All"],
            ["web", "Web"],
            ["extension", "Extension"],
            ["email", "Email"],
          ]}
          onChange={(v) => setSource(v as SourceFilter)}
        />
        <button
          type="button"
          onClick={() => setNeedsReplyOnly((v) => !v)}
          className={
            needsReplyOnly
              ? "inline-flex items-center gap-1.5 rounded bg-amber-500 px-2 py-0.5 font-medium text-white"
              : "inline-flex items-center gap-1.5 rounded border border-amber-300 px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-50"
          }
        >
          Needs reply
          <span
            className={
              needsReplyOnly
                ? "rounded-full bg-white/25 px-1.5 text-[10px]"
                : "rounded-full bg-amber-100 px-1.5 text-[10px]"
            }
          >
            {needsReplyCount}
          </span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No tickets match these filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <SortableTh
                  label="Status"
                  active={sortKey === "status"}
                  onClick={() => setSortKey("status")}
                />
                <SortableTh
                  label="Type"
                  active={sortKey === "type"}
                  onClick={() => setSortKey("type")}
                />
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <SortableTh
                  label="Updated"
                  active={sortKey === "updated_at"}
                  onClick={() => setSortKey("updated_at")}
                />
              </tr>
            </thead>
            <tbody>
              {win.windowed.map((tk) => {
                const isClosed = tk.status === "closed";
                const from = emails[tk.user_id];
                return (
                  <tr
                    key={tk.id}
                    onClick={() => setSelectedId(tk.id)}
                    className={
                      "cursor-pointer border-b border-[var(--admin-border)] hover:bg-zinc-50 " +
                      (selectedId === tk.id ? "bg-zinc-100" : "")
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge closed={isClosed} />
                        {needsReplyById[tk.id] && (
                          <span
                            title="Awaiting your reply"
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Needs reply
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {typeLabel(tk.type)}
                    </td>
                    <td className="max-w-md truncate px-3 py-2 text-zinc-800">
                      {tk.message}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2">
                      {from ? (
                        <span className="text-zinc-700">{from}</span>
                      ) : (
                        <span className="font-mono text-xs text-zinc-400">
                          {tk.user_id}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {tk.source ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {tk.tier_id ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-500">
                      {tk.app_version ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {formatRelative(tk.updated_at)}
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
        noun="tickets"
      />

      {selected && (
        <AdminTicketDetail
          ticket={selected}
          replies={replies.filter((r) => r.ticket_id === selected.id)}
          emails={emails}
          adminId={adminId}
          onClose={() => setSelectedId(null)}
          onChanged={refreshAll}
        />
      )}
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
      <div className="flex gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={
              value === v
                ? "rounded bg-zinc-900 px-2 py-0.5 font-medium text-white"
                : "rounded px-2 py-0.5 text-zinc-600 hover:bg-zinc-100"
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

function StatusBadge({ closed }: { closed: boolean }) {
  return closed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Closed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Open
    </span>
  );
}
