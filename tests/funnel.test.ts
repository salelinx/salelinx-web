// Funnel math for /admin/analytics/funnel (lib/admin/funnel.ts). The page is
// read to judge where marketing loses people, so how accounts are counted
// at each step is pinned here: the standard closed-funnel rule, where an
// account drops out at the first step it skipped.
import { describe, expect, it } from "vitest";
import {
  countFunnel,
  FUNNEL_STEPS,
  groupFunnel,
  inPeriod,
  lastStep,
  medianDaysToPay,
  PAID_STEP,
  parseFunnelPeriod,
} from "@/lib/admin/funnel";
import { canonicalSource } from "@/components/admin/SignupSource";
import type { AdminFunnelAccount } from "@/lib/types/admin";

const NOW = new Date("2026-11-25T12:00:00Z");

function account(over: Partial<AdminFunnelAccount> = {}): AdminFunnelAccount {
  return {
    user_id: "u",
    signed_up_at: "2026-11-01T00:00:00Z",
    confirmed: false,
    source: null,
    campaign: null,
    device: null,
    installed: false,
    linked: false,
    features: [],
    subscribed_at: null,
    first_paid_at: null,
    in_trial_now: false,
    paying_now: false,
    ...over,
  };
}

const step = (key: (typeof FUNNEL_STEPS)[number]["key"]) =>
  FUNNEL_STEPS.findIndex((s) => s.key === key);

// Every step up to Paid done, not paying now.
const throughPaid = {
  confirmed: true,
  installed: true,
  linked: true,
  features: ["relist"],
  subscribed_at: "2026-11-02T00:00:00Z",
  first_paid_at: "2026-11-09T00:00:00Z",
};

describe("lastStep", () => {
  it("is the signup step for an unconfirmed account", () => {
    expect(lastStep(account())).toBe(0);
  });

  it("counts only extension features as use", () => {
    const base = { confirmed: true, installed: true, linked: true };
    expect(lastStep(account({ ...base, features: ["checkout_sessions"] }))).toBe(step("linked"));
    expect(lastStep(account({ ...base, features: ["crosslist"] }))).toBe(step("used"));
  });

  it("drops an account out at the first step it skipped, as standard funnels do", () => {
    // Started a plan on the website before installing the extension.
    const a = account({ confirmed: true, subscribed_at: "2026-11-02T00:00:00Z" });
    expect(lastStep(a)).toBe(step("confirmed"));
  });
});

describe("countFunnel", () => {
  it("counts an account at a step only with every step before it", () => {
    const counts = countFunnel([
      account(),
      account({ confirmed: true }),
      account({ confirmed: true, subscribed_at: "2026-11-02T00:00:00Z" }),
      account({ ...throughPaid, paying_now: true }),
    ]);
    expect(counts.steps).toEqual([4, 3, 1, 1, 1, 1, 1, 1]);
    for (let i = 1; i < counts.steps.length; i++) {
      expect(counts.steps[i]).toBeLessThanOrEqual(counts.steps[i - 1]);
    }
  });

  it("keeps a payer who skipped a step in paidTotal", () => {
    const counts = countFunnel([
      account({ ...throughPaid, installed: false }),
      account(throughPaid),
    ]);
    expect(counts.steps[PAID_STEP]).toBe(1);
    expect(counts.paidTotal).toBe(2);
  });

  it("counts running trials that have not paid yet", () => {
    const counts = countFunnel([
      account({ subscribed_at: "2026-11-20T00:00:00Z", in_trial_now: true }),
      // A paid account still flagged trialing is not waiting on anything.
      account({ in_trial_now: true, first_paid_at: "2026-11-10T00:00:00Z" }),
    ]);
    expect(counts.inTrial).toBe(1);
  });

  it("counts a paid account at the Paid step after it cancels", () => {
    const counts = countFunnel([account(throughPaid)]);
    expect(counts.steps[PAID_STEP]).toBe(1);
    expect(counts.steps[PAID_STEP + 1]).toBe(0);
  });
});

describe("medianDaysToPay", () => {
  it("takes the middle of the paid accounts only", () => {
    const paidAfter = (days: number) =>
      account({
        first_paid_at: new Date(Date.parse("2026-11-01T00:00:00Z") + days * 86_400_000).toISOString(),
      });
    expect(medianDaysToPay([account(), paidAfter(2), paidAfter(8), paidAfter(30)])).toBe(8);
    expect(medianDaysToPay([paidAfter(2), paidAfter(8)])).toBe(5);
    expect(medianDaysToPay([account()])).toBeNull();
  });
});

describe("groupFunnel", () => {
  it("groups a missing source as unknown, most signups first", () => {
    const groups = groupFunnel(
      [account({ source: "tiktok" }), account(), account({ source: "tiktok" })],
      (a) => a.source,
    );
    expect(groups.map((g) => [g.key, g.steps[0]])).toEqual([
      ["tiktok", 2],
      ["unknown", 1],
    ]);
  });
});

describe("source names", () => {
  it("groups Instagram's own ig tag with instagram", () => {
    const groups = groupFunnel(
      [account({ source: "instagram" }), account({ source: "ig" }), account({ source: "search.yahoo.com" })],
      (a) => a.source && canonicalSource(a.source),
    );
    expect(groups.map((g) => [g.key, g.steps[0]])).toEqual([
      ["instagram", 2],
      ["yahoo", 1],
    ]);
  });
});

describe("periods", () => {
  it("falls back to 90 days for an unknown value", () => {
    expect(parseFunnelPeriod(undefined).key).toBe("90");
    expect(parseFunnelPeriod("nope").key).toBe("90");
    expect(parseFunnelPeriod("all").days).toBeNull();
  });

  it("keeps signups inside the window", () => {
    const old = account({ signed_up_at: "2026-10-01T00:00:00Z" });
    const recent = account({ signed_up_at: "2026-11-20T00:00:00Z" });
    expect(inPeriod([old, recent], parseFunnelPeriod("30"), NOW)).toEqual([recent]);
    expect(inPeriod([old, recent], parseFunnelPeriod("all"), NOW)).toHaveLength(2);
  });
});
