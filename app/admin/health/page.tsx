import { loadHealthRows } from "@/lib/admin/health-data";
import { AdminHealthTable } from "@/components/admin/health/AdminHealthTable";

// /admin/health - marketplace endpoint health, aggregated from passive
// extension telemetry (migration 030_endpoint_health.sql).
//
// Why this exists: every Vinted / Depop endpoint the extension depends on needs
// a live logged-in browser session (CSRF token, session cookies via the
// MAIN-world bridge, a real tab, DataDome clearance), so no server-side probe
// can reach them. Our users' own calls are the only usable health signal. The
// extension counts outcomes locally and reports anonymous aggregates; this page
// is where a marketplace shipping a breaking change becomes visible.
//
// Read the failure rate against the BASELINE column, not on its own - endpoints
// differ a lot in their normal error rate. See severityFor() in health-data.ts.
//
// Read-only. No user drill-down by design: endpoint_health carries no user_id.

// Always render fresh - a cached health dashboard is worse than no dashboard.
export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const {
    rows,
    brokenCount,
    warnCount,
    totalCalls,
    reporting,
    deliveries,
    lastReportAt,
    features,
    overrides,
    crashes,
  } = await loadHealthRows(24);

  return (
    <AdminHealthTable
      rows={rows}
      brokenCount={brokenCount}
      warnCount={warnCount}
      totalCalls={totalCalls}
      reporting={reporting}
      windowLabel="last 24h vs 7-day baseline"
      deliveries={deliveries}
      lastReportAt={lastReportAt}
      features={features}
      overrides={overrides}
      crashes={crashes}
    />
  );
}
