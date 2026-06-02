import { createServerClient } from "@/lib/supabase/server";
import type { SupportTicket, SupportReply } from "@/lib/types/support";
import { AdminTicketTable } from "@/components/admin/support/AdminTicketTable";

// /admin/support - the first admin module. The admin layout has already gated
// access (and RLS gates the queries below regardless). We fetch all tickets +
// their replies, then resolve author emails via the is_admin()-gated
// admin_user_emails RPC (the table stores user_id, not email).

export default async function AdminSupportPage() {
  const supabase = await createServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const adminId = auth.user?.id ?? "";

  const { data: ticketsData } = await supabase
    .from("support_tickets")
    .select("*")
    .order("updated_at", { ascending: false });
  const tickets = (ticketsData as SupportTicket[] | null) ?? [];

  let replies: SupportReply[] = [];
  if (tickets.length > 0) {
    const { data: repliesData } = await supabase
      .from("support_ticket_replies")
      .select("*")
      .in(
        "ticket_id",
        tickets.map((tk) => tk.id),
      )
      .order("created_at", { ascending: true });
    replies = (repliesData as SupportReply[] | null) ?? [];
  }

  // Resolve author emails for both tickets and replies. Non-admins get zero
  // rows from this RPC, so it is safe even though it reads auth.users.
  const emails: Record<string, string> = {};
  const authorIds = Array.from(
    new Set([
      ...tickets.map((tk) => tk.user_id),
      ...replies.map((r) => r.user_id),
    ]),
  );
  if (authorIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: authorIds,
    });
    for (const row of (emailRows as { user_id: string; email: string }[] | null) ??
      []) {
      emails[row.user_id] = row.email;
    }
  }

  return (
    <AdminTicketTable
      adminId={adminId}
      initialTickets={tickets}
      initialReplies={replies}
      emails={emails}
    />
  );
}
