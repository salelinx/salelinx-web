import { createServerClient } from "@/lib/supabase/server";
import type { SupportTicket, SupportReply } from "@/lib/types/support";
import type { AdminSubscriptionRow, AdminAuditRow } from "@/lib/types/admin";
import { countNeedsReply } from "@/lib/admin/needs-reply";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// /admin home dashboard. The admin layout has already gated access (and RLS /
// the is_admin()-gated RPCs gate the reads below regardless). We gather a few
// cheap summaries - open + needs-reply tickets, subscriber/tier counts, the
// latest audit entries - and render link-out cards. All reads are read-only.

export default async function AdminHomePage() {
  const supabase = await createServerClient();

  // Tickets: open count + needs-reply count. support_tickets /
  // support_ticket_replies already carry is_admin() admin policies (migration
  // 012), so a direct select works as an admin.
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
  const openTickets = tickets.filter((tk) => tk.status !== "closed").length;
  const needsReply = countNeedsReply(tickets, replies);

  // Subscriptions: total + a per-tier breakdown, via the is_admin()-gated RPC
  // (the subscriptions table is own-row-only under RLS).
  const { data: subsData } = await supabase.rpc("admin_list_subscriptions");
  const subs = (subsData as AdminSubscriptionRow[] | null) ?? [];
  const activeSubs = subs.filter((s) => s.status === "active").length;
  const tierCounts: Record<string, number> = {};
  for (const s of subs) {
    tierCounts[s.tier_id] = (tierCounts[s.tier_id] ?? 0) + 1;
  }

  // Recent audit entries (admin_audit_log has an is_admin() SELECT policy).
  const { data: auditData } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  const recentAudit = (auditData as AdminAuditRow[] | null) ?? [];

  // Resolve actor emails for the recent audit entries.
  const actorIds = Array.from(
    new Set(recentAudit.map((a) => a.actor_id).filter((id): id is string => id !== null)),
  );
  const actorEmails: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: actorIds,
    });
    for (const row of (emailRows as
      | { user_id: string; email: string }[]
      | null) ?? []) {
      actorEmails[row.user_id] = row.email;
    }
  }

  return (
    <AdminDashboard
      openTickets={openTickets}
      needsReply={needsReply}
      totalSubscriptions={subs.length}
      activeSubscriptions={activeSubs}
      tierCounts={tierCounts}
      recentAudit={recentAudit}
      actorEmails={actorEmails}
    />
  );
}
