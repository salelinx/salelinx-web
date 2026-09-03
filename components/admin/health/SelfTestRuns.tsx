"use client";

// Recent admin self-test runs, shown alongside passive endpoint health.
//
// The two answer different questions: telemetry says "something broke
// overnight", a self-test run says "I checked just now". This table is the
// full log. A run's results ALSO feed the feature-status rollup above, but
// only asymmetrically and only while fresh - a recent failure escalates a
// feature's status, a pass merely annotates it, and nothing here ever turns a
// card green (see lib/admin/feature-status.ts).
//
// Rows expand to the endpoints the run actually touched. Results are fetched
// with the runs rather than on click, so expanding is instant.

import { Fragment, useState } from "react";

import type {
  SelfTestResultRow,
  SelfTestRunRow,
} from "@/lib/admin/selftest-data";

type Props = {
  runs: SelfTestRunRow[];
  resultsByRun: Record<string, SelfTestResultRow[]>;
};

// Only these mean the endpoint itself is broken. Everything else is a session
// condition or a deliberate exclusion, and colouring those as failures would
// make ordinary anti-bot pressure look like an outage.
const FAILURE = new Set(["client_error", "server_error", "network"]);

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

export function SelfTestRuns({ runs, resultsByRun }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

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
        {runs.map((run) => {
          const isOpen = expanded === run.id;
          const results = resultsByRun[run.id] ?? [];
          return (
            <Fragment key={run.id}>
              <tr
                onClick={() => setExpanded(isOpen ? null : run.id)}
                className="cursor-pointer border-t border-[var(--admin-border)] hover:bg-zinc-50"
              >
                <td className="px-4 py-2">
                  <span
                    aria-hidden="true"
                    className={
                      "mr-2 inline-block text-[10px] text-zinc-400 transition-transform " +
                      (isOpen ? "rotate-90" : "")
                    }
                  >
                    &#9654;
                  </span>
                  {formatWhen(run.started_at)}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-600">
                    {run.platform}
                  </span>
                  {/* A throwaway run duplicated a real listing and briefly made
                      it visible, so it is flagged: it changes what the numbers
                      cost. */}
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
                {/* Skipped is not a warning: a dependency was absent (no sold
                    order, no listing) or the endpoint is never run. */}
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                  {run.skipped}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                  {formatDuration(run.started_at, run.finished_at)}
                </td>
              </tr>

              {isOpen && (
                <tr className="bg-zinc-50">
                  <td colSpan={7} className="px-4 py-3">
                    {results.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No per-endpoint results stored for this run.
                      </p>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {results.map((r, i) => (
                            <tr
                              key={`${r.endpoint_key}-${i}`}
                              className="border-t border-zinc-200 first:border-t-0"
                            >
                              <td className="w-32 py-1.5 pr-3 align-top">
                                <span
                                  className={
                                    "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase " +
                                    (FAILURE.has(r.outcome)
                                      ? "bg-red-100 text-red-700"
                                      : r.outcome === "ok"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-zinc-200 text-zinc-600")
                                  }
                                >
                                  {r.status_code
                                    ? `${r.outcome} ${r.status_code}`
                                    : r.outcome}
                                </span>
                              </td>
                              <td className="py-1.5 pr-3 align-top font-mono text-[11px] text-zinc-700">
                                {/* Platform prefix dropped: every row in a run
                                    shares it. */}
                                {r.endpoint_key.replace(/^(vinted|depop):/, "")}
                              </td>
                              <td className="py-1.5 align-top text-[11px] text-zinc-500">
                                {r.note ?? ""}
                              </td>
                              <td className="w-16 py-1.5 text-right align-top tabular-nums text-[11px] text-zinc-400">
                                {r.duration_ms !== null
                                  ? `${r.duration_ms}ms`
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
