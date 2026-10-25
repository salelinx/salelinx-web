// deno-lint-ignore-file
// admin-finance-stats: the numbers on /admin/finance. Read-only: it reads
// Stripe's balance, payouts, balance transactions, subscriptions and paid
// invoices, plus referral credits from the database, and never writes anywhere.
//
// Stripe is the source because the database keeps only each customer's first
// payment (subscriptions.first_paid_at). Money is what Stripe settled into the
// account (balance transactions), so customers paying in EUR or USD arrive
// already converted at the rate Stripe used, and fees are known. MRR is each
// active subscription's last real payment in that same currency, so discounts
// count; a plan change's proration is not a monthly price, so for those the
// list price is converted at the rate that payment settled at.
//
// Auth: the same gate as admin-list-payments (getUser, AAL2, admin_users).

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import {
  moneyByMonth,
  moneySince,
  monthKey,
  monthsBack,
  mrrMovement,
  percent,
  perMonth,
  trialFunnel,
  type BalanceTxn,
  type SubHistory,
} from "./stats.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = sharedCorsHeaders();

const MONTHS = 12;
// Ceilings on how many Stripe objects one load walks, so a large account can't
// run the function past its time limit. Far above today's volume.
const MAX_TXNS = 10000;
const MAX_SUBSCRIPTIONS = 5000;
const MAX_INVOICES = 10000;
const DAY = 86400;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Read the aal claim from a JWT that getUser() has ALREADY validated.
function jwtAal(authHeader: string): string {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)).aal ?? "";
  } catch {
    return "";
  }
}

async function take<T>(list: AsyncIterable<T>, max: number): Promise<T[]> {
  const out: T[] = [];
  for await (const item of list) {
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (jwtAal(authHeader) !== "aal2")
    return json({ error: "mfa_required" }, 403);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: adminRow, error: adminErr } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminErr || !adminRow)
    return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const months = monthsBack(now, MONTHS);
  const monthStart =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000;
  const soon = nowSec + 30 * DAY;

  let currency = "gbp";
  let money: ReturnType<typeof moneyByMonth>;
  let allTime: ReturnType<typeof moneySince>;
  let thisYear: ReturnType<typeof moneySince>;
  let firstPaymentAt: number | null = null;
  let available = 0;
  let pending = 0;
  let nextPayout: { amount: number; arrives: number } | null = null;
  let mrr = 0;
  const mrrByTier = new Map<string, number>();
  let paying = 0;
  let paidNothing = 0;
  let trialing = 0;
  let cancelled: number;
  let trialsEnded: number;
  const renewals = { count: 0, amount: 0 };
  const settingToCancel = { count: 0, mrr: 0 };
  let trialsEndingSoon = 0;
  const failing: {
    customer_id: string;
    email: string | null;
    tier: string;
    amount: number;
    currency: string;
    since: number;
  }[] = [];
  let movement: ReturnType<typeof mrrMovement>;
  let trials: ReturnType<typeof trialFunnel>;
  try {
    const [balanceTxns, balance, payouts, subs, invoices] = await Promise.all([
      take(stripe.balanceTransactions.list({ limit: 100 }), MAX_TXNS),
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 20 }),
      take(
        stripe.subscriptions.list({
          status: "all",
          limit: 100,
          expand: [
            "data.latest_invoice.charge.balance_transaction",
            "data.customer",
          ],
        }),
        MAX_SUBSCRIPTIONS,
      ),
      take(
        stripe.invoices.list({
          status: "paid",
          limit: 100,
          expand: ["data.charge.balance_transaction"],
        }),
        MAX_INVOICES,
      ),
    ]);

    currency = balanceTxns[0]?.currency ?? currency;
    const txns: BalanceTxn[] = balanceTxns.map((t) => ({
      type: t.type,
      amount: t.amount,
      fee: t.fee,
      net: t.net,
      created: t.created,
    }));
    money = moneyByMonth(txns, months);
    allTime = moneySince(txns);
    thisYear = moneySince(txns, yearStart);
    for (const t of balanceTxns)
      if (
        (t.type === "charge" || t.type === "payment") &&
        (firstPaymentAt === null || t.created < firstPaymentAt)
      )
        firstPaymentAt = t.created;

    const inCurrency = (list: { amount: number; currency: string }[]) =>
      list
        .filter((b) => b.currency === currency)
        .reduce((sum, b) => sum + b.amount, 0);
    available = inCurrency(balance.available);
    pending = inCurrency(balance.pending);
    const upcoming = payouts.data
      .filter((p) => p.status === "pending" || p.status === "in_transit")
      .sort((a, b) => a.arrival_date - b.arrival_date)[0];
    if (upcoming)
      nextPayout = { amount: upcoming.amount, arrives: upcoming.arrival_date };

    for (const sub of subs) {
      const item = sub.items.data[0];
      const tier = item?.price?.metadata?.tier_id ?? "unknown";
      if (sub.status === "trialing") {
        trialing++;
        if ((sub.trial_end ?? 0) <= soon && !sub.cancel_at_period_end)
          trialsEndingSoon++;
        continue;
      }
      if (sub.status === "past_due") {
        const inv =
          typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
        const customer =
          typeof sub.customer === "object" && !sub.customer.deleted
            ? sub.customer
            : null;
        failing.push({
          customer_id:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          email: customer?.email ?? null,
          tier,
          amount: inv?.amount_due ?? 0,
          currency: inv?.currency ?? item?.price?.currency ?? currency,
          since: inv?.created ?? sub.current_period_start,
        });
        continue;
      }
      if (sub.status !== "active") continue;
      const recurring = item?.price?.recurring;
      const inv =
        typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
      const charge = inv && typeof inv.charge === "object" ? inv.charge : null;
      const bt =
        charge && typeof charge.balance_transaction === "object"
          ? charge.balance_transaction
          : null;
      // Nothing settled: a 100% coupon, a comp, or account credit that covered the bill.
      if (
        !recurring ||
        !inv ||
        inv.amount_paid <= 0 ||
        !charge ||
        !bt ||
        charge.amount <= 0
      ) {
        paidNothing++;
        continue;
      }
      paying++;
      const periodic =
        inv.billing_reason === "subscription_cycle" ||
        inv.billing_reason === "subscription_create"
          ? bt.amount
          : Math.round(
              (item.price.unit_amount ?? 0) *
                (item.quantity ?? 1) *
                (bt.amount / charge.amount),
            );
      const monthly = perMonth(
        periodic,
        recurring.interval,
        recurring.interval_count ?? 1,
      );
      mrr += monthly;
      mrrByTier.set(tier, (mrrByTier.get(tier) ?? 0) + monthly);
      if (sub.cancel_at_period_end) {
        settingToCancel.count++;
        settingToCancel.mrr += monthly;
      } else if (sub.current_period_end <= soon) {
        renewals.count++;
        renewals.amount += periodic;
      }
    }

    // Ended inside its trial: a trial that never paid, not a paying customer lost.
    const endedThisMonth = subs.filter(
      (s) => s.status === "canceled" && (s.canceled_at ?? 0) >= monthStart,
    );
    const inTrial = (s: Stripe.Subscription) =>
      !!s.trial_end && (s.canceled_at ?? 0) <= s.trial_end;
    trialsEnded = endedThisMonth.filter(inTrial).length;
    cancelled = endedThisMonth.length - trialsEnded;

    trials = trialFunnel(
      subs
        .filter((s) => s.trial_start && s.trial_end)
        .map((s) => ({
          trialStart: s.trial_start!,
          trialEnd: s.trial_end!,
          status: s.status,
          canceledAt: s.canceled_at,
        })),
      months,
      nowSec,
    );

    // Each subscription's renewals as monthly amounts. Only full-price bills
    // (create and cycle) count: a plan change's proration is not a monthly price.
    const interval = new Map(
      subs.map((s) => [s.id, s.items.data[0]?.price?.recurring]),
    );
    const history = new Map<string, SubHistory>(
      subs.map((s) => [s.id, { ended: s.ended_at ?? null, payments: [] }]),
    );
    for (const inv of invoices) {
      const subId =
        typeof inv.subscription === "string"
          ? inv.subscription
          : inv.subscription?.id;
      const recurring = subId ? interval.get(subId) : undefined;
      const charge = typeof inv.charge === "object" ? inv.charge : null;
      const bt =
        charge && typeof charge.balance_transaction === "object"
          ? charge.balance_transaction
          : null;
      if (
        !subId ||
        !recurring ||
        !bt ||
        bt.amount <= 0 ||
        (inv.billing_reason !== "subscription_cycle" &&
          inv.billing_reason !== "subscription_create")
      )
        continue;
      history.get(subId)?.payments.push({
        at: inv.status_transitions?.paid_at ?? inv.created,
        monthly: perMonth(
          bt.amount,
          recurring.interval,
          recurring.interval_count ?? 1,
        ),
      });
    }
    for (const h of history.values()) h.payments.sort((a, b) => a.at - b.at);
    movement = mrrMovement([...history.values()], months);
  } catch (err) {
    console.error(
      "[admin-finance-stats] stripe read failed:",
      (err as Error).message,
    );
    return json({ error: "stripe_failed" }, 502);
  }

  // First payments, comps and referral credits come from the database: it
  // records the first payment exactly, a comp row (no Stripe subscription) is
  // invisible to Stripe, and each referral credit's receipt is stored there.
  const [newRes, compRes, referralRes, ownersRes] = await Promise.all([
    admin
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .gte("first_paid_at", new Date(monthStart * 1000).toISOString()),
    admin
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "active")
      .is("stripe_subscription_id", null),
    admin
      .from("referrals")
      .select("status, reward_amount_cents, reward_currency"),
    failing.length
      ? admin
          .from("subscriptions")
          .select("user_id, stripe_customer_id")
          .in(
            "stripe_customer_id",
            failing.map((f) => f.customer_id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [name, res] of [
    ["first_paid_at", newRes],
    ["comp", compRes],
    ["referrals", referralRes],
    ["failing owners", ownersRes],
  ] as const)
    if (res.error)
      console.error(
        `[admin-finance-stats] ${name} read failed:`,
        res.error.message,
      );
  const newPaying = newRes.error ? null : (newRes.count ?? 0);

  const credited = new Map<string, { amount: number; count: number }>();
  let referralsWaiting = 0;
  for (const r of referralRes.data ?? []) {
    if (r.status === "rewarded" && r.reward_amount_cents) {
      const cur = (r.reward_currency ?? currency).toLowerCase();
      const c = credited.get(cur) ?? { amount: 0, count: 0 };
      credited.set(cur, {
        amount: c.amount + r.reward_amount_cents,
        count: c.count + 1,
      });
    } else if (r.status === "converted" || r.status === "rewarding")
      referralsWaiting++;
  }
  const owner = new Map(
    (ownersRes.data ?? []).map(
      (o: { user_id: string; stripe_customer_id: string }) => [
        o.stripe_customer_id,
        o.user_id,
      ],
    ),
  );

  const thisMonth = money[money.length - 1];
  const lastMonth = money[money.length - 2];
  // Paying at the start of the month: today's, less those who joined, plus those who left.
  const payingAtStart = paying - (newPaying ?? 0) + cancelled;

  return json({
    currency,
    month: monthKey(monthStart),
    mrr,
    arr: mrr * 12,
    arpu: paying ? Math.round(mrr / paying) : 0,
    mrr_by_tier: [...mrrByTier].map(([tier, amount]) => ({ tier, amount })),
    this_month: thisMonth,
    last_month: lastMonth,
    by_month: months.map((month, i) => ({ month, ...money[i] })),
    all_time: allTime,
    this_year: thisYear,
    first_payment_at: firstPaymentAt
      ? new Date(firstPaymentAt * 1000).toISOString()
      : null,
    balance: {
      available,
      pending,
      next_payout: nextPayout && {
        amount: nextPayout.amount,
        arrives: new Date(nextPayout.arrives * 1000).toISOString(),
      },
    },
    renewals_30d: renewals,
    setting_to_cancel: settingToCancel,
    trials_ending_30d: trialsEndingSoon,
    failing: failing
      .sort((a, b) => a.since - b.since)
      .map(({ customer_id, since, ...f }) => ({
        ...f,
        user_id: owner.get(customer_id) ?? null,
        since: new Date(since * 1000).toISOString(),
      })),
    mrr_movement: movement,
    trials: trials,
    referral_credits: [...credited].map(([cur, c]) => ({
      currency: cur,
      ...c,
    })),
    referrals_waiting: referralsWaiting,
    paying,
    paid_nothing: paidNothing + (compRes.count ?? 0),
    trialing,
    past_due: failing.length,
    new_paying: newPaying,
    cancelled,
    trials_ended: trialsEnded,
    net_change: newPaying === null ? null : newPaying - cancelled,
    cancel_rate: percent(cancelled, payingAtStart),
    generated_at: now.toISOString(),
  });
});
