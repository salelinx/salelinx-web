import { loadUsageRows } from "@/lib/admin/usage-data";
import { usageLabel } from "@/lib/admin/usage-sources";
import { AdminUsageTable } from "@/components/admin/usage/AdminUsageTable";

// /admin/usage/web - WEB abuse rate limits for the current period. These are
// per-day safety valves the website's Edge Functions and account UI apply to
// expensive or spammable endpoints (Stripe checkout / portal sessions, account
// deletion requests, shipping label emails, email change requests).
//
// They are NOT product features and are not capped by tier_limits: each cap is a
// hardcoded constant in the calling function and is the same for every tier, so
// the numbers here are an abuse / support signal, not a billing one. A user at
// or over a limit was blocked with a 429.
//
// The caps are mirrored in lib/admin/usage-sources.ts; there is no runtime link
// to the Edge Functions, so changing a cap in one place means changing it there
// too.
//
// Read-only.

export default async function AdminWebUsagePage() {
  const { rows, periodLabel } = await loadUsageRows("web");

  return (
    <AdminUsageTable
      rows={rows}
      periodLabel={periodLabel}
      capKind="limit"
      labelFor={usageLabel}
      emptyMessage="No web activity recorded for this period."
    />
  );
}
