"use client";

// The People tab of /admin/finance/cancellations: every subscription that
// ended or is set to end, set to end first (soonest at the top), then ended
// (latest first). Each email opens the user drawer.

import { useMemo } from "react";
import { UserEmailLink } from "@/components/admin/UserEmailLink";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";
import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { downloadCsv } from "@/components/admin/insights/ui";
import {
  daysUntil,
  filterPeople,
  inPeriod,
  openTab,
  REASONS,
  reasonLabel,
  stripeReason,
  type ReasonKey,
  type View,
} from "@/lib/admin/cancellations";
import type { AdminCancellation } from "@/lib/types/admin";
import { day, money } from "@/components/admin/finance/FinanceParts";
import {
  buttonClass,
  EndsIn,
  FilterBar,
  KIND,
  KindChip,
  searchClass,
  Segmented,
  selectClass,
} from "@/components/admin/finance/CancellationsUi";

const PAGE = 50;

// The survey's own reason has no Stripe code, so it never matches a person.
const PEOPLE_REASONS = REASONS.filter((r) => r.key !== "stopped_selling");

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CancellationsPeople({
  rows,
  currency,
  view,
  start,
  now,
  onChange,
}: {
  rows: AdminCancellation[];
  currency: string;
  view: View;
  start: string | null;
  now: number;
  onChange: (next: View) => void;
}) {
  const filtered = useMemo(
    () => filterPeople(rows, view, start),
    [rows, view, start],
  );
  const windowed = useWindowedRows(filtered, PAGE);
  const counts = useMemo(() => {
    const inP = rows.filter((r) => inPeriod(r, start));
    return {
      all: inP.length,
      scheduled: inP.filter((r) => r.state === "scheduled").length,
      ended: inP.filter((r) => r.state === "ended").length,
    };
  }, [rows, start]);

  const set = (patch: Partial<View>) => onChange({ ...view, ...patch });

  function exportCsv() {
    downloadCsv(
      `cancellations-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Email", "Plan", "Kind", "Status", "Asked on", "Ends or ended", "Day of subscription", "Reason", "Comment", `MRR (${currency.toUpperCase()})`],
      filtered.map((r) => [
        r.email,
        cap(r.tier),
        KIND[r.kind].label,
        r.state === "scheduled" ? "Set to cancel" : "Ended",
        r.requested_at.slice(0, 10),
        r.ends_at.slice(0, 10),
        r.kind === "failed" ? null : r.day,
        r.kind === "failed" ? null : reasonLabel(stripeReason(r.reason)),
        r.comment,
        r.mrr === null ? null : (r.mrr / 100).toFixed(2),
      ]),
    );
  }

  return (
    <div>
      <FilterBar>
        <Segmented
          label="Status"
          value={view.status}
          options={[
            { key: "all", label: "All", count: counts.all },
            { key: "scheduled", label: "Set to cancel", count: counts.scheduled },
            { key: "ended", label: "Ended", count: counts.ended },
          ]}
          onChange={(status) => set({ status })}
        />
        <select
          aria-label="Kind"
          value={view.kind}
          onChange={(e) => set({ kind: e.target.value as View["kind"] })}
          className={selectClass}
        >
          <option value="">All kinds</option>
          <option value="trial">Trial</option>
          <option value="paying">Paying</option>
          <option value="failed">Payment failed</option>
        </select>
        <select
          aria-label="Reason"
          value={view.reason}
          onChange={(e) => set({ reason: e.target.value as ReasonKey | "" })}
          className={selectClass}
        >
          <option value="">All reasons</option>
          {PEOPLE_REASONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={view.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search email or comment"
          aria-label="Search email or comment"
          className={searchClass}
        />
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className={`${buttonClass} md:ml-auto`}
        >
          Export CSV
        </button>
      </FilterBar>

      <p className="px-4 py-2 text-xs text-zinc-500">
        {filtered.length} of {counts.all} subscriptions
      </p>

      {filtered.length ? (
        <div className="overflow-x-auto border-y border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-2 py-2 font-medium">Plan</th>
                <th className="px-2 py-2 font-medium">Kind</th>
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Reason</th>
                <th className="px-2 py-2 font-medium">Comment</th>
                <th className="px-2 py-2 font-medium" title="Days from the subscription's start to the cancel request. Day 0 is the day it started.">
                  Decided on
                </th>
                <th className="px-4 py-2 text-right font-medium" title="The last full-price payment, per month, as Stripe settled it.">
                  MRR
                </th>
              </tr>
            </thead>
            <tbody>
              {windowed.windowed.map((r) => (
                <tr key={r.id} className="border-t border-[var(--admin-border)] align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.user_id || r.email ? (
                      <UserEmailLink userId={r.user_id} email={r.email} />
                    ) : (
                      <span className="text-zinc-400">Deleted customer</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-zinc-700">{cap(r.tier)}</td>
                  <td className="px-2 py-2">
                    <KindChip kind={r.kind} />
                  </td>
                  <td className="px-2 py-2">
                    {r.state === "scheduled" ? (
                      <EndsIn days={daysUntil(r.ends_at, now)} />
                    ) : (
                      <span className="whitespace-nowrap text-zinc-500">Ended {day(r.ends_at)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-zinc-700">
                    {r.kind === "failed" ? (
                      <span className="text-zinc-400">None</span>
                    ) : (
                      reasonLabel(stripeReason(r.reason))
                    )}
                  </td>
                  <td className="min-w-56 max-w-sm px-2 py-2 text-zinc-700 [overflow-wrap:anywhere]">
                    {r.comment ?? <span className="text-zinc-400">None</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-zinc-500">
                    {r.kind === "failed" ? "-" : `Day ${r.day}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs">
                    {r.mrr === null ? "-" : money(r.mrr, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2 px-4 py-8 text-center text-sm text-zinc-500">
          <p>No subscriptions match these filters.</p>
          <button
            type="button"
            onClick={() => onChange(openTab(view, "people"))}
            className={buttonClass}
          >
            Clear filters
          </button>
        </div>
      )}
      <AdminTableFooter
        shown={windowed.shown}
        total={windowed.total}
        hasMore={windowed.hasMore}
        onShowMore={windowed.showMore}
        onShowAll={windowed.showAll}
        noun="subscriptions"
      />
    </div>
  );
}
