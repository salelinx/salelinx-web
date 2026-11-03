import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportTicket, SupportReply } from "@/lib/types/support";

// A ticket "needs a reply" from staff when its most recent activity came from
// the user: either it has no replies yet (a fresh ticket nobody answered), or
// the latest reply on it is the user's (is_admin === false). Closed tickets are
// never flagged. `ticketReplies` must be sorted oldest-first.
//
// Shared by the support table (components/admin/support/AdminTicketTable.tsx),
// the admin home dashboard and the nav alert (components/admin/NeedsReplyProvider.tsx)
// so they never drift.
export function ticketNeedsReply(
  ticket: Pick<SupportTicket, "status">,
  ticketReplies: Pick<SupportReply, "is_admin">[],
): boolean {
  if (ticket.status === "closed") return false;
  if (ticketReplies.length === 0) return true;
  const last = ticketReplies[ticketReplies.length - 1];
  return !last.is_admin;
}

// Group replies by ticket id, then return how many of the given tickets are
// awaiting a staff reply. `replies` may be in any order per ticket as long as
// they are globally oldest-first (the order both the support page and
// loadOpenTicketCounts fetch them in).
export function countNeedsReply(
  tickets: Pick<SupportTicket, "id" | "status">[],
  replies: Pick<SupportReply, "ticket_id" | "is_admin">[],
): number {
  const byTicket = new Map<string, Pick<SupportReply, "ticket_id" | "is_admin">[]>();
  for (const r of replies) {
    const arr = byTicket.get(r.ticket_id);
    if (arr) arr.push(r);
    else byTicket.set(r.ticket_id, [r]);
  }
  let count = 0;
  for (const tk of tickets) {
    if (ticketNeedsReply(tk, byTicket.get(tk.id) ?? [])) count += 1;
  }
  return count;
}

// How many tickets are open, and how many of those await a staff reply. Takes
// the client so it works from the server dashboard and the browser nav alike.
// Scoped to open tickets and the columns the predicate reads, because closed
// tickets never count and the archive only grows.
//
// Returns null if either read fails. Treating a failed replies read as "no
// replies" would flag every open ticket as unanswered.
export async function loadOpenTicketCounts(
  supabase: SupabaseClient,
): Promise<{ open: number; needsReply: number } | null> {
  const { data: tickets, error: ticketsError } = await supabase
    .from("support_tickets")
    .select("id,status")
    .neq("status", "closed");
  if (ticketsError || !tickets) return null;
  if (tickets.length === 0) return { open: 0, needsReply: 0 };

  const { data: replies, error: repliesError } = await supabase
    .from("support_ticket_replies")
    .select("ticket_id,is_admin")
    .in(
      "ticket_id",
      tickets.map((tk) => tk.id),
    )
    .order("created_at", { ascending: true });
  if (repliesError || !replies) return null;

  return {
    open: tickets.length,
    needsReply: countNeedsReply(tickets, replies),
  };
}
