// Funnel math for /admin/analytics/funnel. Pure, like retention.ts: rows from
// admin_funnel_accounts() (migration 065) in, plain numbers out, pinned by
// tests/funnel.test.ts.
//
// Counted the way standard funnel tools count (Mixpanel's default order,
// PostHog's sequential funnels, GA4's closed funnels): an account counts at a
// step only if it also did every step before it, and drops out at the first
// step it skipped. Most steps here are yes/no facts without a time, so the
// order within them is not checked, which is Amplitude's "any order" rule.
//
// Skipping happens (someone can start a plan on the website before
// installing, and some paying customers have no extension activity on
// record), so everyone who paid is also counted on its own as paidTotal and
// shown next to the funnel, so no payer disappears from the page.

import { usageSource } from "@/lib/admin/usage-sources";
import type { AdminFunnelAccount } from "@/lib/types/admin";

// `short` heads the table columns.
export const FUNNEL_STEPS = [
  { key: "signed_up", label: "Created an account", short: "Signups" },
  { key: "confirmed", label: "Confirmed their email", short: "Confirmed" },
  { key: "installed", label: "Installed the extension", short: "Installed" },
  { key: "linked", label: "Linked a shop", short: "Linked" },
  { key: "used", label: "Used a feature", short: "Used" },
  { key: "subscribed", label: "Started a plan (trial or paid)", short: "Plan" },
  { key: "paid", label: "Paid", short: "Paid" },
  { key: "paying", label: "Still paying", short: "Paying" },
] as const;

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]["key"];

export const PAID_STEP = FUNNEL_STEPS.findIndex((s) => s.key === "paid");
const DAY_MS = 86_400_000;

// Index into FUNNEL_STEPS of the last step this account reached with every
// step before it done too.
export function lastStep(a: AdminFunnelAccount): number {
  const reached = [
    true,
    a.confirmed,
    a.installed,
    a.linked,
    a.features.some((f) => usageSource(f) === "extension"),
    a.subscribed_at !== null,
    a.first_paid_at !== null,
    a.paying_now,
  ];
  const skipped = reached.indexOf(false);
  return skipped === -1 ? reached.length - 1 : skipped - 1;
}

export type FunnelCounts = {
  // One per FUNNEL_STEPS entry: accounts that did that step and every one
  // before it.
  steps: number[];
  // Everyone who paid, including those who skipped a step before Paid.
  paidTotal: number;
  // In a running trial and not yet paid: the ones a recent window is waiting on.
  inTrial: number;
};

export function countFunnel(accounts: AdminFunnelAccount[]): FunnelCounts {
  const steps = FUNNEL_STEPS.map(() => 0);
  let paidTotal = 0;
  let inTrial = 0;
  for (const a of accounts) {
    const last = lastStep(a);
    for (let i = 0; i <= last; i++) steps[i]++;
    if (a.first_paid_at !== null) paidTotal++;
    if (a.in_trial_now && a.first_paid_at === null) inTrial++;
  }
  return { steps, paidTotal, inTrial };
}

// Median whole days from signup to first payment, or null when nobody paid.
export function medianDaysToPay(accounts: AdminFunnelAccount[]): number | null {
  const days = accounts
    .filter((a) => a.first_paid_at !== null)
    .map(
      (a) =>
        (Date.parse(a.first_paid_at!) - Date.parse(a.signed_up_at)) / DAY_MS,
    )
    .sort((x, y) => x - y);
  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  const median =
    days.length % 2 === 1 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  return Math.max(0, Math.round(median));
}

export type FunnelGroup = { key: string } & FunnelCounts;

// Accounts split by a key (source, device, month), most signups first unless
// the caller sorts again. A null key is grouped as "unknown".
export function groupFunnel(
  accounts: AdminFunnelAccount[],
  keyOf: (a: AdminFunnelAccount) => string | null,
): FunnelGroup[] {
  const groups = new Map<string, AdminFunnelAccount[]>();
  for (const a of accounts) {
    const key = keyOf(a) ?? "unknown";
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }
  return [...groups]
    .map(([key, list]) => ({ key, ...countFunnel(list) }))
    .sort((x, y) => y.steps[0] - x.steps[0] || x.key.localeCompare(y.key));
}

// Signup windows the page offers, as ?days= values.
export const FUNNEL_PERIODS = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export type FunnelPeriod = (typeof FUNNEL_PERIODS)[number];

export function parseFunnelPeriod(value: string | undefined): FunnelPeriod {
  return FUNNEL_PERIODS.find((p) => p.key === value) ?? FUNNEL_PERIODS[1];
}

// Accounts that signed up inside the period, ending now.
export function inPeriod(
  accounts: AdminFunnelAccount[],
  period: FunnelPeriod,
  now: Date,
): AdminFunnelAccount[] {
  if (period.days === null) return accounts;
  const since = now.getTime() - period.days * DAY_MS;
  return accounts.filter((a) => Date.parse(a.signed_up_at) >= since);
}
