import { describe, expect, it } from "vitest";
import {
  monthlyAmount,
  monthsBack,
  mrrByTier,
  primaryCurrency,
  revenueByMonth,
  type PaidInvoice,
} from "../supabase/functions/admin-finance-stats/stats";

const at = (iso: string) => Date.parse(iso) / 1000;

describe("finance stats", () => {
  it("lists the last months oldest first, crossing a year", () => {
    expect(monthsBack(new Date("2026-02-15T12:00:00Z"), 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("buckets net revenue by the month it was paid, in one currency", () => {
    const invoices: PaidInvoice[] = [
      {
        customer: "a",
        amount: 999,
        refunded: 0,
        currency: "gbp",
        paidAt: at("2026-09-30T23:59:00Z"),
      },
      {
        customer: "b",
        amount: 1999,
        refunded: 1999,
        currency: "gbp",
        paidAt: at("2026-10-01T00:01:00Z"),
      },
      {
        customer: "c",
        amount: 2999,
        refunded: 0,
        currency: "gbp",
        paidAt: at("2026-10-12T10:00:00Z"),
      },
      {
        customer: "d",
        amount: 5000,
        refunded: 0,
        currency: "usd",
        paidAt: at("2026-10-12T10:00:00Z"),
      },
    ];
    expect(revenueByMonth(invoices, ["2026-09", "2026-10"], "gbp")).toEqual([
      999, 2999,
    ]);
  });

  it("picks the currency most money came in", () => {
    expect(
      primaryCurrency([
        {
          customer: null,
          amount: 100,
          refunded: 0,
          currency: "usd",
          paidAt: 0,
        },
        {
          customer: null,
          amount: 900,
          refunded: 0,
          currency: "gbp",
          paidAt: 0,
        },
      ]),
    ).toBe("gbp");
    expect(primaryCurrency([])).toBe("gbp");
  });

  it("counts a yearly plan as a twelfth per month", () => {
    expect(
      monthlyAmount({
        tier: "pro",
        unitAmount: 12000,
        quantity: 1,
        currency: "gbp",
        interval: "year",
        intervalCount: 1,
      }),
    ).toBe(1000);
    expect(
      monthlyAmount({
        tier: "pro",
        unitAmount: 3000,
        quantity: 1,
        currency: "gbp",
        interval: "month",
        intervalCount: 3,
      }),
    ).toBe(1000);
  });

  it("splits MRR by tier and skips other currencies", () => {
    const { total, byTier } = mrrByTier(
      [
        {
          tier: "pro",
          unitAmount: 1999,
          quantity: 1,
          currency: "gbp",
          interval: "month",
          intervalCount: 1,
        },
        {
          tier: "pro",
          unitAmount: 1999,
          quantity: 1,
          currency: "gbp",
          interval: "month",
          intervalCount: 1,
        },
        {
          tier: "business",
          unitAmount: 4999,
          quantity: 1,
          currency: "gbp",
          interval: "month",
          intervalCount: 1,
        },
        {
          tier: "pro",
          unitAmount: 1999,
          quantity: 1,
          currency: "usd",
          interval: "month",
          intervalCount: 1,
        },
      ],
      "gbp",
    );
    expect(total).toBe(8997);
    expect(byTier.get("pro")).toBe(3998);
    expect(byTier.get("business")).toBe(4999);
  });
});
