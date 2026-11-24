import { describe, expect, it } from "vitest";
import {
  classifyCancellation,
  finishedTrial,
  latestAmount,
  type SubFacts,
} from "../supabase/functions/admin-cancellation-stats/stats";

const at = (iso: string) => Date.parse(iso) / 1000;

// A Starter trial started 1 Nov, ending 15 Nov.
const trial = (over: Partial<SubFacts> = {}): SubFacts => ({
  status: "trialing",
  cancel_at_period_end: false,
  cancel_at: null,
  canceled_at: null,
  ended_at: null,
  start_date: at("2026-11-01T10:00:00Z"),
  trial_start: at("2026-11-01T10:00:00Z"),
  trial_end: at("2026-11-15T10:00:00Z"),
  current_period_end: at("2026-11-15T10:00:00Z"),
  cancel_reason: null,
  ...over,
});

describe("classifyCancellation", () => {
  it("ignores a subscription running normally or one that never started", () => {
    expect(classifyCancellation(trial())).toBeNull();
    expect(classifyCancellation(trial({ status: "active" }))).toBeNull();
    expect(classifyCancellation(trial({ status: "incomplete_expired" }))).toBeNull();
  });

  it("reads a trial set to cancel on day 0 as a scheduled trial cancellation", () => {
    const c = classifyCancellation(
      trial({
        cancel_at_period_end: true,
        canceled_at: at("2026-11-01T13:00:00Z"),
        cancel_reason: "cancellation_requested",
      }),
    );
    expect(c).toEqual({
      kind: "trial",
      state: "scheduled",
      requestedAt: at("2026-11-01T13:00:00Z"),
      endsAt: at("2026-11-15T10:00:00Z"),
      day: 0,
    });
  });

  it("uses cancel_at for a cancellation scheduled at a set date", () => {
    const c = classifyCancellation(
      trial({ status: "active", cancel_at: at("2026-12-20T00:00:00Z"), canceled_at: at("2026-11-20T00:00:00Z") }),
    );
    expect(c?.state).toBe("scheduled");
    expect(c?.kind).toBe("paying");
    expect(c?.endsAt).toBe(at("2026-12-20T00:00:00Z"));
  });

  it("counts a trial cancelled straight away as ended inside the trial", () => {
    const c = classifyCancellation(
      trial({
        status: "canceled",
        canceled_at: at("2026-11-03T09:00:00Z"),
        ended_at: at("2026-11-03T09:00:00Z"),
        cancel_reason: "cancellation_requested",
      }),
    );
    expect(c).toMatchObject({ kind: "trial", state: "ended", day: 1 });
    expect(c?.endsAt).toBe(at("2026-11-03T09:00:00Z"));
  });

  it("counts a request after the trial ended as a paying customer", () => {
    const c = classifyCancellation(
      trial({
        status: "canceled",
        canceled_at: at("2026-11-21T09:00:00Z"),
        ended_at: at("2026-12-15T10:00:00Z"),
        cancel_reason: "cancellation_requested",
      }),
    );
    expect(c).toMatchObject({ kind: "paying", state: "ended", day: 19 });
  });

  it("counts a subscription with no trial as paying", () => {
    const c = classifyCancellation(
      trial({
        status: "canceled",
        trial_start: null,
        trial_end: null,
        canceled_at: at("2026-11-01T12:00:00Z"),
        ended_at: at("2026-12-01T10:00:00Z"),
      }),
    );
    expect(c?.kind).toBe("paying");
  });

  it("separates failed and disputed payments from choices, even inside a trial", () => {
    for (const reason of ["payment_failed", "payment_disputed"]) {
      const c = classifyCancellation(
        trial({ status: "canceled", canceled_at: at("2026-11-10T00:00:00Z"), cancel_reason: reason }),
      );
      expect(c?.kind).toBe("failed");
    }
  });
});

describe("finishedTrial", () => {
  const now = at("2026-11-24T00:00:00Z");

  it("skips a subscription with no trial and one still in it", () => {
    expect(finishedTrial(trial(), now, false)).toBeNull();
    expect(finishedTrial(trial({ status: "active", trial_start: null, trial_end: null }), now, true)).toBeNull();
  });

  it("finishes a converted trial at its trial end", () => {
    expect(finishedTrial(trial({ status: "active" }), now, true)).toEqual({
      at: at("2026-11-15T10:00:00Z"),
      paid: true,
    });
  });

  it("finishes a trial cancelled straight away when it ended", () => {
    expect(
      finishedTrial(trial({ status: "canceled", ended_at: at("2026-11-02T00:00:00Z") }), now, false),
    ).toEqual({ at: at("2026-11-02T00:00:00Z"), paid: false });
  });

  it("waits for a trial whose end is still ahead", () => {
    const later = at("2026-11-10T00:00:00Z");
    expect(finishedTrial(trial({ status: "past_due" }), later, false)).toBeNull();
  });
});

describe("latestAmount", () => {
  it("takes the most recent payment whatever the order", () => {
    expect(latestAmount([])).toBeNull();
    expect(
      latestAmount([
        { at: 300, amount: 1499 },
        { at: 100, amount: 799 },
        { at: 200, amount: 999 },
      ]),
    ).toBe(1499);
  });
});
