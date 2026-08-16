// deno-lint-ignore-file
// Deployed to Supabase Edge Functions. Runs in Deno, not Node.
//
// Grants referral rewards: one free month (a negative Stripe customer-balance
// transaction, i.e. a credit) to the referrer, 7 days after the referee's
// first paid invoice. Invoked daily by a Supabase Cron job (dashboard
// configured, see docs/EDGE-FUNCTIONS.md) with a shared secret header -
// never by browsers, so no CORS.
//
// Idempotency layers (in order of defense):
//   1. Atomic claim: UPDATE ... WHERE status='converted' - a concurrent run
//      gets 0 rows and moves on.
//   2. Stripe idempotency key per referral id - a crash between claim and
//      finalize retries safely within Stripe's ~24h key window.
//   3. Balance-transaction metadata scan for stale 'rewarding' rows - covers
//      retries after the key window has expired.

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqual } from "../_shared/security.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const HOLD_DAYS = 7; // refund window before a conversion pays out
const EXPIRY_DAYS = 90; // unclaimable rewards (referrer never subscribed) void
const STALE_CLAIM_MINUTES = 60; // 'rewarding' older than this = crashed run
const MAX_REWARDS_PER_REFERRER_PER_MONTH = 10;
const BATCH_SIZE = 25;

const ENTITLED = new Set(["active", "trialing", "past_due"]);

type ReferralRow = {
  id: string;
  referrer_id: string;
  referee_id: string;
  status: "converted" | "rewarding";
  converted_at: string;
};

type SubRow = {
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function newestSubscription(userId: string): Promise<SubRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`subscription lookup failed: ${error.message}`);
  return data as SubRow | null;
}

async function newestEntitledSubscription(
  userId: string,
): Promise<SubRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .in("status", [...ENTITLED])
    .not("stripe_customer_id", "is", null)
    .not("stripe_subscription_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`referrer lookup failed: ${error.message}`);
  return data as SubRow | null;
}

async function setStatus(
  id: string,
  fromStatuses: string[],
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("referrals")
    .update(patch)
    .eq("id", id)
    .in("status", fromStatuses)
    .select("id");
  if (error) throw new Error(`referral update failed: ${error.message}`);
  return (data ?? []).length > 0;
}

// For a stale 'rewarding' row: was the credit already granted by the run
// that crashed? Balance transactions carry our referral id in metadata.
async function findExistingCredit(
  customerId: string,
  referralId: string,
): Promise<Stripe.CustomerBalanceTransaction | null> {
  const txns = await stripe.customers.listBalanceTransactions(customerId, {
    limit: 100,
  });
  return (
    txns.data.find((t) => t.metadata?.referral_id === referralId) ?? null
  );
}

async function processRow(row: ReferralRow): Promise<
  "rewarded" | "voided" | "deferred"
> {
  // 1. Referee still in good standing? Lapsing inside the hold voids the
  //    reward (our refund-window proxy - a true refund on a still-active
  //    subscription is not detected, documented limitation).
  if (row.status === "converted") {
    const refereeSub = await newestSubscription(row.referee_id);
    if (!refereeSub || !ENTITLED.has(refereeSub.status)) {
      await setStatus(row.id, ["converted"], { status: "void" });
      return "voided";
    }
  }

  // 2. The reward is one month of the referrer's CURRENT plan, credited to
  //    their Stripe customer - both need a live subscription. Without one
  //    the row stays 'converted' and is retried daily until it expires.
  const referrerSub = await newestEntitledSubscription(row.referrer_id);
  if (
    !referrerSub?.stripe_customer_id ||
    !referrerSub?.stripe_subscription_id
  ) {
    const expiry = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (new Date(row.converted_at).getTime() < expiry) {
      await setStatus(row.id, ["converted", "rewarding"], { status: "void" });
      return "voided";
    }
    return "deferred";
  }

  // 3. Monthly cap - excess conversions defer to next month, never void.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count, error: capError } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", row.referrer_id)
    .eq("status", "rewarded")
    .gte("rewarded_at", monthStart.toISOString());
  if (capError) throw new Error(`cap check failed: ${capError.message}`);
  if ((count ?? 0) >= MAX_REWARDS_PER_REFERRER_PER_MONTH) {
    return "deferred";
  }

  // 4. One month of the referrer's current plan, in their own currency.
  const sub = await stripe.subscriptions.retrieve(
    referrerSub.stripe_subscription_id,
    { expand: ["items.data.price"] },
  );
  const price = sub.items.data[0]?.price;
  if (
    !price?.unit_amount ||
    price.recurring?.interval !== "month"
  ) {
    // Non-monthly prices don't exist today (docs/STRIPE.md); if one appears,
    // "one free month" needs a product decision - defer rather than guess.
    console.error(
      `[process-referral-rewards] referral ${row.id}: unsupported price, deferring`,
    );
    return "deferred";
  }

  // 5. Claim the row so a concurrent run cannot double-grant. Stale
  //    'rewarding' rows are already claimed (this is their recovery pass).
  if (row.status === "converted") {
    const claimed = await setStatus(row.id, ["converted"], {
      status: "rewarding",
      rewarding_claimed_at: new Date().toISOString(),
    });
    if (!claimed) return "deferred";
  }

  // 6. Recovery: if a crashed run already created the credit, just finalize.
  let txn =
    row.status === "rewarding"
      ? await findExistingCredit(referrerSub.stripe_customer_id, row.id)
      : null;

  // 7. Grant. Negative amount = credit, auto-applied to upcoming invoices.
  if (!txn) {
    txn = await stripe.customers.createBalanceTransaction(
      referrerSub.stripe_customer_id,
      {
        amount: -price.unit_amount,
        currency: price.currency,
        description: "Referral reward: 1 free month",
        metadata: { referral_id: row.id },
      },
      { idempotencyKey: `referral-reward-${row.id}` },
    );
  }

  // 8. Finalize with the receipt.
  await setStatus(row.id, ["rewarding"], {
    status: "rewarded",
    rewarded_at: new Date().toISOString(),
    reward_amount_cents: Math.abs(txn.amount),
    reward_currency: txn.currency,
    stripe_balance_txn_id: txn.id,
  });
  return "rewarded";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("REFERRAL_CRON_SECRET");
  const presented = req.headers.get("x-referral-cron-secret") ?? "";
  if (!secret || !(await timingSafeEqual(presented, secret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const holdCutoff = new Date(
    Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const staleCutoff = new Date(
    Date.now() - STALE_CLAIM_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("referrals")
    .select("id, referrer_id, referee_id, status, converted_at")
    .or(
      `and(status.eq.converted,converted_at.lt.${holdCutoff}),` +
        `and(status.eq.rewarding,rewarding_claimed_at.lt.${staleCutoff})`,
    )
    .order("converted_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) {
    console.error(`[process-referral-rewards] scan failed: ${error.message}`);
    return json({ error: error.message }, 500);
  }

  const result = { processed: 0, rewarded: 0, voided: 0, deferred: 0, errors: 0 };

  for (const row of (rows ?? []) as ReferralRow[]) {
    result.processed += 1;
    try {
      const outcome = await processRow(row);
      result[outcome] += 1;
    } catch (err) {
      // One bad row must not block the batch; it stays in place and the
      // next run retries it. Log the referral id only (GDPR: no user data).
      result.errors += 1;
      console.error(
        `[process-referral-rewards] referral ${row.id} failed:`,
        (err as Error).message,
      );
    }
  }

  console.log(
    `[process-referral-rewards] processed=${result.processed} ` +
      `rewarded=${result.rewarded} voided=${result.voided} ` +
      `deferred=${result.deferred} errors=${result.errors}`,
  );
  return json(result);
});
