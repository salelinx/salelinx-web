// deno-lint-ignore-file
// admin-change-plan: change a customer's PAID plan in Stripe, from the admin
// console (/admin/users detail drawer). This is the "real" plan change: it
// swaps the price on the customer's live Stripe subscription, Stripe then
// fires customer.subscription.updated, and the existing stripe-webhook maps
// the new price's tier_id metadata back onto the subscriptions row. Stripe
// stays the source of truth; this function never writes tier_id/status
// itself. (Entitlement-only overrides, comps, and bespoke tiers use the
// admin_set_user_subscription RPC instead - see docs/ADMIN.md.)
//
// Auth: verify_jwt = false at the gateway (ES256, same as the other authed
// functions); the handler validates the caller via getUser() and then gates
// on admin_users membership via the service role. The audit entry is written
// here with the verified caller as actor.
//
// Body: { userId: <target user uuid>, tierId: <target tier id> }
// Proration: create_prorations (charge/credit the difference now). Downgrades
// that should wait for period end belong in the Stripe dashboard.

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status = 200): Response {
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

  // Admin gate. The service role bypasses RLS, so this read is authoritative:
  // no admin_users row means 403 regardless of what the client claims.
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

  let userId: unknown;
  let tierId: unknown;
  try {
    ({ userId, tierId } = await req.json());
  } catch {
    return json({ error: "missing_params" }, 400);
  }
  if (typeof userId !== "string" || typeof tierId !== "string" || !tierId) {
    return json({ error: "missing_params" }, 400);
  }

  // The target user's current entitled, Stripe-managed subscription. A comp
  // row (no Stripe ids) or a lapsed subscription has nothing to change in
  // Stripe - that is what the entitlement override RPC is for.
  const { data: subs, error: subErr } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, tier_id, status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (subErr) return json({ error: subErr.message }, 500);

  const ENTITLED = new Set(["active", "trialing", "past_due"]);
  const target = (subs ?? []).find(
    (r) => ENTITLED.has(r.status as string) && r.stripe_subscription_id,
  );
  if (!target) return json({ error: "no_stripe_subscription" }, 409);

  // Resolve the tier's price the same way the webhook maps it back: by the
  // tier_id / billing_cycle metadata on the Stripe Price. No lookup table.
  const prices = await stripe.prices.list({
    active: true,
    type: "recurring",
    limit: 100,
  });
  const price = prices.data.find(
    (p) =>
      (p.metadata?.tier_id ?? "") === tierId &&
      (p.metadata?.billing_cycle ?? "monthly") === "monthly",
  );
  if (!price) return json({ error: "no_price_for_tier" }, 400);

  const stripeSub = await stripe.subscriptions.retrieve(
    target.stripe_subscription_id as string,
  );
  if (stripeSub.status === "canceled") {
    return json({ error: "subscription_canceled" }, 409);
  }
  const item = stripeSub.items.data[0];
  if (!item) return json({ error: "no_subscription_item" }, 409);
  if (item.price.id === price.id) return json({ error: "already_on_plan" }, 409);

  await stripe.subscriptions.update(target.stripe_subscription_id as string, {
    items: [{ id: item.id, price: price.id }],
    proration_behavior: "create_prorations",
  });

  // Audit with the verified caller as actor. The service role writes past the
  // (intentionally absent) client policies on admin_audit_log. Metadata
  // carries NO user ids (docs/GDPR.md: audit entries must not reference
  // users); target_id is the subscription row id, which cascades away if the
  // account is later erased.
  const { error: auditErr } = await admin.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "user.stripe_plan_change",
    target_table: "subscriptions",
    target_id: target.id,
    metadata: {
      old_tier: target.tier_id,
      new_tier: tierId,
      old_price: item.price.id,
      new_price: price.id,
    },
  });
  if (auditErr) console.error("audit insert failed:", auditErr.message);

  // The subscriptions row is NOT updated here: Stripe fires
  // customer.subscription.updated and stripe-webhook syncs tier_id/status.
  return json({ ok: true, tier_id: tierId, price_id: price.id });
});
