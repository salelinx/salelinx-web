// deno-lint-ignore-file
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Checkout redirect targets are built here, never taken from the request.
// A caller-supplied success_url can send a paying customer to any site.
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://salelinx.com").replace(
  /\/$/,
  "",
);
const SUCCESS_URL = `${SITE_URL}/account?checkout=success`;
const CANCEL_URL = `${SITE_URL}/pricing`;

// Trial policy lives server-side. The client used to pass trialDays, which let
// anyone POST {trialDays: 30, priceId: <business>} and self-issue a free month
// on the top tier, repeatedly, since payment_method_collection is "if_required".
const TRIAL_TIER_ID = "starter";
const TRIAL_DAYS = 7;

// Statuses that mean "this user already has a subscription", so checkout should
// send them to the Customer Portal instead of creating a second one.
const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused"];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  let priceId: unknown;
  try {
    ({ priceId } = await req.json());
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (typeof priceId !== "string" || !priceId.startsWith("price_")) {
    return json({ error: "Invalid priceId" }, 400);
  }

  // Resolve the price against our own Stripe account. This is the allowlist:
  // it has to exist, be active, be a recurring price, and carry the tier
  // metadata the webhook needs. Without the metadata check a completed
  // checkout would later throw in the webhook, charging the customer while
  // writing no subscription row.
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch {
    return json({ error: "Unknown priceId" }, 400);
  }
  const tierId = (price.metadata ?? {}).tier_id;
  const billingCycle = (price.metadata ?? {}).billing_cycle;
  if (!price.active || price.type !== "recurring" || !tierId || !billingCycle) {
    return json({ error: "Price is not available for checkout" }, 400);
  }

  // One subscription per user. Ordering matters because a user who cancelled
  // and re-subscribed has more than one row, so .single() would error.
  const { data: existing, error: subErr } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (subErr) {
    return json({ error: subErr.message }, 500);
  }

  const rows = existing ?? [];
  if (rows.some((r) => LIVE_STATUSES.includes(r.status))) {
    return json({ error: "You already have an active subscription" }, 409);
  }

  // Trials are for first-time customers on the entry tier only. Any prior
  // subscription row, in any state, means this account has already been through
  // billing once and is not eligible again.
  const trialEligible = tierId === TRIAL_TIER_ID && rows.length === 0;

  // Reuse the Stripe customer if we already have one, so a re-subscribe keeps
  // its billing history instead of spawning a duplicate customer record.
  const customerId = rows.find((r) => r.stripe_customer_id)?.stripe_customer_id;

  // Referred users get the first-month discount coupon auto-applied. The RPC
  // runs as the user (anon client), so it can only ever report their own
  // pending referral. Stripe rejects `discounts` together with
  // `allow_promotion_codes`, so a referred checkout drops the promo-code
  // field - a referred user cannot also enter a promo code (accepted
  // trade-off; the referral discount wins).
  let applyReferralDiscount = false;
  const referralCouponId = Deno.env.get("REFERRAL_COUPON_ID") ?? "";
  if (referralCouponId) {
    const { data: hasReferral } = await supabase.rpc("has_pending_referral");
    applyReferralDiscount = hasReferral === true;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    ...(customerId ? { customer: customerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    ...(applyReferralDiscount
      ? { discounts: [{ coupon: referralCouponId }] }
      : { allow_promotion_codes: true }),
    ...(trialEligible
      ? {
          subscription_data: {
            trial_period_days: TRIAL_DAYS,
            trial_settings: {
              end_behavior: { missing_payment_method: "cancel" },
            },
          },
          payment_method_collection: "if_required",
        }
      : {}),
  });

  return json({ url: session.url }, 200);
});
