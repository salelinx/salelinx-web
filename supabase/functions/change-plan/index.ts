// deno-lint-ignore-file
// change-plan: let a user end their own trial early and/or move UP a tier,
// without going through Stripe Checkout.
//
// Why this exists: a trialing user is already a Stripe subscription on the
// Starter price, so create-checkout-session refuses them with 409 "you
// already have an active subscription". That left the trial cap with no
// release valve - someone who burned their 50 crosslists on day 3 had to sit
// at 50 until the trial converted on day 14, or churn. The whole point of a
// tight trial is that upgrading is one click away.
//
// What it does, in one Stripe call:
//   - trialing  -> trial_end: "now", so billing starts immediately
//   - higher tier requested -> swap the price with prorations
//   - both at once for "trialing on Starter, wants Pro today"
//
// THIS CHARGES THE CARD IMMEDIATELY. It is not a preference toggle. The
// caller must have confirmed it with the user first; there is no undo here
// beyond the normal cancel flow.
//
// Deliberately UP-ONLY. Downgrades and cancellations stay in the Stripe
// Customer Portal, where the proration, refund and period-end wording is
// Stripe's problem and not ours to get subtly wrong.
//
// Auth: verify_jwt = false at the gateway (ES256, like every other authed
// function here); the handler validates via getUser(). It only ever touches
// the CALLER's own subscription - there is no userId parameter, which is the
// difference between this and admin-change-plan.
//
// Body: { tierId?: string }  omit to stay on the current tier and just start
//                            billing (the common "end my trial" case)
//
// Stripe stays the source of truth: this never writes tier_id or status
// itself. Stripe fires customer.subscription.updated and stripe-webhook maps
// the new price's tier_id metadata back onto the subscriptions row.

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Statuses whose subscription is live enough in Stripe to modify. A canceled
// or incomplete row has nothing to change; those users re-subscribe through
// Checkout instead.
const MODIFIABLE = new Set(["active", "trialing", "past_due"]);

// Ladder order, low to high. Used only to refuse downgrades - the tier ids
// themselves come from Stripe price metadata, not from this list, so adding a
// tier does not require editing it unless that tier is upgradable-to.
const TIER_RANK: Record<string, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // Rate limit: each call is an unmetered Stripe write in our name, and a
  // retry loop here would bill a card repeatedly. The RPC is auth.uid()-
  // scoped, so this charges the caller only. 10/day is far above any real
  // upgrade flow, which is a once-ever action for most accounts.
  const dayKey = new Date().toISOString().slice(0, 10);
  const { data: callCount, error: rlErr } = await supabase.rpc(
    "increment_usage_counter",
    { p_feature: "plan_changes", p_period_key: dayKey },
  );
  if (rlErr) {
    console.error("[change-plan] rate-limit counter failed:", rlErr.message);
    return json({ error: "rate_limit_check_failed" }, 500);
  }
  if (typeof callCount === "number" && callCount > 10) {
    return json({ error: "rate_limited" }, 429);
  }

  let requestedTier: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    const raw = (body as { tierId?: unknown })?.tierId;
    if (raw !== undefined && typeof raw !== "string") {
      return json({ error: "bad_tier_id" }, 400);
    }
    requestedTier = raw as string | undefined;
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // The caller's own live Stripe subscription. RLS on `subscriptions` limits
  // this client to their own rows, so there is no user filter to forget.
  const { data: subs, error: subErr } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id, tier_id, status")
    .order("updated_at", { ascending: false });
  if (subErr) return json({ error: subErr.message }, 500);

  const target = (subs ?? []).find(
    (r) => MODIFIABLE.has(r.status as string) && r.stripe_subscription_id,
  );
  // No live subscription: they belong in Checkout, not here.
  if (!target) return json({ error: "no_subscription" }, 409);

  const stripeSub = await stripe.subscriptions.retrieve(
    target.stripe_subscription_id as string,
  );
  if (stripeSub.status === "canceled") {
    return json({ error: "subscription_canceled" }, 409);
  }
  const item = stripeSub.items.data[0];
  if (!item) return json({ error: "no_subscription_item" }, 409);

  const isTrialing = stripeSub.status === "trialing";

  // The tier the user is BILLED on. A trialing row says tier_id 'starter'
  // because that is the price Stripe is holding, even though entitlements
  // resolve it to the tighter 'trial' config - so compare against the price's
  // tier, not the row's, or "trialing on Starter -> upgrade to Starter" would
  // look like a downgrade.
  const billedTier =
    (item.price.metadata?.tier_id as string | undefined) ??
    (target.tier_id as string);

  const update: Stripe.SubscriptionUpdateParams = {};

  // Moving tier? Resolve the price the same way stripe-webhook maps it back:
  // by tier_id / billing_cycle metadata on the Stripe Price. No lookup table
  // to drift.
  if (requestedTier && requestedTier !== billedTier) {
    const from = TIER_RANK[billedTier];
    const to = TIER_RANK[requestedTier];
    if (to === undefined) return json({ error: "unknown_tier" }, 400);
    if (from !== undefined && to < from) {
      // Downgrades go through the Customer Portal on purpose - see header.
      return json({ error: "downgrade_not_supported" }, 400);
    }

    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      limit: 100,
    });
    const price = prices.data.find(
      (p) =>
        (p.metadata?.tier_id ?? "") === requestedTier &&
        (p.metadata?.billing_cycle ?? "monthly") === "monthly",
    );
    if (!price) return json({ error: "no_price_for_tier" }, 400);

    update.items = [{ id: item.id, price: price.id }];
    update.proration_behavior = "create_prorations";
  }

  // Ending the trial is what actually starts the money. Stripe bills the
  // first period immediately when trial_end moves to now.
  if (isTrialing) update.trial_end = "now";

  // Nothing to do: already on this tier and already paying. Report it rather
  // than making a no-op Stripe write.
  if (Object.keys(update).length === 0) {
    return json({ error: "already_on_plan" }, 409);
  }

  try {
    await stripe.subscriptions.update(
      target.stripe_subscription_id as string,
      update,
    );
  } catch (err) {
    // Card declined on the first real charge is the common one, and the user
    // needs to see that rather than a generic failure.
    const message = err instanceof Error ? err.message : "stripe_error";
    console.error("[change-plan] stripe update failed:", message);
    return json({ error: "stripe_update_failed", detail: message }, 402);
  }

  // The subscriptions row is NOT written here: Stripe fires
  // customer.subscription.updated and stripe-webhook syncs tier_id + status.
  // Callers should expect a short lag before /account reflects the change.
  return json({
    ok: true,
    tier_id: requestedTier ?? billedTier,
    trial_ended: isTrialing,
  });
});
