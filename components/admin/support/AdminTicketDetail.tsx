"use client";

// Right-hand detail drawer for a selected ticket: metadata, the reply thread,
// and the admin actions (reply, close/reopen, delete). Every mutation is RLS-
// gated and records an admin_audit_log entry via the log_admin_action RPC.
// Delete is destructive, so it requires step-up reauth first.

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { requireReauth } from "@/lib/admin/reauth";
import { ReauthModal } from "@/components/admin/ReauthModal";
import type { SupportTicket, SupportReply } from "@/lib/types/support";

type Props = {
  ticket: SupportTicket;
  replies: SupportReply[];
  emails: Record<string, string>;
  adminId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

const TYPE_LABEL: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  feedback: "Feedback",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminTicketDetail({
  ticket,
  replies,
  emails,
  adminId,
  onClose,
  onChanged,
}: Props) {
  const supabase = createBrowserClient();

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);

  const isOpen = ticket.status !== "closed";
  const authorEmail = emails[ticket.user_id];

  async function logAction(
    action: string,
    metadata: Record<string, unknown> = {},
  ) {
    // Best-effort audit. A logging failure is surfaced but does not undo the
    // action that already succeeded.
    const { error: logErr } = await supabase.rpc("log_admin_action", {
      p_action: action,
      p_target_table: "support_tickets",
      p_target_id: ticket.id,
      p_metadata: metadata,
    });
    if (logErr) {
      setError(`Action done, but audit log failed: ${logErr.message}`);
    }
  }

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
    if (insErr) {
      setBusy(false);
      setError("Could not send the reply. Please try again.");
      return;
    }
    await logAction("ticket.reply");
    setBody("");
    setBusy(false);
    await onChanged();
  }

  async function setStatus(next: "open" | "closed") {
    setBusy(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("support_tickets")
      .update({ status: next })
      .eq("id", ticket.id);
    if (updErr) {
      setBusy(false);
      setError("Could not update status. Please try again.");
      return;
    }
    await logAction(next === "closed" ? "ticket.close" : "ticket.reopen");
    setBusy(false);
    await onChanged();
  }

  async function confirmDelete(password: string) {
    setBusy(true);
    setError(null);
    try {
      await requireReauth(password);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Re-authentication failed.");
      return;
    }

    const { error: delErr } = await supabase
      .from("support_tickets")
      .delete()
      .eq("id", ticket.id);
    if (delErr) {
      setBusy(false);
      setError("Could not delete the ticket. Please try again.");
      return;
    }

    // Audit the deletion without copying personal data into the log: the
    // audit row must not outlive an erasure request, so no message body or
    // user_id here. The ticket id is already recorded as p_target_id.
    await logAction("ticket.delete", {
      type: ticket.type,
      created_at: ticket.created_at,
      reauthenticated: true,
    });
    setReauthOpen(false);
    setBusy(false);
    onClose();
    await onChanged();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {TYPE_LABEL[ticket.type] ?? ticket.type}
          </span>
          <span
            className={
              isOpen
                ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
            }
          >
            {isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Close detail"
        >
          x
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-xs">
          <Meta label="From">
            {authorEmail ? (
              <span>{authorEmail}</span>
            ) : (
              <span className="font-mono">{ticket.user_id}</span>
            )}
          </Meta>
          <Meta label="User ID">
            <span className="font-mono break-all">{ticket.user_id}</span>
          </Meta>
          <Meta label="Ticket">
            <span className="font-mono break-all">{ticket.id}</span>
          </Meta>
          {ticket.platform && <Meta label="Platform">{ticket.platform}</Meta>}
          {ticket.tier_id && <Meta label="Tier">{ticket.tier_id}</Meta>}
          {ticket.app_version && (
            <Meta label="Version">
              <span className="font-mono">{ticket.app_version}</span>
            </Meta>
          )}
          {ticket.source && <Meta label="Source">{ticket.source}</Meta>}
          {ticket.locale && <Meta label="Locale">{ticket.locale}</Meta>}
          <Meta label="Created">{formatWhen(ticket.created_at)}</Meta>
          {ticket.user_agent && (
            <Meta label="UA">
              <span className="break-all text-zinc-500">
                {ticket.user_agent}
              </span>
            </Meta>
          )}
        </dl>

        <div className="mt-4 rounded-md border border-[var(--admin-border)] bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-800">
          {ticket.message}
        </div>

        {replies.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-[var(--admin-border)] pt-4">
            {replies.map((r) => (
              <div key={r.id}>
                <div className="text-xs font-medium text-zinc-500">
                  {r.is_admin
                    ? "SaleLinx Support"
                    : (emails[r.user_id] ?? "User")}{" "}
                  | {formatWhen(r.created_at)}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--admin-border)] p-4">
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          rows={3}
          maxLength={10000}
          placeholder="Reply as SaleLinx Support..."
          className="w-full rounded-md border border-[var(--admin-border)] bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reply}
            disabled={busy || !body.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Send reply
          </button>
          <button
            type="button"
            onClick={() => setStatus(isOpen ? "closed" : "open")}
            disabled={busy}
            className="rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            {isOpen ? "Close" : "Reopen"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReauthOpen(true);
            }}
            disabled={busy}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>

      {reauthOpen && (
        <ReauthModal
          title="Confirm deletion"
          description="Deleting a ticket removes it and all its replies. This cannot be undone."
          confirmLabel="Delete ticket"
          busyLabel="Deleting..."
          danger
          busy={busy}
          error={error}
          onCancel={() => {
            setReauthOpen(false);
            setError(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-800">{children}</dd>
    </>
  );
}

