import type { SupportTicket, SupportReply } from "@/lib/types/support";

// A ticket "needs a reply" from staff when its most recent activity came from
// the user: either it has no replies yet (a fresh ticket nobody answered), or
// the latest reply on it is the user's (is_admin === false). Closed tickets are
// never flagged. `ticketReplies` must be sorted oldest-first.
//
// Shared by the support table (components/admin/support/AdminTicketTable.tsx)
// and the admin home dashboard so the two never drift.
export function ticketNeedsReply(
  ticket: SupportTicket,
  ticketReplies: SupportReply[],
): boolean {
  if (ticket.status === "closed") return false;
  if (ticketReplies.length === 0) return true;
  const last = ticketReplies[ticketReplies.length - 1];
  return !last.is_admin;
}

// Group replies by ticket id, then return how many of the given tickets are
// awaiting a staff reply. `replies` may be in any order per ticket as long as
// they are globally oldest-first (the order both the support page and the
// dashboard fetch them in).
export function countNeedsReply(
  tickets: SupportTicket[],
  replies: SupportReply[],
): number {
  const byTicket = new Map<string, SupportReply[]>();
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
