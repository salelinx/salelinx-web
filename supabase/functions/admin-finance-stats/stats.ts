// Pure money arithmetic for admin-finance-stats, kept free of Stripe and Deno
// so vitest can run it. All amounts are in minor units of the Stripe account's
// settlement currency (pence for a UK account), as Stripe's balance reports them.

/** One Stripe balance transaction, the record of money actually settled. */
export type BalanceTxn = {
  type: string;
  // Gross, negative for money going out (a refund).
  amount: number;
  fee: number;
  net: number;
  // Unix seconds.
  created: number;
};

export type MonthMoney = {
  gross: number;
  refunds: number;
  fees: number;
  net: number;
};

type Interval = "day" | "week" | "month" | "year";

const CHARGES = new Set(["charge", "payment"]);
const REFUNDS = new Set(["refund", "payment_refund"]);

/** "2026-10" for a moment, in UTC so a payment never lands in two months. */
export function monthKey(seconds: number): string {
  const d = new Date(seconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last `n` months ending with the current one, oldest first. */
export function monthsBack(now: Date, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    keys.push(monthKey(d.getTime() / 1000));
  }
  return keys;
}

/** Takings per month: gross charges, refunds paid back, Stripe's fees, and what was left. */
export function moneyByMonth(
  txns: BalanceTxn[],
  months: string[],
): MonthMoney[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const out = months.map(() => ({ gross: 0, refunds: 0, fees: 0, net: 0 }));
  for (const t of txns) {
    const i = index.get(monthKey(t.created));
    if (i === undefined) continue;
    if (CHARGES.has(t.type)) {
      out[i].gross += t.amount;
      out[i].fees += t.fee;
      out[i].net += t.net;
    } else if (REFUNDS.has(t.type)) {
      out[i].refunds += -t.amount;
      out[i].fees += t.fee;
      out[i].net += t.net;
    }
  }
  return out;
}

const PER_MONTH: Record<Interval, number> = {
  day: 365 / 12,
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
};

/** An amount billed every `count` `interval`s, as a monthly figure. */
export function perMonth(
  amount: number,
  interval: Interval,
  count = 1,
): number {
  return Math.round((amount * PER_MONTH[interval]) / Math.max(1, count));
}

/** A share of `whole`, as a whole percentage, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
