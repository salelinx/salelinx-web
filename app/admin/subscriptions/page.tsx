import { createServerClient } from "@/lib/supabase/server";
import type { AdminSubscriptionRow } from "@/lib/types/admin";
import { AdminSubscriptionTable } from "@/components/admin/subscriptions/AdminSubscriptionTable";

// /admin/subscriptions - every subscription row, via the is_admin()-gated
// admin_list_subscriptions() RPC (the subscriptions table is own-row-only under
// RLS). Author emails are resolved with the existing admin_user_emails() RPC.
// Read-only: no Stripe API calls, no mutations in this pass.

export default async function AdminSubscriptionsPage() {
  const supabase = await createServerClient();

  const { data: subsData } = await supabase.rpc("admin_list_subscriptions");
  const subscriptions = (subsData as AdminSubscriptionRow[] | null) ?? [];

  const emails: Record<string, string> = {};
  const userIds = Array.from(new Set(subscriptions.map((s) => s.user_id)));
  if (userIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: userIds,
    });
    for (const row of (emailRows as
      | { user_id: string; email: string }[]
      | null) ?? []) {
      emails[row.user_id] = row.email;
    }
  }

  return (
    <AdminSubscriptionTable
      initialSubscriptions={subscriptions}
      emails={emails}
    />
  );
}
