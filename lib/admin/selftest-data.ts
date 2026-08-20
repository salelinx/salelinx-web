import { createServerClient } from "@/lib/supabase/server";

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
