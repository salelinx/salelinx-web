import { createServerClient } from "@/lib/supabase/server";
import type { AdminEndpointHealthRow } from "@/lib/types/admin";
import type { HealthTableRow } from "@/components/admin/health/AdminHealthTable";
import { rollUpFeatures } from "@/lib/admin/feature-status";
import type { FeatureStatus } from "@/lib/admin/feature-status";

// Loader for the Endpoint health module. Reads admin_endpoint_health() (which
// re-checks is_admin() itself) and turns raw counters into the severity the
// table renders.
//
// Everything below is server-side so the client component stays a pure
// renderer, matching the other admin modules.

// An endpoint needs this many distinct install-reports behind its failures
// before it can be called broken. Without a floor, a single user stuck behind
// a CAPTCHA loop produces a 100% failure rate on one endpoint and lights up
// the whole dashboard.
const MIN_INSTALLS_FOR_ALERT = 5;

// Absolute floor: below this, a raised rate is noise rather than a break.
const MIN_FAILURE_RATE = 20;

// How much worse than its own baseline an endpoint has to get. Deviation
// rather than a flat threshold, because endpoints differ hugely in their
// normal error rate - some legitimately sit at 10% (optimistic lookups that
// 404 routinely), others should never fail at all.
const BASELINE_MULTIPLIER = 3;

// With no baseline (a new endpoint, or the first days of telemetry) there is
// nothing to deviate from, so fall back to a plain high-rate check.
const NO_BASELINE_RATE = 50;

export type HealthSeverity = "ok" | "warn" | "broken";

export function severityFor(row: AdminEndpointHealthRow): HealthSeverity {
  const rate = row.failure_rate ?? 0;

  // Not enough independent installs to distinguish "endpoint is down" from
  // "one user's session is wedged".
  if (row.installs < MIN_INSTALLS_FOR_ALERT) return "ok";
  if (rate < MIN_FAILURE_RATE) return "ok";

  if (row.baseline_rate === null) {
    return rate >= NO_BASELINE_RATE ? "broken" : "warn";
  }

  // A baseline of 0 has no meaningful multiple, so compare against the floor.
  const threshold =
    row.baseline_rate === 0
      ? MIN_FAILURE_RATE
      : row.baseline_rate * BASELINE_MULTIPLIER;

  if (rate >= threshold && rate >= MIN_FAILURE_RATE) return "broken";
  if (rate >= row.baseline_rate * 1.5) return "warn";
  return "ok";
}

// One hour of report deliveries (migration 031). Shown so an empty dashboard is
// never ambiguous: "no endpoints failing" and "nothing is reporting" look
// identical on the endpoint table alone.
export type ReportDeliveryRow = {
  bucket_hour: string;
  reports: number;
  entries_sent: number;
  entries_accepted: number;
  calls_reported: number;
  versions: string[];
};

export async function loadHealthRows(windowHours = 24): Promise<{
  rows: HealthTableRow[];
  features: FeatureStatus[];
  brokenCount: number;
  warnCount: number;
  totalCalls: number;
  reporting: boolean;
  deliveries: ReportDeliveryRow[];
  lastReportAt: string | null;
}> {
  const supabase = await createServerClient();

  // Independent reads, so they resolve together.
  const [healthRes, deliveryRes] = await Promise.all([
    supabase.rpc("admin_endpoint_health", {
      p_window_hours: windowHours,
      p_baseline_hours: 168,
    }),
    supabase.rpc("admin_endpoint_health_reports", { p_hours: 168 }),
  ]);

  const { data, error } = healthRes;
  const deliveries = (deliveryRes.data as ReportDeliveryRow[] | null) ?? [];
  // Rows come back newest-first from the RPC.
  const lastReportAt = deliveries[0]?.bucket_hour ?? null;

  if (error) {
    // Fail soft: an empty dashboard with a clear "no data" state beats a 500,
    // and this page is the thing you open WHEN something is wrong.
    return {
      rows: [],
      features: rollUpFeatures([]),
      brokenCount: 0,
      warnCount: 0,
      totalCalls: 0,
      reporting: false,
      deliveries,
      lastReportAt,
    };
  }

  const raw = (data as AdminEndpointHealthRow[] | null) ?? [];

  const rows: HealthTableRow[] = raw.map((r) => {
    const severity = severityFor(r);
    return {
      endpoint_key: r.endpoint_key,
      platform: r.platform,
      // The key is 'vinted:POST /api/v2/...'; the table shows method and path
      // as separate columns, so split once here rather than in the renderer.
      method: r.endpoint_key.split(":")[1]?.split(" ")[0] ?? "",
      path: r.endpoint_key.split(" ").slice(1).join(" "),
      total_calls: r.total_calls,
      failures: r.failures,
      failure_rate: r.failure_rate,
      baseline_rate: r.baseline_rate,
      installs: r.installs,
      top_status: r.top_status,
      last_seen: r.last_seen,
      severity,
    };
  });

  return {
    rows,
    features: rollUpFeatures(rows),
    brokenCount: rows.filter((r) => r.severity === "broken").length,
    warnCount: rows.filter((r) => r.severity === "warn").length,
    totalCalls: rows.reduce((sum, r) => sum + r.total_calls, 0),
    // Reports arriving, not endpoints seen: an install can report a batch of
    // all-healthy counters outside the endpoint window, and that still means
    // telemetry is working.
    reporting: rows.length > 0 || deliveries.length > 0,
    deliveries,
    lastReportAt,
  };
}
