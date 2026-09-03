import { FEATURE_ENDPOINTS } from "@/lib/admin/feature-endpoints";
import type { FeaturePlatform } from "@/lib/admin/feature-endpoints";
import type { HealthSeverity } from "@/lib/admin/health-data";
import type { HealthTableRow } from "@/components/admin/health/AdminHealthTable";

// Rolls per-endpoint telemetry up into a per-feature status, with recent
// self-test results folded in as a second, asymmetric signal.
//
// "unknown" is a first-class state, not a fallback. No telemetry for a feature
// means exactly that: nobody exercised it in the window, or no build reporting
// covers it. Rendering silence as healthy is the one failure mode that would
// make this view actively misleading, because the day a feature breaks hard
// enough that nobody can use it is the day its traffic goes to zero.
//
// SELF-TESTS ESCALATE, NEVER CLEAR. A self-test is one controlled run by one
// admin session, so its evidence is asymmetric: a failure is strong ("a
// known-good session could not do this"), a pass is weak (it proves nothing
// about the users behind other IPs, accounts, or rollout buckets). A recent
// failing self-test therefore raises the status - unknown/warn/broken all
// become broken, and ok becomes warn (fleet traffic succeeding while the
// probe fails points at a partial or admin-side problem, worth a look but not
// an outage call against the telemetry). A passing self-test only annotates
// the card; it never turns anything green, or one healthy admin session could
// outvote hundreds of failing users. Signals decay fast (see
// loadRecentSelfTestSignals) so a stale run cannot speak for the present.

// One recent self-test result that carries signal. Neutral outcomes (auth,
// blocked, no_tab, skipped, not_run) are session conditions, not endpoint
// health, and are filtered out before this type is built.
export type SelfTestSignal = {
  platform: FeaturePlatform;
  // Endpoint key minus the `platform:` prefix, as `METHOD /path`, matching
  // FeatureDefinition.endpoints.
  endpoint: string;
  outcome: "pass" | "fail";
  // finished_at of the run the result belongs to.
  at: string;
};

export type FeatureSelfTest = {
  outcome: "passed" | "failed";
  at: string;
  failedEndpoints: string[];
};

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
  // What the latest recent self-test run said about this feature's endpoints,
  // or null when no recent run covered them.
  selfTest: FeatureSelfTest | null;
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

// Applies the asymmetric self-test rules described at the top of this file to
// a telemetry-derived status. Split out so the escalation matrix is one
// readable expression rather than woven through the rollup.
function applySelfTest(f: FeatureStatus): FeatureStatus {
  if (f.selfTest?.outcome !== "failed") return f;
  return {
    ...f,
    status: f.status === "ok" ? "warn" : "broken",
    // A feature with no telemetry has no worst endpoint; name the failed probe
    // so the card can still say what broke.
    worstEndpoint:
      f.worstEndpoint ??
      (f.selfTest.failedEndpoints[0]
        ? `${f.platform}:${f.selfTest.failedEndpoints[0]}`
        : null),
  };
}

export function rollUpFeatures(
  rows: HealthTableRow[],
  selfTestSignals: SelfTestSignal[] = [],
): FeatureStatus[] {
  // Indexed by `platform|METHOD /path`, not by path alone. Several endpoints
  // exist on BOTH marketplaces under the same path - '/api/v2/products/:slug/'
  // and '/api/v2/drafts/' among them - so matching on the path would credit
  // Vinted traffic to a Depop feature and vice versa, which is exactly the
  // confusion splitting by platform is meant to remove.
  const byEndpoint = new Map<string, HealthTableRow[]>();
  for (const row of rows) {
    const key = `${row.platform}|${endpointPart(row.endpoint_key)}`;
    const existing = byEndpoint.get(key);
    if (existing) existing.push(row);
    else byEndpoint.set(key, [row]);
  }

  // Same platform-scoped keying for the self-test signals.
  const signalsByEndpoint = new Map<string, SelfTestSignal[]>();
  for (const s of selfTestSignals) {
    const key = `${s.platform}|${s.endpoint}`;
    const existing = signalsByEndpoint.get(key);
    if (existing) existing.push(s);
    else signalsByEndpoint.set(key, [s]);
  }

  return FEATURE_ENDPOINTS.map((feature) => {
    const matched: HealthTableRow[] = [];
    const signals: SelfTestSignal[] = [];
    for (const endpoint of feature.endpoints) {
      const hits = byEndpoint.get(`${feature.platform}|${endpoint}`);
      if (hits) matched.push(...hits);
      const sigs = signalsByEndpoint.get(`${feature.platform}|${endpoint}`);
      if (sigs) signals.push(...sigs);
    }

    const failedSignals = signals.filter((s) => s.outcome === "fail");
    const selfTest: FeatureSelfTest | null =
      signals.length === 0
        ? null
        : {
            outcome: failedSignals.length > 0 ? "failed" : "passed",
            at: signals.reduce((max, s) => (s.at > max ? s.at : max), signals[0].at),
            failedEndpoints: Array.from(
              new Set(failedSignals.map((s) => s.endpoint)),
            ),
          };

    if (matched.length === 0) {
      return applySelfTest({
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
        selfTest,
      });
    }

    const totalCalls = matched.reduce((sum, r) => sum + r.total_calls, 0);
    const failures = matched.reduce((sum, r) => sum + r.failures, 0);

    // The feature is as healthy as its WORST endpoint, not its average: a
    // crosslist that uploads photos fine but cannot create the draft is broken,
    // and averaging would hide that behind the healthy majority.
    let worst: HealthTableRow = matched[0];
    for (const row of matched) {
      if (SEVERITY_RANK[row.severity] > SEVERITY_RANK[worst.severity])
        worst = row;
    }

    return applySelfTest({
      key: feature.key,
      label: feature.label,
      platform: feature.platform,
      status: worst.severity,
      totalCalls,
      failures,
      failureRate:
        totalCalls > 0 ? Math.round((failures / totalCalls) * 1000) / 10 : null,
      // Distinct endpoints, since one endpoint can produce several rows.
      endpointsSeen: new Set(matched.map((r) => endpointPart(r.endpoint_key)))
        .size,
      endpointsTotal: feature.endpoints.length,
      worstEndpoint: worst.severity === "ok" ? null : worst.endpoint_key,
      selfTest,
    });
  });
}
