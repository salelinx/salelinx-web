// deno-lint-ignore-file
// admin-finance-stats: the numbers on /admin/finance. Read-only: it reads
// Stripe's balance transactions and subscriptions and never writes anywhere.
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
  monthKey,
  monthsBack,
  percent,
  perMonth,
  type BalanceTxn,
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
  const months = monthsBack(now, MONTHS);
  const windowStart =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1) / 1000;
  const monthStart =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;

  let currency = "gbp";
  let money: ReturnType<typeof moneyByMonth>;
  let mrr = 0;
  const mrrByTier = new Map<string, number>();
  let paying = 0;
  let paidNothing = 0;
  let trialing: number;
  let pastDue: number;
  let cancelled: number;
  let trialsEnded: number;
  try {
    const [balance, activeRaw, trialingRaw, pastDueRaw, cancelledRaw] =
      await Promise.all([
        take(
          stripe.balanceTransactions.list({
            created: { gte: windowStart },
            limit: 100,
          }),
          MAX_TXNS,
        ),
        take(
          stripe.subscriptions.list({
            status: "active",
            limit: 100,
            expand: ["data.latest_invoice.charge.balance_transaction"],
          }),
          MAX_SUBSCRIPTIONS,
        ),
        take(
          stripe.subscriptions.list({ status: "trialing", limit: 100 }),
          MAX_SUBSCRIPTIONS,
        ),
        take(
          stripe.subscriptions.list({ status: "past_due", limit: 100 }),
          MAX_SUBSCRIPTIONS,
        ),
        // Listed by creation, not cancellation, so every cancelled one is walked and filtered.
        take(
          stripe.subscriptions.list({ status: "canceled", limit: 100 }),
          MAX_SUBSCRIPTIONS,
        ),
      ]);

    currency = balance[0]?.currency ?? currency;
    const txns: BalanceTxn[] = balance.map((t) => ({
      type: t.type,
      amount: t.amount,
      fee: t.fee,
      net: t.net,
      created: t.created,
    }));
    money = moneyByMonth(txns, months);

    for (const sub of activeRaw) {
      const item = sub.items.data[0];
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
      const tier = item.price.metadata?.tier_id ?? "unknown";
      mrrByTier.set(tier, (mrrByTier.get(tier) ?? 0) + monthly);
    }
    trialing = trialingRaw.length;
    pastDue = pastDueRaw.length;
    // Ended inside its trial: a trial that never paid, not a paying customer lost.
    const endedThisMonth = cancelledRaw.filter(
      (s) => (s.canceled_at ?? 0) >= monthStart,
    );
    const inTrial = (s: Stripe.Subscription) =>
      !!s.trial_end && (s.canceled_at ?? 0) <= s.trial_end;
    trialsEnded = endedThisMonth.filter(inTrial).length;
    cancelled = endedThisMonth.length - trialsEnded;
  } catch (err) {
    console.error(
      "[admin-finance-stats] stripe read failed:",
      (err as Error).message,
    );
    return json({ error: "stripe_failed" }, 502);
  }

  // First payments and comps come from the database: it records the first
  // payment exactly, and a comp row (no Stripe subscription) is invisible to Stripe.
  const [newRes, compRes] = await Promise.all([
    admin
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .gte("first_paid_at", new Date(monthStart * 1000).toISOString()),
    admin
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "active")
      .is("stripe_subscription_id", null),
  ]);
  if (newRes.error)
    console.error(
      "[admin-finance-stats] first_paid_at read failed:",
      newRes.error.message,
    );
  if (compRes.error)
    console.error(
      "[admin-finance-stats] comp read failed:",
      compRes.error.message,
    );
  const newPaying = newRes.error ? null : (newRes.count ?? 0);

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
    paying,
    paid_nothing: paidNothing + (compRes.count ?? 0),
    trialing,
    past_due: pastDue,
    new_paying: newPaying,
    cancelled,
    trials_ended: trialsEnded,
    net_change: newPaying === null ? null : newPaying - cancelled,
    cancel_rate: percent(cancelled, payingAtStart),
    generated_at: now.toISOString(),
  });
});
