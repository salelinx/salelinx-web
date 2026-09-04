// deno-lint-ignore-file
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { referralCouponFor } from "../_shared/referral-coupons.ts";

const corsHeaders = sharedCorsHeaders();

// Checkout redirect targets are built here, never taken from the request.
// A caller-supplied success_url can send a paying customer to any site.
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://salelinx.com").replace(
  /\/$/,
  "",
);
// Stripe substitutes the placeholder with the Checkout Session id; the
// account page's CheckoutSuccessTracker uses it to fire the ad-conversion
// event exactly once per checkout.
const SUCCESS_URL = `${SITE_URL}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL = `${SITE_URL}/pricing`;

// Trial policy lives server-side. The client used to pass trialDays, which let
// anyone POST {trialDays: 30, priceId: <business>} and self-issue a free month
// on the top tier, repeatedly, since payment_method_collection is "if_required".
const TRIAL_TIER_ID = "starter";
const TRIAL_DAYS = 14;

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

  // Rate limit: checkout sessions are unmetered Stripe API calls in our
  // name. The counter RPC is auth.uid()-scoped, so this charges the caller
  // only. 20/day is far above any real purchase flow.
  const dayKey = new Date().toISOString().slice(0, 10);
  const { data: sessionCount, error: rlErr } = await supabase.rpc(
    "increment_usage_counter",
    { p_feature: "checkout_sessions", p_period_key: dayKey },
  );
  if (rlErr) {
    console.error(
      "[create-checkout-session] rate-limit counter failed:",
      rlErr.message,
    );
    return json({ error: "Rate-limit check failed" }, 500);
  }
  if (typeof sessionCount === "number" && sessionCount > 20) {
    return json(
      {
        error: "Too many checkout attempts, try again tomorrow",
        code: "rate_limited",
      },
      429,
    );
  }

  let priceId: unknown;
  let withTrial: unknown;
  try {
    ({ priceId, withTrial } = await req.json());
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

  // The trial is OPT-IN. The trial card and the Starter card post the same
  // Starter price, so without this flag the server could not tell them apart
  // and anyone pressing "Subscribe" on Starter was silently put on a trial
  // instead of subscribing.
  //
  // Letting the client ask is safe in a way that letting it pass `trialDays`
  // was not: this is a boolean, and every eligibility gate below still runs
  // server-side. A caller can decline a trial or request the standard one - it
  // can never lengthen it, nor attach it to Pro or Business.
  //
  // Absent flag means NO trial: "subscribe" should charge, and the only caller
  // that wants a trial now says so explicitly.
  let trialEligible =
    withTrial === true && tierId === TRIAL_TIER_ID && rows.length === 0;

  // Trial history also sticks to platform accounts, not just this user_id:
  // if any Depop/Vinted account this user has linked was ever attached to a
  // previously-billed SaleLinx account, no new trial (they can still pay).
  // Closes the "new throwaway email + same Depop account" farming loop. The
  // RPC runs as the caller and only inspects their own linked_accounts; the
  // trial_history tombstones survive account deletion by design (migration
  // 014). Same story for disposable email domains: signup is allowed, the
  // free trial is not.
  if (trialEligible) {
    if (isDisposableEmail(user.email ?? "")) {
      trialEligible = false;
    } else {
      const { data: platformTrialed } = await supabase.rpc(
        "has_trialed_platform_account",
      );
      if (platformTrialed === true) trialEligible = false;
    }
  }

  // Reuse the Stripe customer if we already have one, so a re-subscribe keeps
  // its billing history instead of spawning a duplicate customer record.
  const customerId = rows.find((r) => r.stripe_customer_id)?.stripe_customer_id;

  // Referred users get the first-month discount coupon auto-applied. The RPC
  // runs as the user (anon client), so it can only ever report their own
  // pending referral. Stripe rejects `discounts` together with
  // `allow_promotion_codes`, so a referred checkout drops the promo-code
  // field - a referred user cannot also enter a promo code (accepted
  // trade-off; the referral discount wins).
  //
  // The coupon is chosen PER TIER (see _shared/referral-coupons.ts): the offer
  // is a first-month price per plan, which is three different reductions and
  // so cannot be one coupon.
  let applyReferralDiscount = false;
  const referralCouponId = referralCouponFor(tierId);
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
          // Card required up front (payment_method_collection defaults to
          // "always"): the trial auto-converts to paid Starter at the end of
          // TRIAL_DAYS unless the user cancels first. This is deliberate - it
          // matches the disclosed UI/FAQ copy ("card required, then billed")
          // and keeps trial farming expensive (a real chargeable card per
          // cycle). Do NOT reintroduce payment_method_collection:"if_required"
          // + missing_payment_method:"cancel": that makes the trial card-free,
          // which contradicts the copy and doubles the farming payoff. See
          // docs/STRIPE.md.
          subscription_data: {
            trial_period_days: TRIAL_DAYS,
          },
        }
      : {}),
  });

  return json({ url: session.url }, 200);
});
