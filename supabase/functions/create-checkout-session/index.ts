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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { priceId, successUrl, cancelUrl, trialDays } = await req.json();

  // The client can only REQUEST a trial; the terms are decided here.
  // Policy: 7 days, Starter only, one per account, card always collected
  // (Stripe's default payment_method_collection for subscription mode), so
  // the trial converts to a paid Starter subscription automatically unless
  // the user cancels first.
  const TRIAL_PERIOD_DAYS = 7;
  const trialRequested = Boolean(trialDays);

  // Subscription history for this user (RLS limits the query to own rows).
  const { data: subRows, error: subErr } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (subErr) {
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Never allow a second concurrent subscription: both clients resolve the
  // user's tier from the newest entitled row, so a duplicate would shadow
  // the real plan. Plan changes go through the Customer Portal instead.
  const ENTITLED = new Set(["active", "trialing", "past_due"]);
  if ((subRows ?? []).some((r) => ENTITLED.has(r.status as string))) {
    return new Response(JSON.stringify({ error: "already_subscribed" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // One trial per account (any prior row, even canceled, burns it) and only
  // on the Starter price, verified via the price's own metadata.
  let trialPeriodDays: number | null = null;
  if (trialRequested && (subRows ?? []).length === 0) {
    const price = await stripe.prices.retrieve(priceId);
    if ((price.metadata?.tier_id ?? "") === "starter") {
      trialPeriodDays = TRIAL_PERIOD_DAYS;
    }
  }

  // Reuse the Stripe customer from a previous (lapsed) subscription so one
  // user does not accumulate customer records.
  const existingCustomerId =
    (subRows ?? []).find((r) => r.stripe_customer_id)?.stripe_customer_id ??
    null;

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
    line_items: [{ price: priceId, quantity: 1 }],
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: user.email }),
    client_reference_id: user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(applyReferralDiscount
      ? { discounts: [{ coupon: referralCouponId }] }
      : { allow_promotion_codes: true }),
    ...(trialPeriodDays
      ? { subscription_data: { trial_period_days: trialPeriodDays } }
      : {}),
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
