"use client";

// The Feedback tab of /admin/finance/cancellations: every reason and comment,
// from Stripe's Customer Portal and from the uninstall survey, newest first.
//
// Stripe answers belong to an account and open the user drawer. Survey answers
// are anonymous (013_uninstall_feedback.sql), and their comments can be
// removed: docs/GDPR.md promises to review them and take out any personal
// details people volunteer. Removing is irreversible, so it asks for step-up
// reauth like the console's other destructive actions; the RPC writes the
// audit entry without copying the comment.

import { useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { requireReauth } from "@/lib/admin/reauth";
import { ReauthModal } from "@/components/admin/ReauthModal";
import { UserEmailLink } from "@/components/admin/UserEmailLink";
import { AdminTableFooter } from "@/components/admin/AdminTableFooter";
import { useWindowedRows } from "@/lib/admin/use-windowed-rows";
import { downloadCsv } from "@/components/admin/insights/ui";
import {
  filterFeedback,
  openTab,
  REASONS,
  reasonLabel,
  type FeedbackItem,
  type ReasonKey,
  type View,
} from "@/lib/admin/cancellations";
import { day } from "@/components/admin/finance/FinanceParts";
import {
  buttonClass,
  FilterBar,
  KIND,
  KindChip,
  ReasonChip,
  searchClass,
  Segmented,
  selectClass,
} from "@/components/admin/finance/CancellationsUi";

const PAGE = 50;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CancellationsFeedback({
  items,
  surveyError,
  view,
  start,
  onChange,
  onRedacted,
}: {
  items: FeedbackItem[];
  surveyError: string | null;
  view: View;
  start: string | null;
  onChange: (next: View) => void;
  onRedacted: (id: string) => void;
}) {
  const filtered = useMemo(
    () => filterFeedback(items, view, start),
    [items, view, start],
  );
  const rows = useWindowedRows(filtered, PAGE);
  const counts = useMemo(() => {
    const inPeriod = items.filter(
      (x) => start === null || x.counted_at === null || x.counted_at >= start,
    );
    return {
      all: inPeriod.length,
      stripe: inPeriod.filter((x) => x.source === "stripe").length,
      survey: inPeriod.filter((x) => x.source === "survey").length,
    };
  }, [items, start]);

  const [removing, setRemoving] = useState<FeedbackItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<View>) => onChange({ ...view, ...patch });

  async function confirmRemove(secret: string) {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await requireReauth(secret);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Re-authentication failed.");
      return;
    }
    const { error: rpcError } = await createBrowserClient().rpc(
      "admin_redact_uninstall_comment",
      { p_id: removing.id },
    );
    setBusy(false);
    if (rpcError) {
      setError("Could not remove the comment. Please try again.");
      return;
    }
    onRedacted(removing.id);
    setRemoving(null);
  }

  function exportCsv() {
    downloadCsv(
      `cancellation-feedback-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Source", "Reason", "Comment", "Kind", "Plan", "Email", "Extension version", "Language"],
      filtered.map((x) => [
        x.at.slice(0, 10),
        x.source === "stripe" ? "Stripe" : "Uninstall survey",
        reasonLabel(x.reason),
        x.comment,
        x.kind ? KIND[x.kind].label : null,
        x.tier ? cap(x.tier) : null,
        x.email,
        x.version,
        x.locale,
      ]),
    );
  }

  return (
    <div>
      <FilterBar>
        <Segmented
          label="Source"
          value={view.source}
          options={[
            { key: "all", label: "All", count: counts.all },
            { key: "stripe", label: "Stripe", count: counts.stripe },
            { key: "survey", label: "Uninstall survey", count: counts.survey },
          ]}
          onChange={(source) =>
            set({ source, kind: source === "survey" ? "" : view.kind })
          }
        />
        <select
          aria-label="Reason"
          value={view.reason}
          onChange={(e) => set({ reason: e.target.value as ReasonKey | "" })}
          className={selectClass}
        >
          <option value="">All reasons</option>
          {REASONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Trial or paying"
          value={view.kind}
          disabled={view.source === "survey"}
          onChange={(e) => set({ kind: e.target.value as View["kind"] })}
          className={selectClass}
        >
          <option value="">Trial and paying</option>
          <option value="trial">Trial</option>
          <option value="paying">Paying</option>
        </select>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={view.commented}
            onChange={(e) => set({ commented: e.target.checked })}
          />
          Only with a comment
        </label>
        <input
          type="search"
          value={view.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search comments or email"
          aria-label="Search comments or email"
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

      {surveyError && (
        <p className="border-b border-[var(--admin-border)] px-4 py-2 text-xs text-red-600">
          {surveyError} Showing Stripe answers only.
        </p>
      )}
      <p className="px-4 py-2 text-xs text-zinc-500">
        {filtered.length} of {counts.all} answers
        {view.commented ? " with a written comment" : ""}
      </p>

      {filtered.length ? (
        <ul className="divide-y divide-[var(--admin-border)] border-y border-[var(--admin-border)] bg-[var(--admin-surface)]">
          {rows.windowed.map((x) => (
            <li
              key={`${x.source}-${x.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3"
            >
              <div className="min-w-0 space-y-1.5">
                {x.comment ? (
                  <p className="text-sm text-zinc-800 [overflow-wrap:anywhere]">
                    {x.comment}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400">No comment, reason only.</p>
                )}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <ReasonChip label={reasonLabel(x.reason)} />
                  {x.source === "stripe" ? (
                    <>
                      {x.kind && <KindChip kind={x.kind} />}
                      {x.tier && <span>{cap(x.tier)}</span>}
                      {x.user_id || x.email ? (
                        <UserEmailLink userId={x.user_id} email={x.email} className="text-zinc-600" />
                      ) : (
                        <span>Deleted customer</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span>Uninstall survey</span>
                      {x.version && <span>Version {x.version}</span>}
                      {x.locale && <span>{x.locale}</span>}
                      <span>Anonymous</span>
                    </>
                  )}
                  <span>{day(x.at)}</span>
                </p>
              </div>
              {x.source === "survey" && x.comment && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setRemoving(x);
                  }}
                  className="self-start rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs text-zinc-600 hover:border-red-300 hover:text-red-700"
                >
                  Remove comment
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2 px-4 py-8 text-center text-sm text-zinc-500">
          <p>No answers match these filters.</p>
          <button
            type="button"
            onClick={() => onChange(openTab(view, "feedback", { commented: false }))}
            className={buttonClass}
          >
            Clear filters
          </button>
        </div>
      )}
      <AdminTableFooter
        shown={rows.shown}
        total={rows.total}
        hasMore={rows.hasMore}
        onShowMore={rows.showMore}
        onShowAll={rows.showAll}
        noun="answers"
      />

      {removing && (
        <ReauthModal
          title="Remove this comment"
          description="The answer and its reason stay, but the comment is deleted for good. Use this for comments that include someone's personal details."
          confirmLabel="Remove comment"
          busyLabel="Removing..."
          danger
          busy={busy}
          error={error}
          onCancel={() => {
            setRemoving(null);
            setError(null);
          }}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}
