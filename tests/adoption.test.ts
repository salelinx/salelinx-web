// Feature adoption math (lib/admin/adoption.ts). The page is read-only, but
// the numbers steer product decisions, so the fold is pinned here: distinct
// users (not actions), daily rows folding into months, the denominator
// restricting the numerator too, plan eligibility, and the window resolution
// that decides which months are read and compared.
import { describe, expect, it } from "vitest";
import {
  addMonths,
  foldAdoption,
  monthRange,
  resolveAdoptionWindow,
  tierCanUse,
} from "@/lib/admin/adoption";
import type { AdminUsageRow, AdminUserRow } from "@/lib/types/admin";
import type { TierConfig } from "@/lib/types/tiers";

const NOW = new Date("2026-09-07T12:00:00Z");

function user(
  id: string,
  tier: string | null,
  status: string | null = "active",
): AdminUserRow {
  return {
    user_id: id,
    email: `${id}@example.com`,
    created_at: "2026-04-01T00:00:00Z",
    last_sign_in_at: null,
    tier_id: tier,
    status,
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

function tier(
  tier_id: TierConfig["tier_id"],
  features: Record<string, boolean>,
  limits: Record<string, number | null>,
  version = 1,
): TierConfig {
  return {
    tier_id,
    version,
    features,
    limits,
    effective_from: "2026-04-01T00:00:00Z",
    effective_until: null,
  };
}

const TIERS: TierConfig[] = [
  tier("free", {}, { crosslists_per_month: 0 }),
  tier("starter", { offers: true }, { crosslists_per_month: 150 }),
  tier("pro", { offers: true, restocker: false }, { crosslists_per_month: null }),
  tier("business", { offers: true, restocker: true }, { crosslists_per_month: null }),
];

describe("month helpers", () => {
  it("adds and subtracts months across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(monthRange("2026-11", "2027-01")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
    expect(monthRange("2026-05", "2026-04")).toEqual([]);
  });
});

describe("resolveAdoptionWindow", () => {
  it("defaults to the current month with the previous month as comparison", () => {
    const w = resolveAdoptionWindow({}, NOW);
    expect(w.preset).toBe("1");
    expect(w.base).toBe("active");
    expect(w.months).toEqual(["2026-09"]);
    expect(w.compareMonths).toEqual(["2026-08"]);
    expect(w.trendMonths).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    // Reads stop at today, not the end of the month.
    expect(w.keys).toContain("2026-09-07");
    expect(w.keys).not.toContain("2026-09-08");
    // And reach back to the earliest month any of the sets needs.
    expect(w.keys).toContain("2026-04");
    expect(w.keys).toContain("2026-04-01");
  });

  it("drops the comparison window when it would reach past the epoch", () => {
    const w = resolveAdoptionWindow({ months: "6" }, NOW);
    expect(w.months).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(w.compareMonths).toEqual([]);
    expect(w.compareLabel).toBeNull();
  });

  it("compares a 3-month window with the 3 months before it", () => {
    const w = resolveAdoptionWindow({ months: "3", to: "2026-09" }, NOW);
    expect(w.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(w.compareMonths).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(w.label).toBe("Jul to Sep 2026");
    expect(w.compareLabel).toBe("Apr to Jun 2026");
  });

  it("clamps the anchor to the epoch and to the current month", () => {
    expect(resolveAdoptionWindow({ to: "2025-01" }, NOW).anchor).toBe("2026-04");
    expect(resolveAdoptionWindow({ to: "2027-01" }, NOW).anchor).toBe("2026-09");
    expect(resolveAdoptionWindow({ to: "garbage" }, NOW).anchor).toBe("2026-09");
    // A past anchor reads through the end of that month.
    const past = resolveAdoptionWindow({ to: "2026-06" }, NOW);
    expect(past.keys).toContain("2026-06-30");
    expect(past.keys).not.toContain("2026-07-01");
  });

  it("all time spans the epoch to the anchor with no comparison", () => {
    const w = resolveAdoptionWindow({ months: "all", base: "paid" }, NOW);
    expect(w.months[0]).toBe("2026-04");
    expect(w.months[w.months.length - 1]).toBe("2026-09");
    expect(w.compareMonths).toEqual([]);
    expect(w.base).toBe("paid");
    expect(w.label).toBe("All time (Apr to Sep 2026)");
  });

  it("ignores unknown presets and bases", () => {
    const w = resolveAdoptionWindow({ months: "12", base: "everyone" }, NOW);
    expect(w.preset).toBe("1");
    expect(w.base).toBe("active");
  });
});

describe("tierCanUse", () => {
  it("reads feature flags and metered caps", () => {
    const [free, starter, pro, business] = TIERS;
    expect(tierCanUse("crosslist", free)).toBe(false);
    expect(tierCanUse("crosslist", starter)).toBe(true);
    expect(tierCanUse("crosslist", pro)).toBe(true); // null = unlimited
    expect(tierCanUse("offer_accept", free)).toBe(false);
    expect(tierCanUse("offer_accept", starter)).toBe(true);
    expect(tierCanUse("restock", pro)).toBe(false);
    expect(tierCanUse("restock", business)).toBe(true);
    // A missing limit key means "not applicable" for that tier.
    expect(tierCanUse("relist", starter)).toBe(false);
  });

  it("treats ungated counters and unknown tiers as usable", () => {
    expect(tierCanUse("photo_edit", TIERS[0])).toBe(true);
    expect(tierCanUse("restock", null)).toBe(true);
  });
});

describe("foldAdoption", () => {
  const users = [
    user("a", "pro"),
    user("b", "starter"),
    user("c", null, null),
    user("d", "pro", "canceled"),
  ];

  it("counts distinct users, folds daily rows into months, and ignores web counters", () => {
    const window = resolveAdoptionWindow({}, NOW);
    const rows = [
      // a: 40 crosslists in September (one row) + two refresh day rows
      row("a", "crosslist", "2026-09", 40),
      row("a", "refresh", "2026-09-01", 5),
      row("a", "refresh", "2026-09-02", 7),
      // b: 1,000 listing edits, still one user
      row("b", "listing_edit", "2026-09", 1000),
      row("b", "crosslist", "2026-09", 2),
      // c: only a web abuse counter, must not count as extension activity
      row("c", "checkout_sessions", "2026-09-07", 3),
      // August, for the comparison
      row("a", "crosslist", "2026-08", 10),
      row("d", "crosslist", "2026-08", 1),
    ];
    const r = foldAdoption({ rows, users, tiers: TIERS, window });

    expect(r.activeUsers).toBe(2);
    expect(r.compareActiveUsers).toBe(2);
    expect(r.returningUsers).toBe(1);
    expect(r.totalActions).toBe(40 + 12 + 1000 + 2);
    expect(r.compareTotalActions).toBe(11);
    expect(r.baseUsers).toBe(2);

    const crosslist = r.features.find((f) => f.feature === "crosslist")!;
    expect(crosslist.users).toBe(2);
    expect(crosslist.adoption).toBe(100);
    expect(crosslist.actions).toBe(42);
    expect(crosslist.medianPerUser).toBe(21);
    expect(crosslist.compareUsers).toBe(2);
    expect(crosslist.minTier).toBe("starter");

    const refresh = r.features.find((f) => f.feature === "refresh")!;
    expect(refresh.users).toBe(1);
    expect(refresh.actions).toBe(12);
    expect(refresh.adoption).toBe(50);
    // Trend is users per month, aligned with trendMonths.
    expect(refresh.trend).toEqual([0, 0, 0, 0, 0, 1]);

    const edits = r.features.find((f) => f.feature === "listing_edit")!;
    expect(edits.users).toBe(1);
    expect(edits.actions).toBe(1000);
    expect(edits.minTier).toBeNull();

    // Sorted by users first, so the bulk edit does not float to the top.
    expect(r.features[0].feature).toBe("crosslist");
    expect(r.featuresUsed).toBe(3);
    expect(r.features.every((f) => f.feature !== "checkout_sessions")).toBe(true);
  });

  it("ranks users by total actions with their most-used feature", () => {
    const window = resolveAdoptionWindow({}, NOW);
    const rows = [
      row("a", "crosslist", "2026-09", 40),
      row("a", "refresh", "2026-09-01", 5),
      row("a", "refresh", "2026-09-02", 7),
      row("b", "listing_edit", "2026-09", 1000),
      row("b", "crosslist", "2026-09", 2),
      row("c", "checkout_sessions", "2026-09-07", 3),
      // Last month does not count toward this month's ranking.
      row("d", "crosslist", "2026-08", 999),
    ];
    const r = foldAdoption({ rows, users, tiers: TIERS, window });
    expect(r.users.map((u) => u.user_id)).toEqual(["b", "a"]);
    expect(r.users[0]).toEqual({
      user_id: "b",
      tier_id: "starter",
      actions: 1002,
      featuresUsed: 2,
      topFeature: "Listing edits saved",
      topFeatureActions: 1000,
    });
    expect(r.users[1]).toEqual({
      user_id: "a",
      tier_id: "pro",
      actions: 52,
      featuresUsed: 2,
      topFeature: "Crosslist",
      topFeatureActions: 40,
    });
  });

  it("keeps the full roster, zero rows included, and appends unknown counters", () => {
    const window = resolveAdoptionWindow({}, NOW);
    const rows = [row("a", "brand_new_thing", "2026-09", 1)];
    const r = foldAdoption({ rows, users, tiers: TIERS, window });
    expect(r.featuresTotal).toBe(29);
    const novel = r.features.find((f) => f.feature === "brand_new_thing")!;
    expect(novel.users).toBe(1);
    expect(novel.label).toBe("brand_new_thing");
    expect(r.features.filter((f) => f.users === 0)).toHaveLength(28);
  });

  it("restricts both numerator and denominator to the paid base", () => {
    const window = resolveAdoptionWindow({ base: "paid" }, NOW);
    const rows = [
      row("a", "crosslist", "2026-09", 5), // pro, active
      row("b", "crosslist", "2026-09", 5), // starter, active
      row("c", "photo_edit", "2026-09", 5), // no subscription
      row("d", "crosslist", "2026-09", 5), // pro, canceled
    ];
    const r = foldAdoption({ rows, users, tiers: TIERS, window });
    // activeUsers is always the honest count, regardless of base.
    expect(r.activeUsers).toBe(4);
    expect(r.baseUsers).toBe(2);
    const crosslist = r.features.find((f) => f.feature === "crosslist")!;
    expect(crosslist.users).toBe(2);
    expect(crosslist.adoption).toBe(100);
    const photo = r.features.find((f) => f.feature === "photo_edit")!;
    expect(photo.users).toBe(0);
  });

  it("builds the per-plan matrix with eligibility from the current tier config", () => {
    const window = resolveAdoptionWindow({ base: "all" }, NOW);
    const rows = [
      row("a", "restock", "2026-09", 3), // pro user, feature not on pro
      row("b", "offer_accept", "2026-09", 1),
    ];
    const r = foldAdoption({ rows, users, tiers: TIERS, window });
    const byTier = Object.fromEntries(r.tiers.map((t) => [t.tier_id, t]));

    expect(r.tiers.map((t) => t.tier_id)).toEqual([
      "free",
      "starter",
      "pro",
      "business",
    ]);
    expect(byTier.free.base).toBe(1);
    expect(byTier.starter.base).toBe(1);
    expect(byTier.pro.base).toBe(2);
    expect(byTier.business.base).toBe(0);

    // Recorded usage still counts even where the plan says no: the cell is
    // flagged ineligible so the UI can grey it, but the number is not hidden.
    expect(byTier.pro.cells.restock).toEqual({
      users: 1,
      adoption: 50,
      eligible: false,
    });
    expect(byTier.starter.cells.offer_accept).toEqual({
      users: 1,
      adoption: 100,
      eligible: true,
    });
    expect(byTier.free.cells.offer_accept.eligible).toBe(false);
    expect(byTier.business.cells.restock.adoption).toBeNull();
  });

  it("uses the highest tier version for eligibility", () => {
    const window = resolveAdoptionWindow({}, NOW);
    const tiers = [
      ...TIERS,
      tier("pro", { restocker: true }, { crosslists_per_month: null }, 2),
    ];
    const r = foldAdoption({ rows: [], users, tiers, window });
    const pro = r.tiers.find((t) => t.tier_id === "pro")!;
    expect(pro.cells.restock.eligible).toBe(true);
    const restock = r.features.find((f) => f.feature === "restock")!;
    expect(restock.minTier).toBe("pro");
  });

  it("flags trend months that predate the activity counters", () => {
    const r = foldAdoption({
      rows: [],
      users,
      tiers: TIERS,
      window: resolveAdoptionWindow({}, NOW),
    });
    expect(r.unmeasuredMonths).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    const later = foldAdoption({
      rows: [],
      users,
      tiers: TIERS,
      window: resolveAdoptionWindow({}, new Date("2027-03-15T00:00:00Z")),
    });
    expect(later.unmeasuredMonths).toEqual([]);
  });
});
