"use client";

// Endpoint health table. One row per marketplace endpoint the extension calls,
// aggregated across every reporting install over the selected window.
//
// This is the "is it them or is it everyone" screen: a support ticket saying
// crosslisting is broken is answered by whether the drafts endpoint is red
// here. Rows are pre-computed on the server (severity, rates, split
// method/path); this is a pure renderer with NO mutations.

import { useMemo, useState } from "react";

import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";
import type {
  HealthSeverity,
  ReportDeliveryRow,
} from "@/lib/admin/health-data";

export type HealthTableRow = {
  endpoint_key: string;
  platform: string;
  method: string;
  path: string;
  total_calls: number;
  failures: number;
  failure_rate: number | null;
  baseline_rate: number | null;
  installs: number;
  top_status: number | null;
  last_seen: string;
  severity: HealthSeverity;
};

type Props = {
  rows: HealthTableRow[];
  brokenCount: number;
  warnCount: number;
  totalCalls: number;
  reporting: boolean;
  windowLabel: string;
  deliveries: ReportDeliveryRow[];
  lastReportAt: string | null;
};

type Filter = "all" | "problems" | "vinted" | "depop";

const SEVERITY_DOT: Record<HealthSeverity, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  broken: "bg-red-500",
};

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  ok: "OK",
  warn: "Degraded",
  broken: "Broken",
};

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  problems: "Problems only",
  vinted: "Vinted",
  depop: "Depop",
};

function formatRate(rate: number | null): string {
  if (rate === null) return "-";
  return rate.toFixed(1) + "%";
}

export function AdminHealthTable({
  rows,
  brokenCount,
  warnCount,
  totalCalls,
  reporting,
  windowLabel,
  deliveries,
  lastReportAt,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.endpoint_key.toLowerCase().includes(term)) return false;
      if (filter === "problems") {
        return r.severity === "broken" || r.severity === "warn";
      }
      if (filter === "vinted") return r.platform === "vinted";
      if (filter === "depop") return r.platform === "depop";
      return true;
    });
  }, [rows, search, filter]);

  // Caps how many rows reach the DOM; filtering above still runs over the whole
  // set (see use-windowed-rows.ts).
  const win = useWindowedRows(visible);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Endpoint health
          <span className="ml-2 font-normal text-zinc-400">{windowLabel}</span>
        </h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search endpoint"
          className="w-64 rounded-md border border-[var(--admin-border)] px-2 py-1 text-sm"
        />
      </header>

      {/* Summary strip: answers "is anything broken right now" without reading
          the table below. */}
      <div className="flex shrink-0 gap-6 border-b border-[var(--admin-border)] px-4 py-3">
        <Stat
          label="Broken"
          value={brokenCount}
          tone={brokenCount > 0 ? "bad" : "neutral"}
        />
        <Stat
          label="Degraded"
          value={warnCount}
          tone={warnCount > 0 ? "warn" : "neutral"}
        />
        <Stat label="Endpoints seen" value={rows.length} tone="neutral" />
        <Stat
          label="Calls"
          value={totalCalls.toLocaleString("en-US")}
          tone="neutral"
        />
        {/* Ingest health, distinct from endpoint health. Without it, "nothing
            is broken" and "nothing is reporting" render identically. */}
        <Stat
          label="Reports (7d)"
          value={deliveries
            .reduce((sum, d) => sum + d.reports, 0)
            .toLocaleString("en-US")}
          tone={deliveries.length === 0 ? "warn" : "neutral"}
        />
        <div>
          <div className="text-lg font-semibold tabular-nums text-zinc-900">
            {lastReportAt
              ? new Date(lastReportAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "never"}
          </div>
          <div className="text-xs text-zinc-500">Last report</div>
        </div>
      </div>

      {/* A batch arriving but being rejected wholesale means the payload shape
          is wrong - a distinct failure from nothing arriving, and invisible on
          the endpoint table. */}
      {deliveries.some((d) => d.entries_accepted < d.entries_sent) && (
        <div className="shrink-0 border-b border-[var(--admin-border)] bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Some reported counters were rejected by validation (
          {deliveries.reduce(
            (sum, d) => sum + (d.entries_sent - d.entries_accepted),
            0,
          )}{" "}
          of{" "}
          {deliveries.reduce((sum, d) => sum + d.entries_sent, 0)} in the last 7
          days). Check the payload shape against record_endpoint_health.
        </div>
      )}

      <div className="flex shrink-0 gap-1 px-4 py-2">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
            }
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!reporting ? (
          <div className="px-4 py-8 text-sm text-zinc-500">
            <p className="font-medium text-zinc-700">
              No telemetry received yet.
            </p>
            <p className="mt-1">
              Nothing has reached the ingest, so this is upstream of the server:
              either no build carrying telemetry is running, every install is
              signed out (the report needs a valid session), or a day has not
              elapsed since the last report.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No endpoints match this filter.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--admin-surface)] text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Endpoint</th>
                <th className="px-4 py-2 text-right font-medium">Calls</th>
                <th className="px-4 py-2 text-right font-medium">Fail rate</th>
                <th className="px-4 py-2 text-right font-medium">Baseline</th>
                <th className="px-4 py-2 text-right font-medium">Installs</th>
                <th className="px-4 py-2 text-right font-medium">Code</th>
              </tr>
            </thead>
            <tbody>
              {win.windowed.map((r) => (
                <tr
                  key={r.endpoint_key}
                  className="border-t border-[var(--admin-border)]"
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          "inline-block h-2 w-2 rounded-full " +
                          SEVERITY_DOT[r.severity]
                        }
                        aria-hidden="true"
                      />
                      <span
                        className={
                          r.severity === "broken"
                            ? "font-medium text-red-700"
                            : r.severity === "warn"
                              ? "font-medium text-amber-700"
                              : "text-zinc-500"
                        }
                      >
                        {SEVERITY_LABEL[r.severity]}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-600">
                      {r.platform}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      {r.method}
                    </span>{" "}
                    <span className="font-mono text-xs">{r.path}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.total_calls.toLocaleString("en-US")}
                  </td>
                  <td
                    className={
                      "px-4 py-2 text-right tabular-nums " +
                      (r.severity === "broken"
                        ? "font-semibold text-red-700"
                        : "")
                    }
                  >
                    {formatRate(r.failure_rate)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                    {formatRate(r.baseline_rate)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                    {r.installs.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                    {r.top_status ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminTableFooter
        shown={win.shown}
        total={win.total}
        hasMore={win.hasMore}
        onShowMore={win.showMore}
        onShowAll={win.showAll}
        noun="endpoints"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "bad" | "warn" | "neutral";
}) {
  return (
    <div>
      <div
        className={
          "text-lg font-semibold tabular-nums " +
          (tone === "bad"
            ? "text-red-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-zinc-900")
        }
      >
        {value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
