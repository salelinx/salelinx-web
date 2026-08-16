// deno-lint-ignore-file
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

const corsHeaders = sharedCorsHeaders();

// Built here rather than taken from the request body: a caller-supplied
// return_url sends the customer wherever it likes once they leave the portal.
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://salelinx.com").replace(
  /\/$/,
  "",
);
const RETURN_URL = `${SITE_URL}/account`;

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

  // Rate limit: portal sessions are unmetered Stripe API calls in our name.
  // The counter RPC is auth.uid()-scoped, so this charges the caller only.
  const dayKey = new Date().toISOString().slice(0, 10);
  const { data: sessionCount, error: rlErr } = await supabase.rpc(
    "increment_usage_counter",
    { p_feature: "portal_sessions", p_period_key: dayKey },
  );
  if (rlErr) {
    console.error(
      "[create-portal-session] rate-limit counter failed:",
      rlErr.message,
    );
    return new Response("Rate-limit check failed", {
      status: 500,
      headers: corsHeaders,
    });
  }
  if (typeof sessionCount === "number" && sessionCount > 20) {
    return new Response("Too many requests, try again tomorrow", {
      status: 429,
      headers: corsHeaders,
    });
  }

  // A user who cancelled and re-subscribed has more than one row, and .single()
  // errors on multiple matches, which would lock them out of the portal for
  // good. Take the newest row that actually carries a customer id.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const customerId = (subs ?? []).find((s) => s.stripe_customer_id)
    ?.stripe_customer_id;

  if (!customerId)
    return new Response("No customer", { status: 404, headers: corsHeaders });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: RETURN_URL,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
