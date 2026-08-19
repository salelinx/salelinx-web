// Recent admin self-test runs, shown alongside passive endpoint health.
//
// The two answer different questions and must not be conflated: telemetry says
// "something broke overnight", a self-test run says "I checked just now". A run
// is a point measurement by one admin against one account, so it is never
// aggregated or turned into a status - it is shown as what it is, a log.

import type { SelfTestRunRow } from "@/lib/admin/selftest-data";

type Props = {
  runs: SelfTestRunRow[];
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "unfinished";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// Server component: this is a read-only log, so there is nothing to hydrate.
// A per-run drill-down (admin_selftest_results) is deliberately not wired up
// yet - a clickable row that expands nothing is worse than a plain one.
export function SelfTestRuns({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700">No self-test runs yet.</p>
        <p className="mt-1">
          Runs are started from the extension panel (admin only). Unlike the
          passive telemetry above, a run drives the endpoints on demand against
          the admin&apos;s own logged-in session, so it answers &quot;is it
          working right now&quot; without waiting for user traffic.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr>
          <th className="px-4 py-2 font-medium">When</th>
          <th className="px-4 py-2 font-medium">Platform</th>
          <th className="px-4 py-2 font-medium">Version</th>
          <th className="px-4 py-2 text-right font-medium">Failed</th>
          <th className="px-4 py-2 text-right font-medium">Passed</th>
          <th className="px-4 py-2 text-right font-medium">Skipped</th>
          <th className="px-4 py-2 text-right font-medium">Took</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id} className="border-t border-[var(--admin-border)]">
            <td className="px-4 py-2">{formatWhen(run.started_at)}</td>
            <td className="px-4 py-2">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-600">
                {run.platform}
              </span>
              {/* A throwaway run briefly published a real listing on Vinted,
                    so it is flagged: it changes what the numbers cost. */}
              {run.included_throwaway && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                  throwaway
                </span>
              )}
            </td>
            <td className="px-4 py-2 font-mono text-xs text-zinc-500">
              {run.extension_version}
            </td>
            <td
              className={
                "px-4 py-2 text-right tabular-nums " +
                (run.failed > 0
                  ? "font-semibold text-red-700"
                  : "text-zinc-500")
              }
            >
              {run.failed}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
              {run.passed}
            </td>
            {/* Skipped is not a warning: it means a dependency was absent
                  (no sold order, no listing) or the endpoint is deliberately
                  never run. */}
            <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
              {run.skipped}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
              {formatDuration(run.started_at, run.finished_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
