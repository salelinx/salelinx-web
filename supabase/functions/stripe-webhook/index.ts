// deno-lint-ignore-file
// Deployed to Supabase Edge Functions. Runs in Deno, not Node.

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type PriceMetadata = {
  tier_id?: string;
  billing_cycle?: "monthly";
};

function tierFromPrice(price: Stripe.Price): {
  tier_id: string;
  billing_cycle: string;
} {
  const md = (price.metadata ?? {}) as PriceMetadata;
  if (!md.tier_id || !md.billing_cycle) {
    throw new Error(
      `Stripe price ${price.id} is missing tier_id or billing_cycle metadata`,
    );
  }
  return { tier_id: md.tier_id, billing_cycle: md.billing_cycle };
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

// In Stripe API version 2025-02-24.acacia, `current_period_end` moved off the
// Subscription object onto each item. Read from items first; fall back to the
// top-level field for older events that still carry it.
function periodEndFromSubscription(
  sub: Stripe.Subscription,
): number | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  if (fromItem) return fromItem;
  // @ts-expect-error legacy field, still present on older events
  const legacy = sub.current_period_end as number | undefined;
  return legacy ?? null;
}

async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.client_reference_id;
  if (!userId) throw new Error("checkout session missing client_reference_id");
  if (typeof session.subscription !== "string") {
    throw new Error("checkout session has no subscription id");
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription,
    { expand: ["items.data.price", "latest_invoice"] },
  );
  const price = subscription.items.data[0]?.price;
  if (!price) throw new Error("subscription has no price");
  const { tier_id } = tierFromPrice(price);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      tier_id,
      tier_version: 1,
      status: subscription.status,
      current_period_end: isoFromUnix(periodEndFromSubscription(subscription)),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);

  // Referral conversion for instant (non-trial) purchases. This cannot be
  // left to invoice.payment_succeeded alone: that event often arrives BEFORE
  // this one, misses the subscriptions row we just upserted, and skips. Here
  // we know the user directly (client_reference_id), so convert now if the
  // first invoice was genuinely paid. The status='pending' guard makes this
  // and the invoice path no-ops of each other, whichever runs second.
  const firstInvoice = subscription.latest_invoice as Stripe.Invoice | null;
  if (firstInvoice && (firstInvoice.amount_paid ?? 0) > 0) {
    const { error: refError } = await supabase
      .from("referrals")
      .update({ status: "converted", converted_at: new Date().toISOString() })
      .eq("referee_id", userId)
      .eq("status", "pending");
    if (refError) {
      throw new Error(`referral convert failed: ${refError.message}`);
    }
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const price = subscription.items.data[0]?.price;
  if (!price) return;
  const { tier_id } = tierFromPrice(price);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      tier_id,
      status: subscription.status,
      current_period_end: isoFromUnix(periodEndFromSubscription(subscription)),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    })
    .eq("stripe_subscription_id", subscription.id);
  if (error) throw new Error(`subscriptions update failed: ${error.message}`);
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id);
  if (error) throw new Error(`subscriptions cancel failed: ${error.message}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subId =
    typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subId) return;
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);
  if (error) throw new Error(`past_due update failed: ${error.message}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subId =
    typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subId) return;
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subId)
    .eq("status", "past_due");
  if (error) throw new Error(`active reset failed: ${error.message}`);

  await markReferralConverted(invoice, subId);
}

// Referral conversion: the referee's first PAID invoice flips their pending
// referral to 'converted' (the reward itself is granted 7 days later by
// process-referral-rewards). No billing_reason logic needed: a pending row
// exists at most once per referee, so the status guard makes every later
// invoice a no-op. Trials convert on the first real charge at day 7
// (billing_reason 'subscription_cycle'), which amount_paid > 0 covers.
async function markReferralConverted(
  invoice: Stripe.Invoice,
  subId: string,
): Promise<void> {
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return;

  // Invoices carry no client_reference_id; map back to our user through the
  // subscriptions row. A miss is NOT an error - this invoice event can race
  // checkout.session.completed - and the next cycle's invoice heals it.
  const { data: subRow, error: lookupError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`referral lookup failed: ${lookupError.message}`);
  }
  if (!subRow) return;

  const { error } = await supabase
    .from("referrals")
    .update({ status: "converted", converted_at: new Date().toISOString() })
    .eq("referee_id", subRow.user_id)
    .eq("status", "pending");
  if (error) throw new Error(`referral convert failed: ${error.message}`);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response(`Webhook error: ${(err as Error).message}`, {
      status: 400,
    });
  }

  console.log(`[stripe-webhook] received ${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(
          `[stripe-webhook] checkout.session.completed mode=${session.mode} ` +
            `client_reference_id=${session.client_reference_id} ` +
            `subscription=${session.subscription}`,
        );
        if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session);
          console.log(`[stripe-webhook] subscription insert succeeded`);
        }
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.payment_succeeded": {
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] ${event.type} failed:`, err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
