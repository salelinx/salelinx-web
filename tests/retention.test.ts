// Funnel, churn watch and movers (lib/admin/retention.ts, featureMovers in
// lib/admin/adoption.ts). These lists prompt someone to contact a customer,
// so who lands on them is pinned here.
import { describe, expect, it } from "vitest";
import { churnWatch, signupFunnel } from "@/lib/admin/retention";
import { featureMovers } from "@/lib/admin/adoption";
import type { FeatureAdoption } from "@/lib/admin/adoption";
import type {
  AdminSubscriptionRow,
  AdminUsageRow,
  AdminUserRow,
} from "@/lib/types/admin";

const NOW = new Date("2026-09-07T12:00:00Z");

function user(
  id: string,
  tier: string | null,
  status: string | null = "active",
  linked: AdminUserRow["linked_platforms"] = [],
): AdminUserRow {
  return {
    user_id: id,
    email: `${id}@example.com`,
    created_at: "2026-04-01T00:00:00Z",
    last_sign_in_at: null,
    tier_id: tier,
    status,
    is_admin: false,
    linked_platforms: linked,
    last_device_seen_at: null,
    extension_version: null,
  };
}

function row(
  user_id: string,
  feature: string,
  period_key: string,
  updated_at: string,
  count = 1,
): AdminUsageRow {
  return { user_id, feature, period_key, count, updated_at };
}

function sub(
  user_id: string,
  cancel: boolean,
  periodEnd: string | null,
  updated_at = "2026-08-01T00:00:00Z",
): AdminSubscriptionRow {
  return {
    id: `s-${user_id}-${updated_at}`,
    user_id,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    tier_id: "pro",
    tier_version: 1,
    status: "active",
    current_period_end: periodEnd,
    cancel_at_period_end: cancel,
    created_at: "2026-04-01T00:00:00Z",
    updated_at,
  };
}

describe("signupFunnel", () => {
  it("counts each state as a share of accounts", () => {
    const users = [
      user("a", "pro", "active", ["depop"]),
      user("b", "starter", "trialing", ["vinted", "depop"]),
      user("c", null, null, ["depop"]),
      user("d", null, null),
      user("e", "pro", "canceled", ["depop"]),
    ];
    const rows = [
      row("a", "crosslist", "2026-09", "2026-09-01T00:00:00Z"),
      row("c", "photo_edit", "2026-08", "2026-08-30T00:00:00Z"),
      // Web abuse counters are not extension activity.
      row("d", "checkout_sessions", "2026-09-07", "2026-09-07T00:00:00Z"),
    ];
    const f = signupFunnel(users, rows);
    expect(f.map((s) => [s.key, s.count, s.share])).toEqual([
      ["accounts", 5, 100],
      ["linked", 4, 80],
      ["active", 2, 40],
      ["paying", 2, 40],
    ]);
  });

  it("handles an empty base", () => {
    expect(signupFunnel([], []).every((s) => s.share === null)).toBe(true);
  });
});

describe("churnWatch", () => {
  const users = [
    user("fresh", "pro"), // active 2 days ago
    user("quiet", "pro"), // active 45 days ago
    user("never", "starter"), // paying, no rows at all
    user("leaving", "pro"), // cancel_at_period_end, still active recently
    user("free", null, null), // not paying, ignored even though silent
    user("lapsed", "pro", "canceled"), // not paying any more
  ];
  const rows = [
    row("fresh", "crosslist", "2026-09", "2026-09-05T10:00:00Z"),
    row("quiet", "crosslist", "2026-07", "2026-07-24T10:00:00Z"),
    row("leaving", "relist", "2026-09", "2026-09-06T10:00:00Z"),
    row("lapsed", "crosslist", "2026-05", "2026-05-01T10:00:00Z"),
  ];
  const subscriptions = [
    sub("fresh", false, "2026-10-01T00:00:00Z"),
    sub("quiet", false, "2026-10-01T00:00:00Z"),
    sub("never", false, "2026-10-01T00:00:00Z"),
    // An older row for "leaving" said no; the newest row wins.
    sub("leaving", false, "2026-09-01T00:00:00Z", "2026-07-01T00:00:00Z"),
    sub("leaving", true, "2026-09-20T00:00:00Z", "2026-09-02T00:00:00Z"),
  ];

  it("lists cancelling and quiet paying users, longest silence first", () => {
    const w = churnWatch({ users, subscriptions, rows, now: NOW });
    expect(w.payingUsers).toBe(4);
    expect(w.cancelling).toEqual([
      { user_id: "leaving", tier_id: "pro", days: 13 },
    ]);
    expect(w.quiet).toEqual([
      { user_id: "never", tier_id: "starter", days: null },
      { user_id: "quiet", tier_id: "pro", days: 45 },
    ]);
  });

  it("respects the quiet threshold", () => {
    const w = churnWatch({ users, subscriptions, rows, now: NOW, quietDays: 60 });
    expect(w.quiet.map((q) => q.user_id)).toEqual(["never"]);
  });
});

describe("featureMovers", () => {
  const f = (
    feature: string,
    users: number,
    compareUsers: number | null,
  ): FeatureAdoption => ({
    feature,
    label: feature,
    users,
    adoption: null,
    actions: 0,
    medianPerUser: null,
    compareUsers,
    trend: [],
    minTier: null,
  });

  it("splits gains and drops by size and ignores unchanged or uncompared", () => {
    const m = featureMovers(
      [
        f("a", 10, 4), // +6
        f("b", 3, 8), // -5
        f("c", 5, 5), // 0
        f("d", 9, null), // no comparison
        f("e", 2, 1), // +1
        f("f", 0, 2), // -2
        f("g", 7, 3), // +4
        f("h", 6, 2), // +4
      ],
      2,
    );
    expect(m.gains.map((x) => [x.feature, x.delta])).toEqual([
      ["a", 6],
      ["g", 4],
    ]);
    expect(m.drops.map((x) => [x.feature, x.delta])).toEqual([
      ["b", -5],
      ["f", -2],
    ]);
  });
});
