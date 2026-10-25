import { describe, expect, it } from "vitest";
import {
  moneyByMonth,
  monthsBack,
  percent,
  perMonth,
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
