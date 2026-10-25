// Pure money arithmetic for admin-finance-stats, kept free of Stripe and Deno
// so vitest can run it. All amounts are in minor units (pence, cents).

export type PaidInvoice = {
  customer: string | null;
  amount: number;
  refunded: number;
  currency: string;
  // Unix seconds the invoice was paid.
  paidAt: number;
};

export type RecurringItem = {
  tier: string | null;
  unitAmount: number;
  quantity: number;
  currency: string;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
};

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

/** The currency most of the money came in, so totals are never summed across currencies. */
export function primaryCurrency(
  invoices: PaidInvoice[],
  fallback = "gbp",
): string {
  const totals = new Map<string, number>();
  for (const inv of invoices) {
    totals.set(inv.currency, (totals.get(inv.currency) ?? 0) + inv.amount);
  }
  let best = fallback;
  let bestTotal = -1;
  for (const [currency, total] of totals) {
    if (total > bestTotal) {
      best = currency;
      bestTotal = total;
    }
  }
  return best;
}

/** Net revenue (paid minus refunded) per month in `months`, in one currency. */
export function revenueByMonth(
  invoices: PaidInvoice[],
  months: string[],
  currency: string,
): number[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const out = months.map(() => 0);
  for (const inv of invoices) {
    if (inv.currency !== currency) continue;
    const i = index.get(monthKey(inv.paidAt));
    if (i !== undefined) out[i] += inv.amount - inv.refunded;
  }
  return out;
}

const PER_MONTH: Record<RecurringItem["interval"], number> = {
  day: 365 / 12,
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
};

/** What one subscription item brings in per month at list price. */
export function monthlyAmount(item: RecurringItem): number {
  const perInterval = item.unitAmount * item.quantity;
  return Math.round(
    (perInterval * PER_MONTH[item.interval]) / Math.max(1, item.intervalCount),
  );
}

/** Monthly recurring revenue, in one currency, split by tier. */
export function mrrByTier(
  items: RecurringItem[],
  currency: string,
): { total: number; byTier: Map<string, number> } {
  const byTier = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    if (item.currency !== currency) continue;
    const amount = monthlyAmount(item);
    total += amount;
    const tier = item.tier ?? "unknown";
    byTier.set(tier, (byTier.get(tier) ?? 0) + amount);
  }
  return { total, byTier };
}
