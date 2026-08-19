import { FEATURE_ENDPOINTS } from "@/lib/admin/feature-endpoints";
import type { FeaturePlatform } from "@/lib/admin/feature-endpoints";
import type { HealthSeverity } from "@/lib/admin/health-data";
import type { HealthTableRow } from "@/components/admin/health/AdminHealthTable";

// Rolls per-endpoint telemetry up into a per-feature status.
//
// "unknown" is a first-class state, not a fallback. No telemetry for a feature
// means exactly that: nobody exercised it in the window, or no build reporting
// covers it. Rendering silence as healthy is the one failure mode that would
// make this view actively misleading, because the day a feature breaks hard
// enough that nobody can use it is the day its traffic goes to zero.

export type FeatureStatus = {
  key: string;
  label: string;
  platform: FeaturePlatform;
  status: HealthSeverity | "unknown";
  totalCalls: number;
  failures: number;
  failureRate: number | null;
  // Endpoints the feature depends on that actually reported, so the UI can say
  // "3 of 10 endpoints seen" rather than implying full coverage.
  endpointsSeen: number;
  endpointsTotal: number;
  // The worst-off endpoint, for a one-line explanation of a non-OK status.
  worstEndpoint: string | null;
};

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  ok: 0,
  warn: 1,
  broken: 2,
};

/** Strip the `platform:` prefix so a row can be matched against the map. */
function endpointPart(endpointKey: string): string {
  const colon = endpointKey.indexOf(":");
  return colon === -1 ? endpointKey : endpointKey.slice(colon + 1);
}

export function rollUpFeatures(rows: HealthTableRow[]): FeatureStatus[] {
  // Index once: with ~12 features x ~10 endpoints this would otherwise be a
  // scan of every row per endpoint.
  const byEndpoint = new Map<string, HealthTableRow[]>();
  for (const row of rows) {
    const part = endpointPart(row.endpoint_key);
    const existing = byEndpoint.get(part);
    if (existing) existing.push(row);
    else byEndpoint.set(part, [row]);
  }

  return FEATURE_ENDPOINTS.map((feature) => {
    const matched: HealthTableRow[] = [];
    for (const endpoint of feature.endpoints) {
      const hits = byEndpoint.get(endpoint);
      if (hits) matched.push(...hits);
    }

    if (matched.length === 0) {
      return {
        key: feature.key,
        label: feature.label,
        platform: feature.platform,
        status: "unknown" as const,
        totalCalls: 0,
        failures: 0,
        failureRate: null,
        endpointsSeen: 0,
        endpointsTotal: feature.endpoints.length,
        worstEndpoint: null,
      };
    }

    const totalCalls = matched.reduce((sum, r) => sum + r.total_calls, 0);
    const failures = matched.reduce((sum, r) => sum + r.failures, 0);

    // The feature is as healthy as its WORST endpoint, not its average: a
    // crosslist that uploads photos fine but cannot create the draft is broken,
    // and averaging would hide that behind the healthy majority.
    let worst: HealthTableRow = matched[0];
    for (const row of matched) {
      if (SEVERITY_RANK[row.severity] > SEVERITY_RANK[worst.severity]) worst = row;
    }

    return {
      key: feature.key,
      label: feature.label,
      platform: feature.platform,
      status: worst.severity,
      totalCalls,
      failures,
      failureRate:
        totalCalls > 0 ? Math.round((failures / totalCalls) * 1000) / 10 : null,
      // Distinct endpoints, since one endpoint can produce several rows.
      endpointsSeen: new Set(matched.map((r) => endpointPart(r.endpoint_key))).size,
      endpointsTotal: feature.endpoints.length,
      worstEndpoint: worst.severity === "ok" ? null : worst.endpoint_key,
    };
  });
}
