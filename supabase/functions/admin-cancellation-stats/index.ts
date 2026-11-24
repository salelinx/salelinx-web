// deno-lint-ignore-file
// admin-cancellation-stats: the lists on /admin/finance/cancellations.
// Read-only: it reads Stripe's subscriptions and paid invoices, plus which
// account owns each Stripe customer, and never writes anywhere.
//
// Stripe is the source because only Stripe keeps why someone cancelled: the
// Customer Portal stores the reason and comment in each subscription's
// cancellation_details, and nothing copies them into the database. The comment
// is the customer's own words, so it is personal data. It passes through to
// the admin's browser and is never stored or logged here (docs/GDPR.md).
//
// Money is each subscription's last full-price payment as Stripe settled it
// (GBP), counted per month, the same way admin-finance-stats works out MRR.
//
// Auth: the shared admin gate (getUser, AAL2, admin_users).

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import { requireAdmin } from "../_shared/admin-gate.ts";
import { perMonth } from "../admin-finance-stats/stats.ts";
import {
  classifyCancellation,
  finishedTrial,
  latestAmount,
  type Payment,
  type SubFacts,
} from "./stats.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = sharedCorsHeaders();

// Ceilings on how many Stripe objects one load walks, so a large account can't
// run the function past its time limit. Far above today's volume.
const MAX_SUBSCRIPTIONS = 5000;
const MAX_INVOICES = 10000;
// Customer ids per owner lookup, to keep the query string short.
const OWNER_CHUNK = 150;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function take<T>(list: AsyncIterable<T>, max: number): Promise<T[]> {
  const out: T[] = [];
  for await (const item of list) {
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

function facts(sub: Stripe.Subscription): SubFacts {
  return {
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    cancel_at: sub.cancel_at ?? null,
    canceled_at: sub.canceled_at ?? null,
    ended_at: sub.ended_at ?? null,
    start_date: sub.start_date,
    trial_start: sub.trial_start ?? null,
    trial_end: sub.trial_end ?? null,
    current_period_end: sub.current_period_end,
    cancel_reason: sub.cancellation_details?.reason ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const gate = await requireAdmin(req, admin, corsHeaders);
  if (gate instanceof Response) return gate;

  const now = Math.floor(Date.now() / 1000);

  let subs: Stripe.Subscription[];
  let invoices: Stripe.Invoice[];
  try {
    [subs, invoices] = await Promise.all([
      take(
        stripe.subscriptions.list({
          status: "all",
          limit: 100,
          expand: ["data.customer"],
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
  } catch (err) {
    console.error(
      "[admin-cancellation-stats] stripe read failed:",
      (err as Error).message,
    );
    return json({ error: "stripe_failed" }, 502);
  }

  // Every subscription that ever settled real money, and its full-price
  // payments (create and cycle bills; a plan change's proration is not a
  // monthly price).
  let currency = "gbp";
  const paid = new Set<string>();
  const payments = new Map<string, Payment[]>();
  for (const inv of invoices) {
    const subId =
      typeof inv.subscription === "string"
        ? inv.subscription
        : inv.subscription?.id;
    const charge = typeof inv.charge === "object" ? inv.charge : null;
    const bt =
      charge && typeof charge.balance_transaction === "object"
        ? charge.balance_transaction
        : null;
    if (!subId || !bt || bt.amount <= 0) continue;
    currency = bt.currency;
    paid.add(subId);
    if (
      inv.billing_reason !== "subscription_cycle" &&
      inv.billing_reason !== "subscription_create"
    )
      continue;
    const list = payments.get(subId) ?? [];
    list.push({
      at: inv.status_transitions?.paid_at ?? inv.created,
      amount: bt.amount,
    });
    payments.set(subId, list);
  }

  let since: number | null = null;
  const trials: { at: string; paid: boolean }[] = [];
  const rows: {
    id: string;
    customer_id: string;
    email: string | null;
    tier: string;
    kind: string;
    state: string;
    reason: string | null;
    comment: string | null;
    requested_at: string;
    ends_at: string;
    day: number;
    mrr: number | null;
  }[] = [];

  for (const sub of subs) {
    since = since === null ? sub.start_date : Math.min(since, sub.start_date);
    const f = facts(sub);
    const trial = finishedTrial(f, now, paid.has(sub.id));
    if (trial) trials.push({ at: iso(trial.at), paid: trial.paid });

    const c = classifyCancellation(f);
    if (!c) continue;
    const price = sub.items.data[0]?.price;
    const recurring = price?.recurring;
    const last = latestAmount(payments.get(sub.id) ?? []);
    const customer = sub.customer;
    // A deleted customer is an erased account (admin-delete-user and
    // delete-account delete the Stripe customer), but Stripe keeps the
    // subscription and its comment. The row still counts; the comment is
    // dropped so the console never shows an erased person's words.
    const deleted = typeof customer === "object" && customer.deleted === true;
    rows.push({
      id: sub.id,
      customer_id: typeof customer === "string" ? customer : customer.id,
      email:
        typeof customer === "object" && !customer.deleted
          ? customer.email
          : null,
      tier: price?.metadata?.tier_id ?? "unknown",
      kind: c.kind,
      state: c.state,
      reason: sub.cancellation_details?.feedback ?? null,
      comment: deleted
        ? null
        : sub.cancellation_details?.comment?.trim() || null,
      requested_at: iso(c.requestedAt),
      ends_at: iso(c.endsAt),
      day: c.day,
      mrr:
        c.kind !== "trial" && last !== null && recurring
          ? perMonth(last, recurring.interval, recurring.interval_count ?? 1)
          : null,
    });
  }

  // Which account owns each customer, so a row can open the user drawer.
  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const owner = new Map<string, string>();
  for (let i = 0; i < customerIds.length; i += OWNER_CHUNK) {
    const { data, error } = await admin
      .from("subscriptions")
      .select("user_id, stripe_customer_id")
      .in("stripe_customer_id", customerIds.slice(i, i + OWNER_CHUNK));
    if (error) {
      console.error(
        "[admin-cancellation-stats] owners read failed:",
        error.message,
      );
      break;
    }
    for (const o of data ?? [])
      owner.set(o.stripe_customer_id as string, o.user_id as string);
  }

  return json({
    currency,
    since: since === null ? null : iso(since),
    rows: rows.map(({ customer_id, ...r }) => ({
      ...r,
      user_id: owner.get(customer_id) ?? null,
    })),
    trials_finished: trials,
    generated_at: new Date(now * 1000).toISOString(),
  });
});
