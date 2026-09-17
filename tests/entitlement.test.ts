// The entitlement rule, and a real drift check between its two copies.
//
// The rule lives in supabase/functions/_shared/entitlement.ts (used by
// resolve-category) and is mirrored in lib/supabase/subscription.ts (used by
// the website), because supabase/functions is excluded from the Next tsconfig
// and cannot be imported from lib. Every other "keep in sync" pair in this
// repo is enforced at code review; this one is enforced here.
//
// It matters because the three copies HAD already drifted: the website's
// isEntitled excluded past_due while the extension and resolve-category
// granted it unconditionally, so whether a user could crosslist depended on
// which code path asked.

import { describe, expect, it } from "vitest";
import { isEntitled, GRACE_DAYS } from "@/lib/supabase/subscription";

const { isSubscriptionEntitled, GRACE_DAYS: SHARED_GRACE_DAYS } = await import(
  "../supabase/functions/_shared/entitlement"
);

const NOW = Date.parse("2026-09-17T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

type Case = {
  name: string;
  sub: {
    status: string | null;
    first_paid_at: string | null;
    past_due_since: string | null;
  };
  entitled: boolean;
};

const CASES: Case[] = [
  {
    name: "active",
    sub: { status: "active", first_paid_at: daysAgo(90), past_due_since: null },
    entitled: true,
  },
  {
    name: "trialing",
    sub: { status: "trialing", first_paid_at: null, past_due_since: null },
    entitled: true,
  },

  // The case this rule was written for: a trial converted, the first ever
  // charge bounced, and the account has paid nothing. No grace - otherwise the
  // trial's 50 crosslists are followed by Starter's 150 on an empty card.
  {
    name: "past_due, never paid (failed trial conversion)",
    sub: { status: "past_due", first_paid_at: null, past_due_since: daysAgo(0) },
    entitled: false,
  },
  {
    name: "past_due, never paid, even on day one",
    sub: { status: "past_due", first_paid_at: null, past_due_since: daysAgo(1) },
    entitled: false,
  },

  // An established customer whose card bounced. Usually temporary, so a week.
  {
    name: "past_due, has paid, day 1 of grace",
    sub: {
      status: "past_due",
      first_paid_at: daysAgo(90),
      past_due_since: daysAgo(1),
    },
    entitled: true,
  },
  {
    name: "past_due, has paid, day 6 of grace",
    sub: {
      status: "past_due",
      first_paid_at: daysAgo(90),
      past_due_since: daysAgo(6),
    },
    entitled: true,
  },
  {
    name: "past_due, has paid, grace expired at day 7",
    sub: {
      status: "past_due",
      first_paid_at: daysAgo(90),
      past_due_since: daysAgo(7),
    },
    entitled: false,
  },
  {
    name: "past_due, has paid, long expired",
    sub: {
      status: "past_due",
      first_paid_at: daysAgo(90),
      past_due_since: daysAgo(30),
    },
    entitled: false,
  },

  // Rows predating the rule have no stamp. Deny rather than grant forever,
  // which is exactly the behaviour being removed.
  {
    name: "past_due, has paid, no past_due_since stamp",
    sub: {
      status: "past_due",
      first_paid_at: daysAgo(90),
      past_due_since: null,
    },
    entitled: false,
  },
  {
    name: "past_due with an unparseable stamp",
    sub: {
      status: "past_due",
      first_paid_at: daysAgo(90),
      past_due_since: "not-a-date",
    },
    entitled: false,
  },

  {
    name: "canceled",
    sub: { status: "canceled", first_paid_at: daysAgo(90), past_due_since: null },
    entitled: false,
  },
  {
    name: "incomplete",
    sub: { status: "incomplete", first_paid_at: null, past_due_since: null },
    entitled: false,
  },
  // Stripe's terminal dunning state when configured to mark unpaid.
  {
    name: "unpaid",
    sub: { status: "unpaid", first_paid_at: daysAgo(90), past_due_since: daysAgo(1) },
    entitled: false,
  },
  {
    name: "no status at all",
    sub: { status: null, first_paid_at: null, past_due_since: null },
    entitled: false,
  },
];

describe("entitlement rule", () => {
  for (const c of CASES) {
    it(`${c.name} -> ${c.entitled ? "entitled" : "locked out"}`, () => {
      expect(isSubscriptionEntitled(c.sub, NOW)).toBe(c.entitled);
    });
  }

  it("refuses a null subscription", () => {
    expect(isSubscriptionEntitled(null, NOW)).toBe(false);
  });
});

describe("the website copy does not drift from the shared one", () => {
  it("agrees on every case", () => {
    for (const c of CASES) {
      const shared = isSubscriptionEntitled(c.sub, NOW);
      // The website copy is typed against its own row shape; the fields the
      // rule reads are the same three.
      const web = isEntitled(
        c.sub as unknown as Parameters<typeof isEntitled>[0],
        NOW,
      );
      expect(
        web,
        `${c.name}: website says ${web}, shared says ${shared}`,
      ).toBe(shared);
    }
  });

  it("agrees on the grace window", () => {
    expect(GRACE_DAYS).toBe(SHARED_GRACE_DAYS);
  });
});
