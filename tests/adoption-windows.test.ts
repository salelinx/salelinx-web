// Feature adoption over the non-month windows (lib/admin/adoption.ts): the
// exact trailing presets answered from usage_events and the custom UTC hour
// ranges answered from the hour buckets. The month windows are pinned in
// tests/adoption.test.ts; these pin that the other two kinds resolve to the
// right buckets, never mix sources, and fold through the same math.
import { describe, expect, it } from "vitest";
import { foldAdoption, resolveAdoptionWindow } from "@/lib/admin/adoption";
import { EVENTS_EPOCH, HOUR_EPOCH, HOUR_KEY_RE } from "@/lib/admin/period";
import { WINDOW_PRESETS } from "@/lib/admin/usage-range";
import type { AdminUsageRow, AdminUserRow } from "@/lib/types/admin";
import type { TierConfig } from "@/lib/types/tiers";

// Well inside both retention windows relative to the epochs.
const NOW = new Date("2026-09-20T15:42:10Z");

function user(id: string, tier: string | null): AdminUserRow {
  return {
    user_id: id,
    email: `${id}@example.com`,
    created_at: "2026-04-01T00:00:00Z",
    last_sign_in_at: null,
    tier_id: tier,
    status: "active",
    is_admin: false,
    linked_platforms: [],
    last_device_seen_at: null,
    extension_version: null,
  };
}

function row(
  user_id: string,
  feature: string,
  period_key: string,
  count: number,
): AdminUsageRow {
  return { user_id, feature, period_key, count, updated_at: "" };
}

const TIERS: TierConfig[] = [
  {
    tier_id: "free",
    version: 1,
    features: {},
    limits: { crosslists_per_month: 0 },
    effective_from: "2026-04-01T00:00:00Z",
    effective_until: null,
  },
  {
    tier_id: "pro",
    version: 1,
    features: { offers: true },
    limits: { crosslists_per_month: null },
    effective_from: "2026-04-01T00:00:00Z",
    effective_until: null,
  },
];

describe("resolveAdoptionWindow: trailing presets", () => {
  it("resolves ?range=15m to an exact events window with a comparison", () => {
    const w = resolveAdoptionWindow({ range: "15m" }, NOW);
    expect(w.kind).toBe("window");
    expect(w.preset).toBe("15m");
    expect(w.keys).toEqual([]);
    expect(w.months).toEqual(["window"]);
    expect(w.compareMonths).toEqual(["compare"]);
    expect(w.trendMonths).toEqual([]);
    expect(w.trendLabels).toEqual([]);
    expect(w.events).toEqual({
      since: "2026-09-20T15:27:10.000Z",
      until: "2026-09-20T15:42:10.000Z",
      compareSince: "2026-09-20T15:12:10.000Z",
      compareUntil: "2026-09-20T15:27:10.000Z",
    });
    expect(w.label).toBe("Last 15 minutes (since 15:27 UTC)");
    expect(w.compareLabel).toBe("the previous 15 minutes");
    expect(w.note).toBeUndefined();
  });

  it("resolves every preset to its exact length and keeps the base", () => {
    for (const [range, { minutes }] of Object.entries(WINDOW_PRESETS)) {
      const w = resolveAdoptionWindow({ range, base: "paid" }, NOW);
      expect(w.kind, range).toBe("window");
      expect(w.base, range).toBe("paid");
      const ev = w.events!;
      expect(Date.parse(ev.until) - Date.parse(ev.since), range).toBe(
        minutes * 60_000,
      );
    }
  });

  it("clamps to the events epoch right after launch and drops the comparison", () => {
    const justAfterLaunch = new Date("2026-09-08T02:00:00Z");
    const w = resolveAdoptionWindow({ range: "72h" }, justAfterLaunch);
    expect(w.events?.since).toBe(EVENTS_EPOCH);
    expect(w.compareMonths).toEqual([]);
    expect(w.compareLabel).toBeNull();
    expect(w.note).toContain("Usage events start at");
  });

  it("ignores an unknown range and falls back to one month", () => {
    const w = resolveAdoptionWindow({ range: "9y" }, NOW);
    expect(w.kind).toBe("months");
    expect(w.preset).toBe("1");
  });
});

describe("resolveAdoptionWindow: custom hour ranges", () => {
  it("resolves hour-shaped from/to to hour buckets with an equal-length comparison", () => {
    const w = resolveAdoptionWindow(
      { from: "2026-09-10T09", to: "2026-09-10T11" },
      NOW,
    );
    expect(w.kind).toBe("hours");
    expect(w.preset).toBe("custom");
    expect(w.months).toEqual(["2026-09-10T09", "2026-09-10T10", "2026-09-10T11"]);
    expect(w.compareMonths).toEqual([
      "2026-09-10T06",
      "2026-09-10T07",
      "2026-09-10T08",
    ]);
    expect(w.trendMonths).toEqual(w.months);
    expect(w.trendLabels).toEqual(["09-10 09:00", "09-10 10:00", "09-10 11:00"]);
    expect(w.keys).toEqual([...w.months, ...w.compareMonths]);
    expect(w.keys.every((k) => HOUR_KEY_RE.test(k))).toBe(true);
    expect(w.label).toBe("2026-09-10 09:00 to 2026-09-10 11:00 UTC (hourly)");
    expect(w.compareLabel).toBe("2026-09-10 06:00 to 2026-09-10 08:00 UTC");
    expect(w.events).toBeUndefined();
  });

  it("drops the comparison when it would reach before the hour epoch", () => {
    const w = resolveAdoptionWindow(
      { from: "2026-09-08T00", to: "2026-09-08T02" },
      NOW,
    );
    expect(w.months[0]).toBe(HOUR_EPOCH);
    expect(w.compareMonths).toEqual([]);
    expect(w.keys).toEqual(w.months);
  });

  it("clamps a range that starts before the hour epoch and says so", () => {
    const w = resolveAdoptionWindow(
      { from: "2026-09-01T00", to: "2026-09-08T01" },
      NOW,
    );
    expect(w.months).toEqual(["2026-09-08T00", "2026-09-08T01"]);
    expect(w.note).toContain("Hourly buckets start at");
  });

  it("treats a month-shaped ?to= as the month anchor, not an hour range", () => {
    const w = resolveAdoptionWindow({ to: "2026-08", from: "2026-09-10T09" }, NOW);
    expect(w.kind).toBe("months");
    expect(w.anchor).toBe("2026-08");
  });
});

describe("foldAdoption over an events window", () => {
  const window = resolveAdoptionWindow({ range: "1h" }, NOW);
  const users = [user("u1", "pro"), user("u2", "free"), user("u3", "pro")];
  const rows = [
    // Current window: u1 and u2 used offers, u1 relisted a lot.
    row("u1", "offer_send", "window", 3),
    row("u2", "offer_send", "window", 1),
    row("u1", "relist", "window", 40),
    // Comparison window: only u3 used offers.
    row("u3", "offer_send", "compare", 2),
    // Web counters never count.
    row("u1", "checkout_sessions", "window", 5),
  ];

  it("counts distinct users and actions from the synthetic buckets only", () => {
    const report = foldAdoption({ rows, users, tiers: TIERS, window });
    expect(report.activeUsers).toBe(2);
    expect(report.compareActiveUsers).toBe(1);
    expect(report.returningUsers).toBe(0);
    expect(report.totalActions).toBe(44);
    expect(report.compareTotalActions).toBe(2);
    const offers = report.features.find((f) => f.feature === "offer_send")!;
    expect(offers.users).toBe(2);
    expect(offers.compareUsers).toBe(1);
    expect(offers.actions).toBe(4);
    expect(offers.medianPerUser).toBe(2);
    expect(offers.trend).toEqual([]);
    expect(report.monthlyActiveUsers).toEqual([]);
    expect(report.unmeasuredMonths).toEqual([]);
  });

  it("splits by plan the same way as the month windows", () => {
    const report = foldAdoption({ rows, users, tiers: TIERS, window });
    const pro = report.tiers.find((t) => t.tier_id === "pro")!;
    const free = report.tiers.find((t) => t.tier_id === "free")!;
    expect(pro.cells.offer_send.users).toBe(1);
    expect(free.cells.offer_send.users).toBe(1);
  });
});

describe("foldAdoption over an hour range", () => {
  it("uses the hour key as the bucket and builds a per-hour trend", () => {
    const window = resolveAdoptionWindow(
      { from: "2026-09-10T09", to: "2026-09-10T11" },
      NOW,
    );
    const users = [user("u1", "pro"), user("u2", "pro")];
    const rows = [
      row("u1", "relist", "2026-09-10T09", 5),
      row("u2", "relist", "2026-09-10T11", 1),
      row("u1", "relist", "2026-09-10T07", 9), // comparison hours
    ];
    const report = foldAdoption({ rows, users, tiers: TIERS, window });
    const relist = report.features.find((f) => f.feature === "relist")!;
    expect(relist.users).toBe(2);
    expect(relist.compareUsers).toBe(1);
    expect(relist.trend).toEqual([1, 0, 1]);
    expect(report.monthlyActiveUsers).toEqual([1, 0, 1]);
    expect(report.unmeasuredMonths).toEqual([]);
  });
});
