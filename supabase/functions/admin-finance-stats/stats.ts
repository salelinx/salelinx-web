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

const emptyMoney = (): MonthMoney => ({
  gross: 0,
  refunds: 0,
  fees: 0,
  net: 0,
});

function addTxn(to: MonthMoney, t: BalanceTxn) {
  if (CHARGES.has(t.type)) to.gross += t.amount;
  else if (REFUNDS.has(t.type)) to.refunds += -t.amount;
  else return;
  to.fees += t.fee;
  to.net += t.net;
}

/** Takings per month: gross charges, refunds paid back, Stripe's fees, and what was left. */
export function moneyByMonth(
  txns: BalanceTxn[],
  months: string[],
): MonthMoney[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const out = months.map(emptyMoney);
  for (const t of txns) {
    const i = index.get(monthKey(t.created));
    if (i !== undefined) addTxn(out[i], t);
  }
  return out;
}

/** Takings summed over every transaction from `since` (Unix seconds) on. */
export function moneySince(txns: BalanceTxn[], since = 0): MonthMoney {
  const out = emptyMoney();
  for (const t of txns) if (t.created >= since) addTxn(out, t);
  return out;
}

/** Unix seconds at the very end of a "2026-10" month. */
export function monthEnd(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return Date.UTC(y, m, 1) / 1000 - 1;
}

/** A subscription's paid renewals, each as a monthly amount, and when it ended. */
export type SubHistory = {
  ended: number | null;
  payments: { at: number; monthly: number }[];
};

export type MrrMove = {
  month: string;
  mrr: number;
  new: number;
  expansion: number;
  contraction: number;
  churned: number;
};

function mrrAt(sub: SubHistory, t: number): number {
  if (sub.ended !== null && sub.ended <= t) return 0;
  let monthly = 0;
  for (const p of sub.payments) if (p.at <= t) monthly = p.monthly;
  return monthly;
}

/**
 * How MRR moved each month, comparing every subscription's MRR at the end of
 * the month before with the end of this one. A plan change shows at the next
 * renewal it pays for, since a proration invoice is not a monthly price.
 */
export function mrrMovement(subs: SubHistory[], months: string[]): MrrMove[] {
  return months.map((month) => {
    const end = monthEnd(month);
    const [y, m] = month.split("-").map(Number);
    const before = Date.UTC(y, m - 1, 1) / 1000 - 1;
    const move: MrrMove = {
      month,
      mrr: 0,
      new: 0,
      expansion: 0,
      contraction: 0,
      churned: 0,
    };
    for (const sub of subs) {
      const was = mrrAt(sub, before);
      const now = mrrAt(sub, end);
      move.mrr += now;
      if (!was && now) move.new += now;
      else if (was && !now) move.churned += was;
      else if (now > was) move.expansion += now - was;
      else if (now < was) move.contraction += was - now;
    }
    return move;
  });
}

export type TrialSub = {
  trialStart: number;
  trialEnd: number;
  status: string;
  canceledAt: number | null;
};

/** Trials started each month, and how many went on to pay or are still running. */
export function trialFunnel(subs: TrialSub[], months: string[], now: number) {
  const out = months.map((month) => ({
    month,
    started: 0,
    converted: 0,
    running: 0,
  }));
  const index = new Map(months.map((m, i) => [m, i]));
  for (const s of subs) {
    const i = index.get(monthKey(s.trialStart));
    if (i === undefined) continue;
    out[i].started++;
    if (s.trialEnd > now && s.status === "trialing") out[i].running++;
    // Active, or cancelled only after its trial: it billed at least once.
    // A failing first payment (past_due) is not counted until it pays.
    else if (
      s.status === "active" ||
      (s.status === "canceled" && (s.canceledAt ?? 0) > s.trialEnd)
    )
      out[i].converted++;
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
