"use client";

// The user's ticket history: their tickets + per-ticket thread and in-thread
// reply box. Extracted from the former SupportClient so it can stand alone on
// /account/tickets (the track surface), with ticket creation moved to the
// /help/support contact form. List/reply logic + RLS are unchanged.

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
import type {
  SupportTicket,
  SupportReply,
  TicketType,
} from "@/lib/types/support";

type Props = {
  userId: string;
  initialTickets: SupportTicket[];
  initialReplies: SupportReply[];
};

export function TicketList({ userId, initialTickets, initialReplies }: Props) {
  const t = useTranslations("Support");
  const supabase = createBrowserClient();

  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [replies, setReplies] = useState<SupportReply[]>(initialReplies);
  const [showClosed, setShowClosed] = useState(false);

  const closedCount = useMemo(
    () => tickets.filter((tk) => tk.status === "closed").length,
    [tickets],
  );
  const visible = useMemo(
    () => (showClosed ? tickets : tickets.filter((tk) => tk.status !== "closed")),
    [tickets, showClosed],
  );

  async function refreshMine() {
    const { data: ts } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
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

  return (
    <section className="mt-6 rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("myTicketsTitle")}</h2>
        {closedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            className="text-sm text-zinc-600 underline-offset-4 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            {showClosed
              ? t("hideClosed")
              : t("showClosed", { count: closedCount })}
          </button>
        )}
      </div>

      {tickets.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("noTickets")}
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("noOpenTickets")}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {visible.map((ticket) => (
            <UserTicketCard
              key={ticket.id}
              ticket={ticket}
              replies={replies.filter((r) => r.ticket_id === ticket.id)}
              userId={userId}
              onReplied={refreshMine}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function UserTicketCard({
  ticket,
  replies,
  userId,
  onReplied,
}: {
  ticket: SupportTicket;
  replies: SupportReply[];
  userId: string;
  onReplied: () => Promise<void>;
}) {
  const t = useTranslations("Support");
  const locale = useLocale();
  const supabase = createBrowserClient();

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
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

  async function sendReply() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);

    const { error: insErr } = await supabase
      .from("support_ticket_replies")
      .insert({
        ticket_id: ticket.id,
        user_id: userId,
        body: text,
        is_admin: false,
      });

    setSending(false);
    if (insErr) {
      setError(t("replyError"));
      return;
    }
    setBody("");
    await onReplied();
  }

  return (
    <li className="rounded-xl border border-black/10 p-4 dark:border-white/10">
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
        <span className="text-xs text-zinc-500">
          {formatWhen(ticket.created_at)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
        {ticket.message}
      </p>

      {replies.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          {replies.map((r) => (
            <div key={r.id}>
              <div className="text-xs font-medium text-zinc-500">
                {r.is_admin ? t("authorSupport") : t("authorYou")} ·{" "}
                {formatWhen(r.created_at)}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="mt-4 flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            rows={2}
            maxLength={10000}
            placeholder={t("replyPlaceholder")}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={sendReply}
              disabled={sending || !body.trim()}
              className="self-start rounded-full bg-black px-4 py-2 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {sending ? t("submitting") : t("replySend")}
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
