import { describe, expect, it } from "vitest";
import {
  daysUntil,
  DEFAULT_VIEW,
  endingsByMonth,
  feedbackItems,
  filterFeedback,
  filterPeople,
  inPeriod,
  monthsBetween,
  openTab,
  parseView,
  periodStart,
  stripeReason,
  stripeReasonCounts,
  summarise,
  surveyReason,
  surveyReasonCounts,
  viewQuery,
} from "../lib/admin/cancellations";
import type { AdminCancellation, AdminUninstallFeedback } from "../lib/types/admin";

const NOW = Date.parse("2026-11-24T12:00:00Z");

let n = 0;
const row = (over: Partial<AdminCancellation>): AdminCancellation => ({
  id: `sub_${++n}`,
  user_id: `user_${n}`,
  email: `person${n}@example.com`,
  tier: "starter",
  kind: "trial",
  state: "ended",
  reason: null,
  comment: null,
  requested_at: "2026-11-01T00:00:00.000Z",
  ends_at: "2026-11-15T00:00:00.000Z",
  day: 0,
  mrr: null,
  ...over,
});

const answer = (over: Partial<AdminUninstallFeedback>): AdminUninstallFeedback => ({
  id: `fb_${++n}`,
  created_at: "2026-11-20T00:00:00.000Z",
  reason: "not_working",
  comment: null,
  version: "1.2.7",
  locale: "en",
  ...over,
});

describe("reasons", () => {
  it("maps both sources onto one list", () => {
    expect(stripeReason("too_expensive")).toBe("price");
    expect(surveyReason("too_expensive")).toBe("price");
    expect(stripeReason("low_quality")).toBe("broken");
    expect(surveyReason("not_working")).toBe("broken");
    expect(stripeReason("switched_service")).toBe("switched");
    expect(surveyReason("switched_tool")).toBe("switched");
    expect(stripeReason("missing_features")).toBe("missing_feature");
    expect(surveyReason("missing_feature")).toBe("missing_feature");
  });

  it("calls a blank Stripe answer No answer and an unknown code Other", () => {
    expect(stripeReason(null)).toBe("none");
    expect(stripeReason("something_new")).toBe("other");
    expect(surveyReason("something_new")).toBe("other");
  });

  it("counts reasons for choices only, most common first, No answer last", () => {
    const rows = [
      row({ reason: null }),
      row({ reason: null }),
      row({ reason: null }),
      row({ reason: "too_expensive" }),
      row({ reason: "too_expensive", kind: "paying" }),
      row({ reason: "unused" }),
      row({ kind: "failed" }),
    ];
    expect(stripeReasonCounts(rows, null).map((r) => [r.key, r.parts, r.total])).toEqual([
      ["price", [1, 1], 2],
      ["unused", [1, 0], 1],
      ["none", [3, 0], 3],
    ]);
  });

  it("counts survey answers inside the period", () => {
    const survey = [
      answer({ reason: "not_working" }),
      answer({ reason: "not_working" }),
      answer({ reason: "other", created_at: "2026-07-01T00:00:00.000Z" }),
    ];
    const start = periodStart("30d", NOW);
    expect(surveyReasonCounts(survey, start).map((r) => [r.key, r.total])).toEqual([["broken", 2]]);
  });
});

describe("periods", () => {
  it("starts 30 and 90 days back, or nowhere for all time", () => {
    expect(periodStart("all", NOW)).toBeNull();
    expect(periodStart("30d", NOW)).toBe("2026-10-25T12:00:00.000Z");
    expect(periodStart("90d", NOW)).toBe("2026-08-26T12:00:00.000Z");
  });

  it("keeps a cancellation set to end in every period", () => {
    const start = periodStart("30d", NOW);
    expect(inPeriod(row({ state: "scheduled", ends_at: "2026-12-01T00:00:00.000Z" }), start)).toBe(true);
    expect(inPeriod(row({ ends_at: "2026-09-01T00:00:00.000Z" }), start)).toBe(false);
    expect(inPeriod(row({ ends_at: "2026-11-01T00:00:00.000Z" }), start)).toBe(true);
  });

  it("rounds days left up and never below zero", () => {
    expect(daysUntil("2026-11-25T00:00:00.000Z", NOW)).toBe(1);
    expect(daysUntil("2026-11-26T13:00:00.000Z", NOW)).toBe(3);
    expect(daysUntil("2026-11-20T00:00:00.000Z", NOW)).toBe(0);
  });
});

describe("summarise", () => {
  it("splits endings by kind and keeps scheduled ones apart", () => {
    const rows = [
      row({ kind: "trial" }),
      row({ kind: "trial", ends_at: "2026-08-01T00:00:00.000Z" }),
      row({ kind: "paying", mrr: 799 }),
      row({ kind: "failed", mrr: 1499 }),
      row({ state: "scheduled", kind: "trial" }),
      row({ state: "scheduled", kind: "paying", mrr: 2499 }),
    ];
    const trials = [
      { at: "2026-11-15T00:00:00.000Z" },
      { at: "2026-11-16T00:00:00.000Z" },
      { at: "2026-11-17T00:00:00.000Z" },
      { at: "2026-08-01T00:00:00.000Z" },
    ];
    const s = summarise(rows, trials, periodStart("30d", NOW));
    expect(s.trialsEnded).toBe(1);
    expect(s.trialsFinished).toBe(3);
    expect(s.trialsEndedShare).toBe(33);
    expect(s.paying).toEqual({ count: 1, mrr: 799 });
    expect(s.failed).toEqual({ count: 1, mrr: 1499 });
    expect(s.scheduled).toEqual({ count: 2, trials: 1, paying: 1, mrr: 2499 });

    expect(summarise([], [], null).trialsEndedShare).toBeNull();
  });
});

describe("endingsByMonth", () => {
  it("lists months across a year boundary", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("fills every month from the first ending to now, empty ones included", () => {
    const rows = [
      row({ ends_at: "2026-08-20T00:00:00.000Z" }),
      row({ ends_at: "2026-10-02T00:00:00.000Z", kind: "paying" }),
      row({ ends_at: "2026-10-03T00:00:00.000Z", kind: "failed" }),
      row({ state: "scheduled", ends_at: "2026-12-01T00:00:00.000Z" }),
    ];
    expect(endingsByMonth(rows, null, NOW)).toEqual([
      { month: "2026-08", trial: 1, paying: 0, failed: 0 },
      { month: "2026-09", trial: 0, paying: 0, failed: 0 },
      { month: "2026-10", trial: 0, paying: 1, failed: 1 },
      { month: "2026-11", trial: 0, paying: 0, failed: 0 },
    ]);
    expect(endingsByMonth([], null, NOW)).toEqual([]);
  });

  it("keeps only the last months when there are too many", () => {
    const rows = [row({ ends_at: "2024-01-10T00:00:00.000Z" })];
    const months = endingsByMonth(rows, null, NOW, 12);
    expect(months).toHaveLength(12);
    expect(months[0].month).toBe("2025-12");
    expect(months.every((m) => m.trial === 0)).toBe(true);
  });
});

describe("feedback", () => {
  const rows = [
    row({ id: "a", reason: "too_expensive", comment: "Too much", requested_at: "2026-11-10T00:00:00.000Z" }),
    row({ id: "b", kind: "paying", reason: "unused", requested_at: "2026-11-12T00:00:00.000Z", ends_at: "2026-09-01T00:00:00.000Z" }),
    row({ id: "c", kind: "failed" }),
    row({ id: "d", state: "scheduled", reason: null, requested_at: "2026-11-22T00:00:00.000Z" }),
  ];
  const survey = [
    answer({ id: "s1", comment: "Relist broke", created_at: "2026-11-21T00:00:00.000Z" }),
    answer({ id: "s2", reason: "stopped_selling", created_at: "2026-11-05T00:00:00.000Z" }),
  ];
  const items = feedbackItems(rows, survey);

  it("merges both sources newest first and leaves out failed payments", () => {
    expect(items.map((x) => x.id)).toEqual(["d", "s1", "b", "a", "s2"]);
  });

  it("shows only written comments by default", () => {
    const v = openTab(DEFAULT_VIEW, "feedback");
    expect(filterFeedback(items, v, null).map((x) => x.id)).toEqual(["s1", "a"]);
  });

  it("filters by source, reason, kind and search", () => {
    const all = openTab(DEFAULT_VIEW, "feedback", { commented: false });
    expect(filterFeedback(items, { ...all, source: "survey" }, null).map((x) => x.id)).toEqual(["s1", "s2"]);
    expect(filterFeedback(items, { ...all, reason: "price" }, null).map((x) => x.id)).toEqual(["a"]);
    expect(filterFeedback(items, { ...all, kind: "paying" }, null).map((x) => x.id)).toEqual(["b"]);
    expect(filterFeedback(items, { ...all, q: "RELIST" }, null).map((x) => x.id)).toEqual(["s1"]);
    expect(filterFeedback(items, { ...all, q: `person` }, null).map((x) => x.source)).toEqual(["stripe", "stripe", "stripe"]);
  });

  it("filters a period the way the overview counts it", () => {
    const all = openTab(DEFAULT_VIEW, "feedback", { commented: false });
    // b ended in September; d is still set to end, so it always counts.
    expect(filterFeedback(items, all, periodStart("30d", NOW)).map((x) => x.id)).toEqual(["d", "s1", "a", "s2"]);
  });
});

describe("people", () => {
  const rows = [
    row({ id: "ended-old", ends_at: "2026-10-01T00:00:00.000Z" }),
    row({ id: "soon", state: "scheduled", ends_at: "2026-11-26T00:00:00.000Z" }),
    row({ id: "ended-new", ends_at: "2026-11-20T00:00:00.000Z", reason: "too_expensive" }),
    row({ id: "later", state: "scheduled", ends_at: "2026-12-10T00:00:00.000Z" }),
    row({ id: "failed", kind: "failed", ends_at: "2026-11-21T00:00:00.000Z" }),
  ];

  it("puts set-to-end first by date, then ended latest first", () => {
    expect(filterPeople(rows, openTab(DEFAULT_VIEW, "people"), null).map((r) => r.id)).toEqual([
      "soon",
      "later",
      "failed",
      "ended-new",
      "ended-old",
    ]);
  });

  it("leaves failed payments out of a reason filter, even No answer", () => {
    const v = openTab(DEFAULT_VIEW, "people", { reason: "none" });
    expect(filterPeople(rows, v, null).map((r) => r.id)).toEqual(["soon", "later", "ended-old"]);
  });

  it("filters by status and kind", () => {
    expect(filterPeople(rows, openTab(DEFAULT_VIEW, "people", { status: "scheduled" }), null)).toHaveLength(2);
    expect(filterPeople(rows, openTab(DEFAULT_VIEW, "people", { kind: "failed" }), null).map((r) => r.id)).toEqual(["failed"]);
  });
});

describe("view in the URL", () => {
  it("round-trips a filtered view and leaves defaults out", () => {
    const v = openTab(DEFAULT_VIEW, "feedback", { source: "stripe", reason: "price", commented: false, q: "too much" });
    const q = viewQuery({ ...v, period: "30d" });
    expect(q).toBe("?tab=feedback&period=30d&source=stripe&comments=all&reason=price&q=too+much");
    expect(parseView(Object.fromEntries(new URLSearchParams(q)))).toEqual({ ...v, period: "30d" });
    expect(viewQuery(DEFAULT_VIEW)).toBe("");
  });

  it("drops other tabs' filters from the query", () => {
    expect(viewQuery({ ...DEFAULT_VIEW, source: "survey", status: "ended", reason: "price" })).toBe("");
  });

  it("ignores values it does not know", () => {
    expect(parseView({ tab: "nope", period: "7d", reason: "<script>", kind: "free" })).toEqual(DEFAULT_VIEW);
  });

  it("clears a kind Feedback cannot show", () => {
    expect(parseView({ tab: "feedback", source: "survey", kind: "trial" }).kind).toBe("");
    expect(parseView({ tab: "feedback", kind: "failed" }).kind).toBe("");
    expect(parseView({ tab: "people", kind: "failed" }).kind).toBe("failed");
  });

  it("opens a tab fresh but keeps the period", () => {
    const v = { ...DEFAULT_VIEW, period: "90d" as const, q: "old search", reason: "price" as const };
    expect(openTab(v, "people", { status: "scheduled" })).toEqual({
      ...DEFAULT_VIEW,
      tab: "people",
      period: "90d",
      status: "scheduled",
    });
  });
});
