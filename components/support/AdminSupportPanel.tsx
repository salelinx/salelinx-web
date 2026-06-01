"use client";

// Admin support panel - the web home of what used to be the extension's admin
// section. Every mutation here is gated by RLS (public.is_admin()); the parent
// page's isAdmin() check only decides whether this component renders at all.

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
import type {
  SupportTicket,
  SupportReply,
  TicketType,
} from "@/lib/types/support";

type Props = {
  adminId: string;
  initialTickets: SupportTicket[];
  initialReplies: SupportReply[];
};

type StatusFilter = "open" | "closed" | "all";

export function AdminSupportPanel({
  adminId,
  initialTickets,
  initialReplies,
}: Props) {
  const t = useTranslations("Support");
  const supabase = createBrowserClient();

  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [replies, setReplies] = useState<SupportReply[]>(initialReplies);
  const [filter, setFilter] = useState<StatusFilter>("open");

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
    if (filter === "all") return tickets;
    return tickets.filter((tk) =>
      filter === "closed" ? tk.status === "closed" : tk.status !== "closed",
    );
  }, [tickets, filter]);

  return (
    <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-50/40 p-6 dark:border-amber-400/20 dark:bg-amber-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("adminTitle")}</h2>
        <div className="flex gap-1">
          {(["open", "closed", "all"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                  : "rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/20"
              }
            >
              {t(`adminFilter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("adminEmpty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {visible.map((ticket) => (
            <AdminTicketCard
              key={ticket.id}
              ticket={ticket}
              replies={replies.filter((r) => r.ticket_id === ticket.id)}
              adminId={adminId}
              onChanged={refreshAll}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminTicketCard({
  ticket,
  replies,
  adminId,
  onChanged,
}: {
  ticket: SupportTicket;
  replies: SupportReply[];
  adminId: string;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("Support");
  const locale = useLocale();
  const supabase = createBrowserClient();

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = ticket.status !== "closed";

  const typeLabel = (() => {
    try {
      return t(`type_${ticket.type as TicketType}`);
    } catch {
      return ticket.type;
    }
  })();

  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  async function reply() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const { error: insErr } = await supabase
      .from("support_ticket_replies")
      .insert({
        ticket_id: ticket.id,
        user_id: adminId,
        body: text,
        is_admin: true,
      });
    setBusy(false);
    if (insErr) {
      setError(t("adminActionError"));
      return;
    }
    setBody("");
    await onChanged();
  }

  async function setStatus(status: "open" | "closed") {
    setBusy(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", ticket.id);
    setBusy(false);
    if (updErr) {
      setError(t("adminActionError"));
      return;
    }
    await onChanged();
  }

  async function remove() {
    if (!confirm(t("adminDeleteConfirm"))) return;
    setBusy(true);
    setError(null);
    const { error: delErr } = await supabase
      .from("support_tickets")
      .delete()
      .eq("id", ticket.id);
    setBusy(false);
    if (delErr) {
      setError(t("adminActionError"));
      return;
    }
    await onChanged();
  }

  return (
    <li className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-black/10 px-2.5 py-0.5 text-xs font-medium dark:border-white/20">
          {typeLabel}
        </span>
        <span
          className={
            isOpen
              ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }
        >
          {isOpen ? t("statusOpen") : t("statusClosed")}
        </span>
        {ticket.source && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {ticket.source}
          </span>
        )}
        <span className="text-xs text-zinc-500">
          {formatWhen(ticket.created_at)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
        {ticket.message}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
        <div className="flex gap-1">
          <dt>{t("adminFromUser")}:</dt>
          <dd className="font-mono break-all">{ticket.user_id}</dd>
        </div>
        {ticket.platform && (
          <div className="flex gap-1">
            <dt>{t("adminPlatform")}:</dt>
            <dd>{ticket.platform}</dd>
          </div>
        )}
        {ticket.tier_id && (
          <div className="flex gap-1">
            <dt>{t("adminTier")}:</dt>
            <dd>{ticket.tier_id}</dd>
          </div>
        )}
        {ticket.app_version && (
          <div className="flex gap-1">
            <dt>{t("adminVersion")}:</dt>
            <dd>{ticket.app_version}</dd>
          </div>
        )}
      </dl>

      {replies.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          {replies.map((r) => (
            <div key={r.id}>
              <div className="text-xs font-medium text-zinc-500">
                {r.is_admin ? t("authorSupport") : t("authorUser")} ·{" "}
                {formatWhen(r.created_at)}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          rows={2}
          placeholder={t("adminReplyPlaceholder")}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reply}
            disabled={busy || !body.trim()}
            className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {t("adminReplySend")}
          </button>
          <button
            type="button"
            onClick={() => setStatus(isOpen ? "closed" : "open")}
            disabled={busy}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-medium disabled:opacity-60 dark:border-white/20"
          >
            {isOpen ? t("adminClose") : t("adminReopen")}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-full border border-red-300 px-4 py-2 text-xs font-medium text-red-600 disabled:opacity-60 dark:border-red-500/40"
          >
            {t("adminDelete")}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </li>
  );
}
