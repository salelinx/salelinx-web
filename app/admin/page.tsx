import { createServerClient } from "@/lib/supabase/server";
import type { SupportTicket, SupportReply } from "@/lib/types/support";
import type { AdminSubscriptionRow, AdminAuditRow } from "@/lib/types/admin";
import { countNeedsReply } from "@/lib/admin/needs-reply";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { loadHealthRows } from "@/lib/admin/health-data";

// /admin home dashboard. The admin layout has already gated access (and RLS /
// the is_admin()-gated RPCs gate the reads below regardless). We gather a few
// cheap summaries - open + needs-reply tickets, subscriber/tier counts, the
// latest audit entries - and render link-out cards. All reads are read-only.

// The dashboard only needs counts, so the ticket read is narrowed to the
// columns countNeedsReply() actually reads and scoped to OPEN tickets. Closed
// tickets never count as needing a reply (see lib/admin/needs-reply.ts), so
// excluding them changes no number while keeping the read bounded as the
// archive grows. The full history stays available in /admin/support.

export default async function AdminHomePage() {
  const supabase = await createServerClient();

  // Independent reads: tickets, subscriptions and the audit log do not depend
  // on each other, so they resolve together instead of in series.
  const [ticketsRes, subsRes, auditRes, health] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id,status")
      .neq("status", "closed")
      .order("updated_at", { ascending: false }),
    supabase.rpc("admin_list_subscriptions"),
    supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
    // Marketplace health, so a breakage is visible on the landing page rather
    // than only to someone who thought to open /admin/health. Fails soft to an
    // all-unknown rollup, matching the module itself.
    loadHealthRows(24),
  ]);

  const tickets =
    (ticketsRes.data as Pick<SupportTicket, "id" | "status">[] | null) ?? [];

  // Replies are only needed to tell which OPEN ticket was last spoken on by the
  // user, so the fetch is scoped to those ticket ids and to the two columns the
  // predicate reads.
  let replies: Pick<SupportReply, "ticket_id" | "is_admin">[] = [];
  if (tickets.length > 0) {
    const { data: repliesData } = await supabase
      .from("support_ticket_replies")
      .select("ticket_id,is_admin")
      .in(
        "ticket_id",
        tickets.map((tk) => tk.id),
      )
      .order("created_at", { ascending: true });
    replies =
      (repliesData as Pick<SupportReply, "ticket_id" | "is_admin">[] | null) ??
      [];
  }
  const openTickets = tickets.length;
  const needsReply = countNeedsReply(
    tickets as SupportTicket[],
    replies as SupportReply[],
  );

  // Subscriptions: total + a per-tier breakdown, via the is_admin()-gated RPC
  // (the subscriptions table is own-row-only under RLS).
  const subs = (subsRes.data as AdminSubscriptionRow[] | null) ?? [];
  const activeSubs = subs.filter((s) => s.status === "active").length;
  const tierCounts: Record<string, number> = {};
  for (const s of subs) {
    tierCounts[s.tier_id] = (tierCounts[s.tier_id] ?? 0) + 1;
  }

  // Recent audit entries (admin_audit_log has an is_admin() SELECT policy).
  const recentAudit = (auditRes.data as AdminAuditRow[] | null) ?? [];

  // Resolve actor emails for the recent audit entries.
  const actorIds = Array.from(
    new Set(
      recentAudit
        .map((a) => a.actor_id)
        .filter((id): id is string => id !== null),
    ),
  );
  const actorEmails: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: actorIds,
    });
    for (const row of (emailRows as
      { user_id: string; email: string }[] | null) ?? []) {
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
      features={health.features}
      healthReporting={health.reporting}
    />
  );
}
