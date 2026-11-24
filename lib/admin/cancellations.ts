// Folding for /admin/finance/cancellations. Pure: rows from the
// admin-cancellation-stats Edge Function and uninstall_feedback in, the page's
// numbers and lists out, pinned by tests/cancellations.test.ts.
//
// Two sources, one reason list. Stripe's Customer Portal and the uninstall
// survey use different codes for the same answer (low_quality against
// not_working, switched_service against switched_tool), so both map onto
// ReasonKey and every chart, filter and link works on that.

import type {
  AdminCancellation,
  AdminUninstallFeedback,
} from "@/lib/types/admin";

export type ReasonKey =
  | "price"
  | "unused"
  | "stopped_selling"
  | "missing_feature"
  | "broken"
  | "too_complex"
  | "switched"
  | "customer_service"
  | "other"
  | "none";

// Display order, for the reason filters.
export const REASONS: { key: ReasonKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "unused", label: "Not using it" },
  { key: "stopped_selling", label: "Stopped selling" },
  { key: "missing_feature", label: "Missing a feature" },
  { key: "broken", label: "Something didn't work" },
  { key: "too_complex", label: "Too complicated" },
  { key: "switched", label: "Switched tool" },
  { key: "customer_service", label: "Customer service" },
  { key: "other", label: "Other" },
  { key: "none", label: "No answer" },
];

const LABEL = new Map(REASONS.map((r) => [r.key, r.label]));
const ORDER = new Map(REASONS.map((r, i) => [r.key, i]));

export const reasonLabel = (key: ReasonKey): string => LABEL.get(key) ?? "Other";

// cancellation_details.feedback: every code the Customer Portal can offer.
const STRIPE_REASON: Record<string, ReasonKey> = {
  too_expensive: "price",
  unused: "unused",
  missing_features: "missing_feature",
  low_quality: "broken",
  too_complex: "too_complex",
  switched_service: "switched",
  customer_service: "customer_service",
  other: "other",
};

// uninstall_feedback.reason: the codes 013's CHECK allows.
const SURVEY_REASON: Record<string, ReasonKey> = {
  too_expensive: "price",
  stopped_selling: "stopped_selling",
  missing_feature: "missing_feature",
  not_working: "broken",
  switched_tool: "switched",
  other: "other",
};

/** A Stripe feedback code as a reason. No code is "No answer"; an unknown one is Other. */
export function stripeReason(code: string | null): ReasonKey {
  if (code === null) return "none";
  return STRIPE_REASON[code] ?? "other";
}

export function surveyReason(code: string): ReasonKey {
  return SURVEY_REASON[code] ?? "other";
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export type Period = "30d" | "90d" | "all";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

const DAY_MS = 86_400_000;

/** Where a period starts, as an ISO time, or null for all time. */
export function periodStart(period: Period, now: number): string | null {
  if (period === "all") return null;
  return new Date(now - (period === "30d" ? 30 : 90) * DAY_MS).toISOString();
}

/**
 * Whether a cancellation counts in a period. One set to end is happening now,
 * so every period keeps it; one that ended counts by when it ended.
 */
export function inPeriod(r: AdminCancellation, start: string | null): boolean {
  return r.state === "scheduled" || start === null || r.ends_at >= start;
}

/** Whole days from now until an ISO time, rounded up and never below zero. */
export function daysUntil(iso: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY_MS));
}

// ---------------------------------------------------------------------------
// Summary tiles
// ---------------------------------------------------------------------------

export type CancellationSummary = {
  trialsEnded: number;
  trialsFinished: number;
  // Trials that ended unpaid as a share of every trial that finished, or null
  // when none finished.
  trialsEndedShare: number | null;
  paying: { count: number; mrr: number };
  failed: { count: number; mrr: number };
  scheduled: { count: number; trials: number; paying: number; mrr: number };
};

export function summarise(
  rows: AdminCancellation[],
  trialsFinished: { at: string }[],
  start: string | null,
): CancellationSummary {
  const s: CancellationSummary = {
    trialsEnded: 0,
    trialsFinished: 0,
    trialsEndedShare: null,
    paying: { count: 0, mrr: 0 },
    failed: { count: 0, mrr: 0 },
    scheduled: { count: 0, trials: 0, paying: 0, mrr: 0 },
  };
  for (const r of rows) {
    if (r.state === "scheduled") {
      s.scheduled.count++;
      if (r.kind === "trial") s.scheduled.trials++;
      else s.scheduled.paying++;
      s.scheduled.mrr += r.mrr ?? 0;
      continue;
    }
    if (!inPeriod(r, start)) continue;
    if (r.kind === "trial") s.trialsEnded++;
    else {
      const to = r.kind === "paying" ? s.paying : s.failed;
      to.count++;
      to.mrr += r.mrr ?? 0;
    }
  }
  s.trialsFinished = trialsFinished.filter(
    (t) => start === null || t.at >= start,
  ).length;
  s.trialsEndedShare =
    s.trialsFinished > 0
      ? Math.round((s.trialsEnded / s.trialsFinished) * 100)
      : null;
  return s;
}

// ---------------------------------------------------------------------------
// Endings by month
// ---------------------------------------------------------------------------

export type MonthEndings = {
  month: string;
  trial: number;
  paying: number;
  failed: number;
};

const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/** Every month from `from` to `to` ("2026-08"), oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Cancellations that ended, by the month they ended and how, from the period's
 * start (or the first one) to this month, at most `max` months.
 */
export function endingsByMonth(
  rows: AdminCancellation[],
  start: string | null,
  now: number,
  max = 12,
): MonthEndings[] {
  const ended = rows.filter((r) => r.state === "ended" && inPeriod(r, start));
  if (ended.length === 0) return [];
  const first =
    start ?? ended.reduce((m, r) => (r.ends_at < m ? r.ends_at : m), ended[0].ends_at);
  const months = monthsBetween(first.slice(0, 7), monthOf(now)).slice(-max);
  const by = new Map(
    months.map((month) => [month, { month, trial: 0, paying: 0, failed: 0 }]),
  );
  for (const r of ended) {
    // Months before the window (all time, past `max`) have no entry.
    const m = by.get(r.ends_at.slice(0, 7));
    if (m) m[r.kind]++;
  }
  return [...by.values()];
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

export type ReasonCount = {
  key: ReasonKey;
  label: string;
  // Stripe: [trial, paying]. Survey: [answers].
  parts: number[];
  total: number;
};

// Most common first, No answer always last, ties in display order.
function sortReasons(list: ReasonCount[]): ReasonCount[] {
  return list.sort((a, b) => {
    if ((a.key === "none") !== (b.key === "none")) return a.key === "none" ? 1 : -1;
    return b.total - a.total || ORDER.get(a.key)! - ORDER.get(b.key)!;
  });
}

/** Reasons for the cancellations people chose (not failed payments) in a period. */
export function stripeReasonCounts(
  rows: AdminCancellation[],
  start: string | null,
): ReasonCount[] {
  const by = new Map<ReasonKey, ReasonCount>();
  for (const r of rows) {
    if (r.kind === "failed" || !inPeriod(r, start)) continue;
    const key = stripeReason(r.reason);
    const c = by.get(key) ?? { key, label: reasonLabel(key), parts: [0, 0], total: 0 };
    c.parts[r.kind === "trial" ? 0 : 1]++;
    c.total++;
    by.set(key, c);
  }
  return sortReasons([...by.values()]);
}

export function surveyReasonCounts(
  survey: AdminUninstallFeedback[],
  start: string | null,
): ReasonCount[] {
  const by = new Map<ReasonKey, ReasonCount>();
  for (const s of survey) {
    if (start !== null && s.created_at < start) continue;
    const key = surveyReason(s.reason);
    const c = by.get(key) ?? { key, label: reasonLabel(key), parts: [0], total: 0 };
    c.parts[0]++;
    c.total++;
    by.set(key, c);
  }
  return sortReasons([...by.values()]);
}

// ---------------------------------------------------------------------------
// Feedback: every answer from both sources
// ---------------------------------------------------------------------------

export type FeedbackItem = {
  id: string;
  source: "stripe" | "survey";
  reason: ReasonKey;
  comment: string | null;
  // When the answer was given: the cancel request, or the survey submission.
  at: string;
  // What a period filters on, matching inPeriod(): null for a cancellation
  // still set to end (always counted), else when it ended or was submitted.
  counted_at: string | null;
  // Stripe only.
  kind: "trial" | "paying" | null;
  user_id: string | null;
  email: string | null;
  tier: string | null;
  // Survey only.
  version: string | null;
  locale: string | null;
};

/** Every answer, newest first. Failed payments are not answers, so they are left out. */
export function feedbackItems(
  rows: AdminCancellation[],
  survey: AdminUninstallFeedback[],
): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  for (const r of rows) {
    if (r.kind === "failed") continue;
    items.push({
      id: r.id,
      source: "stripe",
      reason: stripeReason(r.reason),
      comment: r.comment,
      at: r.requested_at,
      counted_at: r.state === "scheduled" ? null : r.ends_at,
      kind: r.kind,
      user_id: r.user_id,
      email: r.email,
      tier: r.tier,
      version: null,
      locale: null,
    });
  }
  for (const s of survey) {
    items.push({
      id: s.id,
      source: "survey",
      reason: surveyReason(s.reason),
      comment: s.comment,
      at: s.created_at,
      counted_at: s.created_at,
      kind: null,
      user_id: null,
      email: null,
      tier: null,
      version: s.version,
      locale: s.locale,
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

// ---------------------------------------------------------------------------
// View: the tab and filters, kept in the URL so links land filtered
// ---------------------------------------------------------------------------

export type Tab = "overview" | "feedback" | "people";

export type View = {
  tab: Tab;
  period: Period;
  // Feedback: which source.
  source: "all" | "stripe" | "survey";
  // People: set to end, ended, or both.
  status: "all" | "scheduled" | "ended";
  reason: ReasonKey | "";
  kind: "" | "trial" | "paying" | "failed";
  // Feedback: only answers with a written comment.
  commented: boolean;
  q: string;
};

export const DEFAULT_VIEW: View = {
  tab: "overview",
  period: "all",
  source: "all",
  status: "all",
  reason: "",
  kind: "",
  commented: true,
  q: "",
};

const TABS: readonly Tab[] = ["overview", "feedback", "people"];
const PERIOD_KEYS: readonly Period[] = ["30d", "90d", "all"];
const SOURCES = ["all", "stripe", "survey"] as const;
const STATUSES = ["all", "scheduled", "ended"] as const;
const KINDS = ["", "trial", "paying", "failed"] as const;
const REASON_KEYS = REASONS.map((r) => r.key);

type Params = Record<string, string | string[] | undefined>;

function pick<T extends string>(raw: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function parseView(params: Params): View {
  const tab = pick(params.tab, TABS, "overview");
  const source = pick(params.source, SOURCES, "all");
  const kind = pick(params.kind, KINDS, "");
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return {
    tab,
    period: pick(params.period, PERIOD_KEYS, "all"),
    source,
    status: pick(params.status, STATUSES, "all"),
    reason: pick<ReasonKey | "">(params.reason, REASON_KEYS, ""),
    // Survey answers have no kind, and Feedback has no failed payments.
    kind: tab === "feedback" && (source === "survey" || kind === "failed") ? "" : kind,
    commented: (Array.isArray(params.comments) ? params.comments[0] : params.comments) !== "all",
    q: (q ?? "").slice(0, 100),
  };
}

/** The query string for a view, leaving out defaults and other tabs' filters. */
export function viewQuery(v: View): string {
  const p = new URLSearchParams();
  if (v.tab !== "overview") p.set("tab", v.tab);
  if (v.period !== "all") p.set("period", v.period);
  if (v.tab === "feedback") {
    if (v.source !== "all") p.set("source", v.source);
    if (!v.commented) p.set("comments", "all");
  }
  if (v.tab === "people" && v.status !== "all") p.set("status", v.status);
  if (v.tab !== "overview") {
    if (v.reason) p.set("reason", v.reason);
    if (v.kind) p.set("kind", v.kind);
    if (v.q.trim()) p.set("q", v.q.trim());
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** A tab opened fresh with some filters set, keeping the period. */
export function openTab(v: View, tab: Tab, filters: Partial<View> = {}): View {
  return { ...DEFAULT_VIEW, period: v.period, tab, ...filters };
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export function filterFeedback(
  items: FeedbackItem[],
  v: View,
  start: string | null,
): FeedbackItem[] {
  const q = v.q.trim().toLowerCase();
  return items.filter((x) => {
    if (start !== null && x.counted_at !== null && x.counted_at < start) return false;
    if (v.source !== "all" && x.source !== v.source) return false;
    if (v.reason && x.reason !== v.reason) return false;
    if (v.kind && x.kind !== v.kind) return false;
    if (v.commented && !x.comment) return false;
    if (q && !`${x.comment ?? ""} ${x.email ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** People in a view: set to end first (soonest first), then ended (latest first). */
export function filterPeople(
  rows: AdminCancellation[],
  v: View,
  start: string | null,
): AdminCancellation[] {
  const q = v.q.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (!inPeriod(r, start)) return false;
      if (v.status !== "all" && r.state !== v.status) return false;
      if (v.kind && r.kind !== v.kind) return false;
      // A failed payment gave no reason, so a reason filter leaves it out.
      if (v.reason && (r.kind === "failed" || stripeReason(r.reason) !== v.reason)) return false;
      if (q && !`${r.email ?? ""} ${r.comment ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "scheduled" ? -1 : 1;
      const order = a.ends_at < b.ends_at ? -1 : a.ends_at > b.ends_at ? 1 : 0;
      return a.state === "scheduled" ? order : -order;
    });
}
