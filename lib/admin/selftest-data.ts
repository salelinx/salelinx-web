import { createServerClient } from "@/lib/supabase/server";
import type { SelfTestSignal } from "@/lib/admin/feature-status";

// Loader for the self-test module on /admin/health.
//
// Passive telemetry (health-data.ts) answers "did something break overnight?".
// These rows answer "is it fixed right now?" - an admin drove the endpoints on
// demand from their own logged-in session.
//
// Both RPCs re-check is_admin() themselves, so this file adds no gating of its
// own. is_admin() requires AAL2, which is why the READ side is safe even though
// the extension's write path cannot reach AAL2 (see report-selftest).

export type SelfTestRunRow = {
  id: string;
  run_by: string;
  extension_version: string;
  platform: "vinted" | "depop";
  included_throwaway: boolean;
  started_at: string;
  finished_at: string | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type SelfTestResultRow = {
  endpoint_key: string;
  platform: "vinted" | "depop";
  outcome: string;
  status_code: number | null;
  duration_ms: number | null;
  note: string | null;
};

export async function loadSelfTestRuns(limit = 10): Promise<SelfTestRunRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("admin_selftest_runs", {
    p_limit: limit,
  });

  // Fail soft to empty: a missing self-test history must not take down the
  // endpoint health module it sits beside.
  if (error || !data) return [];
  return data as SelfTestRunRow[];
}

/** Per-run drill-down: every endpoint the run touched, failures first. */
export async function loadSelfTestResults(
  runId: string,
): Promise<SelfTestResultRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("admin_selftest_results", {
    p_run_id: runId,
  });
  if (error || !data) return [];
  return data as SelfTestResultRow[];
}

/**
 * Results for several runs at once, keyed by run id.
 *
 * Fetched with the runs rather than on click: the admin page is already a
 * server component, a run holds ~25 rows, and ten runs is a few hundred rows in
 * total - far cheaper than a round trip per expand, and it makes the drill-down
 * instant. Queries run concurrently since they are independent.
 */
export async function loadSelfTestResultsFor(
  runIds: string[],
): Promise<Record<string, SelfTestResultRow[]>> {
  const entries = await Promise.all(
    runIds.map(async (id) => [id, await loadSelfTestResults(id)] as const),
  );
  return Object.fromEntries(entries);
}

// How long a self-test result may speak for the present in the feature-status
// rollup. Short on purpose: a run from this morning says nothing about a
// marketplace change shipped at noon, and a status green "because someone
// tested it Tuesday" is the rot mode this cutoff exists to prevent.
const SIGNAL_MAX_AGE_MINUTES = 60;

// Only these outcomes mean the endpoint itself is broken; ok is a pass.
// Everything else (auth, blocked, no_tab, skipped, not_run) is a session
// condition or a deliberate exclusion and carries NO signal - counting
// ordinary anti-bot pressure as an outage would defeat the point.
const FAILURE_OUTCOMES = new Set(["client_error", "server_error", "network"]);

/**
 * Recent self-test results as per-endpoint signals for rollUpFeatures().
 *
 * Uses only the LATEST finished run per platform inside the age window, so an
 * old failing run cannot linger next to a newer clean one. Returns [] when
 * nothing recent exists, which callers treat as "no self-test opinion".
 */
export async function loadRecentSelfTestSignals(
  maxAgeMinutes = SIGNAL_MAX_AGE_MINUTES,
): Promise<SelfTestSignal[]> {
  const runs = await loadSelfTestRuns(10);
  const cutoff = Date.now() - maxAgeMinutes * 60_000;

  const latestByPlatform = new Map<string, SelfTestRunRow>();
  for (const run of runs) {
    if (!run.finished_at) continue;
    if (new Date(run.finished_at).getTime() < cutoff) continue;
    const existing = latestByPlatform.get(run.platform);
    if (!existing || run.finished_at > existing.finished_at!) {
      latestByPlatform.set(run.platform, run);
    }
  }

  const picked = Array.from(latestByPlatform.values());
  if (picked.length === 0) return [];

  const resultsByRun = await loadSelfTestResultsFor(picked.map((r) => r.id));

  const signals: SelfTestSignal[] = [];
  for (const run of picked) {
    for (const r of resultsByRun[run.id] ?? []) {
      const outcome =
        r.outcome === "ok"
          ? ("pass" as const)
          : FAILURE_OUTCOMES.has(r.outcome)
            ? ("fail" as const)
            : null;
      if (!outcome) continue;
      signals.push({
        platform: run.platform,
        // Keys may arrive with or without the platform prefix; the rollup
        // matches on the bare `METHOD /path` form.
        endpoint: r.endpoint_key.replace(/^(vinted|depop):/, ""),
        outcome,
        at: run.finished_at!,
      });
    }
  }
  return signals;
}
