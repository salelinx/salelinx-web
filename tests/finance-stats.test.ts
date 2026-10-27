import { describe, expect, it } from "vitest";
import {
  moneyByMonth,
  moneySince,
  monthsBack,
  mrrMovement,
  percent,
  perMonth,
  trialFunnel,
  type BalanceTxn,
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

  it("adds up settled money by month: gross, refunds, fees and net", () => {
    const txns: BalanceTxn[] = [
      {
        type: "charge",
        amount: 999,
        fee: 35,
        net: 964,
        created: at("2026-09-30T23:59:00Z"),
      },
      {
        type: "charge",
        amount: 1999,
        fee: 50,
        net: 1949,
        created: at("2026-10-01T00:01:00Z"),
      },
      {
        type: "refund",
        amount: -1999,
        fee: 0,
        net: -1999,
        created: at("2026-10-03T09:00:00Z"),
      },
      {
        type: "payout",
        amount: -5000,
        fee: 0,
        net: -5000,
        created: at("2026-10-05T09:00:00Z"),
      },
    ];
    expect(moneyByMonth(txns, ["2026-09", "2026-10"])).toEqual([
      { gross: 999, refunds: 0, fees: 35, net: 964 },
      { gross: 1999, refunds: 1999, fees: 50, net: -50 },
    ]);
  });

  it("turns a billing period into a monthly figure", () => {
    expect(perMonth(12000, "year")).toBe(1000);
    expect(perMonth(3000, "month", 3)).toBe(1000);
    expect(perMonth(999, "month")).toBe(999);
  });

  it("gives no percentage when there is nothing to divide by", () => {
    expect(percent(7, 10)).toBe(70);
    expect(percent(1, 0)).toBeNull();
  });
});

describe("finance history", () => {
  it("totals takings from a date on", () => {
    const txns: BalanceTxn[] = [
      {
        type: "charge",
        amount: 1000,
        fee: 50,
        net: 950,
        created: at("2025-12-01T00:00:00Z"),
      },
      {
        type: "charge",
        amount: 2000,
        fee: 80,
        net: 1920,
        created: at("2026-02-01T00:00:00Z"),
      },
      {
        type: "refund",
        amount: -500,
        fee: 0,
        net: -500,
        created: at("2026-03-01T00:00:00Z"),
      },
      {
        type: "payout",
        amount: -3000,
        fee: 0,
        net: -3000,
        created: at("2026-03-02T00:00:00Z"),
      },
    ];
    expect(moneySince(txns)).toEqual({
      gross: 3000,
      refunds: 500,
      fees: 130,
      net: 2370,
    });
    expect(moneySince(txns, at("2026-01-01T00:00:00Z")).gross).toBe(2000);
  });

  it("splits MRR movement into new, upgrades, downgrades and cancelled", () => {
    const moves = mrrMovement(
      [
        // New in Feb, upgraded at its March renewal.
        {
          ended: null,
          payments: [
            { at: at("2026-02-10T00:00:00Z"), monthly: 1000 },
            { at: at("2026-03-10T00:00:00Z"), monthly: 2500 },
          ],
        },
        // Paying since January, cancelled in March.
        {
          ended: at("2026-03-05T00:00:00Z"),
          payments: [{ at: at("2026-01-05T00:00:00Z"), monthly: 1000 }],
        },
        // Downgraded at its March renewal.
        {
          ended: null,
          payments: [
            { at: at("2026-01-20T00:00:00Z"), monthly: 2500 },
            { at: at("2026-03-20T00:00:00Z"), monthly: 1000 },
          ],
        },
      ],
      ["2026-02", "2026-03"],
    );
    expect(moves[0]).toEqual({
      month: "2026-02",
      mrr: 4500,
      new: 1000,
      expansion: 0,
      contraction: 0,
      churned: 0,
    });
    expect(moves[1]).toEqual({
      month: "2026-03",
      mrr: 3500,
      new: 0,
      expansion: 1500,
      contraction: 1500,
      churned: 1000,
    });
  });

  it("counts a trial as converted only once it has paid", () => {
    const start = at("2026-03-01T00:00:00Z");
    const end = at("2026-03-08T00:00:00Z");
    const funnel = trialFunnel(
      [
        {
          trialStart: start,
          trialEnd: end,
          status: "active",
          canceledAt: null,
        },
        {
          trialStart: start,
          trialEnd: end,
          status: "canceled",
          canceledAt: at("2026-03-04T00:00:00Z"),
        },
        {
          trialStart: start,
          trialEnd: end,
          status: "past_due",
          canceledAt: null,
        },
        {
          trialStart: start,
          trialEnd: at("2026-04-08T00:00:00Z"),
          status: "trialing",
          canceledAt: null,
        },
      ],
      ["2026-03"],
      at("2026-03-20T00:00:00Z"),
    );
    expect(funnel[0]).toEqual({
      month: "2026-03",
      started: 4,
      converted: 1,
      running: 1,
    });
  });
});
