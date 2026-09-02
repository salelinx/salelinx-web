import { loadUsageRows } from "@/lib/admin/usage-data";
import { USAGE_EPOCH } from "@/lib/admin/period";
import { resolveUsageRange, usageToday } from "@/lib/admin/usage-range";
import { AdminUsageTable } from "@/components/admin/usage/AdminUsageTable";
import { UsageRangePicker } from "@/components/admin/usage/UsageRangePicker";

// /admin/usage/web - WEB abuse rate limits for a selectable period (current
// period by default; wider ranges via the same ?range= / ?from=&to= URL params
// as /admin/usage). These are per-day safety valves the website's Edge
// Functions and account UI apply to expensive or spammable endpoints (Stripe
// checkout / portal sessions, account deletion requests, shipping label
// emails, email change requests).
//
// They are NOT product features and are not capped by tier_limits: each cap is a
// hardcoded constant in the calling function and is the same for every tier, so
// the numbers here are an abuse / support signal, not a billing one. A user at
// or over a limit was blocked with a 429. The limit and percent columns only
// render on the current-period view; the limits are per-day, so a multi-day
// sum has nothing meaningful to be measured against.
//
// The caps are mirrored in lib/admin/usage-sources.ts; there is no runtime link
// to the Edge Functions, so changing a cap in one place means changing it there
// too.
//
// Read-only.

type SearchParams = Promise<{ range?: string; from?: string; to?: string }>;

export default async function AdminWebUsagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const selection = resolveUsageRange(await searchParams);
  const { rows, periodLabel } = await loadUsageRows("web", selection.period);

  return (
    <AdminUsageTable
      rows={rows}
      periodLabel={periodLabel}
      capKind="limit"
      friendlyLabels
      emptyMessage="No web activity recorded for this range."
      toolbar={
        <UsageRangePicker
          preset={selection.preset}
          from={selection.from}
          to={selection.to}
          min={USAGE_EPOCH}
          max={usageToday()}
          basePath="/admin/usage/web"
        />
      }
    />
  );
}
