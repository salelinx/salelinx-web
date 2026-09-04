import { createServerClient } from "@/lib/supabase/server";
import type { AdminAuditRow } from "@/lib/types/admin";
import { AdminAuditTable } from "@/components/admin/audit/AdminAuditTable";

// /admin/audit - the admin action log. Unlike the other new modules this reads
// admin_audit_log DIRECTLY: that table already carries an is_admin() SELECT
// policy (migration 009_admin_console.sql), so no RPC is needed. The log is append-only, so this
// module is read-only by nature. Actor ids are resolved to emails via the
// existing admin_user_emails() RPC.
//
// We cap the read at the most recent 500 entries to keep the page bounded; the
// log grows one row per admin mutation. If deeper history is needed, add
// date-range filtering / pagination.

const AUDIT_LIMIT = 500;

export default async function AdminAuditPage() {
  const supabase = await createServerClient();

  const { data: auditData } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(AUDIT_LIMIT);
  const entries = (auditData as AdminAuditRow[] | null) ?? [];

  const emails: Record<string, string> = {};
  const actorIds = Array.from(
    new Set(entries.map((e) => e.actor_id).filter((id): id is string => id !== null)),
  );
  if (actorIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: actorIds,
    });
    for (const row of (emailRows as
      | { user_id: string; email: string }[]
      | null) ?? []) {
      emails[row.user_id] = row.email;
    }
  }

  return (
    <AdminAuditTable
      entries={entries}
      emails={emails}
      capped={entries.length === AUDIT_LIMIT}
      limit={AUDIT_LIMIT}
    />
  );
}
