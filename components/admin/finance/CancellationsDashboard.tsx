"use client";

// /admin/finance/cancellations: why people leave. Three tabs over two sources:
//
//   Overview  figures, endings by month, reasons, who is about to leave, the
//             uninstall survey and the latest comments. Every figure opens its
//             full list.
//   Feedback  every reason and comment from both sources.
//   People    every subscription that ended or is set to end.
//
// Stripe rows come from the admin-cancellation-stats Edge Function (only
// Stripe keeps the reason and comment from the Customer Portal); the
// anonymous uninstall survey is read straight from uninstall_feedback through
// its admin policy (063). Both load after the page renders, like Finance, so a
// slow Stripe read never blocks the console, and either can fail alone.
//
// The tab and filters live in the URL (lib/admin/cancellations.ts viewQuery),
// so a filtered list can be linked to and survives a reload.

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useClientNow } from "@/lib/admin/use-client-now";
import {
  feedbackItems,
  inPeriod,
  openTab,
  PERIODS,
  periodStart,
  viewQuery,
  type Tab,
  type View,
} from "@/lib/admin/cancellations";
import type {
  AdminCancellationStats,
  AdminUninstallFeedback,
} from "@/lib/types/admin";
import { CancellationsOverview } from "@/components/admin/finance/CancellationsOverview";
import { CancellationsFeedback } from "@/components/admin/finance/CancellationsFeedback";
import { CancellationsPeople } from "@/components/admin/finance/CancellationsPeople";
import { Segmented } from "@/components/admin/finance/CancellationsUi";

type Load<T> = { data: T } | { error: string } | null;

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "feedback", label: "Feedback" },
  { key: "people", label: "People" },
];

async function fetchStats(): Promise<Exclude<Load<AdminCancellationStats>, null>> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Sign in again to load cancellations." };
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-cancellation-stats`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );
    const body = (await res.json().catch(() => null)) as
      | (AdminCancellationStats & { error?: string })
      | null;
    if (!res.ok || !body || body.error) {
      return {
        error:
          body?.error === "mfa_required"
            ? "Verify your MFA code to see cancellations."
            : "Couldn't load cancellations from Stripe.",
      };
    }
    return { data: body };
  } catch {
    return { error: "Couldn't load cancellations from Stripe." };
  }
}

async function fetchSurvey(): Promise<Exclude<Load<AdminUninstallFeedback[]>, null>> {
  const { data, error } = await createBrowserClient()
    .from("uninstall_feedback")
    .select("id, created_at, reason, comment, version, locale")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return { error: "Couldn't load the uninstall survey." };
  return { data: (data ?? []) as AdminUninstallFeedback[] };
}

function sinceLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CancellationsDashboard({ initialView }: { initialView: View }) {
  const [view, setViewState] = useState(initialView);
  const [stats, setStats] = useState<Load<AdminCancellationStats>>(null);
  const [survey, setSurvey] = useState<Load<AdminUninstallFeedback[]>>(null);
  // Bumped by Refresh to run the load again.
  const [reload, setReload] = useState(0);
  const now = useClientNow();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchStats().then((next) => {
      if (!cancelled) setStats(next);
    });
    void fetchSurvey().then((next) => {
      if (!cancelled) setSurvey(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function setView(next: View) {
    setViewState(next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${viewQuery(next)}`,
    );
  }

  function open(tab: Tab, filters: Partial<View> = {}) {
    setView(openTab(view, tab, filters));
    scroller.current?.scrollTo({ top: 0 });
  }

  const data = stats && "data" in stats ? stats.data : null;
  const surveyRows = useMemo(
    () => (survey && "data" in survey ? survey.data : []),
    [survey],
  );
  const surveyError = survey && "error" in survey ? survey.error : null;
  const items = useMemo(
    () => feedbackItems(data?.rows ?? [], surveyRows),
    [data, surveyRows],
  );
  const start = now === null ? null : periodStart(view.period, now);
  // Both loads have answered (either may have failed) and the clock is real.
  const ready = stats !== null && survey !== null && now !== null;
  const counts = {
    feedback: items.filter(
      (x) => start === null || x.counted_at === null || x.counted_at >= start,
    ).length,
    people: (data?.rows ?? []).filter((r) => inPeriod(r, start)).length,
  };
  // Only read once `ready`, which needs a real clock.
  const nowMs = now ?? 0;

  const periodLabel =
    view.period === "all"
      ? data?.since
        ? `Since ${sinceLabel(data.since)}`
        : "All time"
      : `Last ${view.period === "30d" ? 30 : 90} days`;

  function onRedacted(id: string) {
    setSurvey((prev) =>
      prev && "data" in prev
        ? {
            data: prev.data.map((r) => (r.id === id ? { ...r, comment: null } : r)),
          }
        : prev,
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          <span className="font-normal text-zinc-400">Finance / </span>
          Cancellations
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label="Period"
            value={view.period}
            options={PERIODS}
            onChange={(period) => setView({ ...view, period })}
          />
          <button
            type="button"
            onClick={() => {
              setStats(null);
              setSurvey(null);
              setReload((n) => n + 1);
            }}
            className="rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
          >
            Refresh
          </button>
        </div>
      </header>

      <nav
        role="tablist"
        aria-label="Cancellations views"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4"
      >
        {TAB_LABELS.map((t) => {
          const count =
            !ready || !data || t.key === "overview" ? null : counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={view.tab === t.key}
              onClick={() => view.tab !== t.key && open(t.key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-xs ${
                view.tab === t.key
                  ? "border-zinc-900 font-medium text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {t.label}
              {count !== null && (
                <span className="ml-1.5 tabular-nums text-zinc-400">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        {!ready && (
          <p className="p-4 text-sm text-zinc-500">Loading from Stripe...</p>
        )}
        {ready && stats && "error" in stats && (
          <p className="px-4 pt-4 text-sm text-red-600">{stats.error}</p>
        )}
        {ready && data && view.tab === "overview" && (
          <div className="mx-auto max-w-7xl p-4">
            <CancellationsOverview
              stats={data}
              survey={surveyRows}
              surveyError={surveyError}
              items={items}
              start={start}
              now={nowMs}
              periodLabel={periodLabel}
              onOpen={open}
            />
          </div>
        )}
        {ready && data && view.tab === "feedback" && (
          <CancellationsFeedback
            items={items}
            surveyError={surveyError}
            view={view}
            start={start}
            onChange={setView}
            onRedacted={onRedacted}
          />
        )}
        {ready && data && view.tab === "people" && (
          <CancellationsPeople
            rows={data.rows}
            currency={data.currency}
            view={view}
            start={start}
            now={nowMs}
            onChange={setView}
          />
        )}
      </div>
    </div>
  );
}
