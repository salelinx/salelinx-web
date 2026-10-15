// deno-lint-ignore-file
// admin-list-payments: the latest successful payments, for the "Latest
// payments" card on the admin console overview (/admin). Read-only: it lists
// paid Stripe invoices and never writes to Stripe or the database.
//
// The database only records a customer's FIRST payment
// (subscriptions.first_paid_at); every later payment exists only in Stripe, so
// the list is read from there rather than from a table. Only real money is
// listed: a paid zero-value invoice is a trial opening, not a payment.
//
// Auth: the same gate as admin-change-plan. verify_jwt = false at the gateway
// (ES256), getUser() validates the caller, the JWT must be AAL2 (mirroring
// is_admin() in 003_support.sql), and admin_users membership is checked with
// the service role.
//
// Response: { payments: Payment[] }, newest payment first, at most LIMIT rows.
// The email is Stripe's snapshot on the invoice; user_id is our account when
// the Stripe customer still maps to a subscriptions row (null once the account
// has been deleted).

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
// jsr, not esm.sh: esm.sh stopped resolving supabase-js@2's auth-js module
// (Oct 2026), which fails the deploy bundle. resolve-category and
// send-shipping-labels already import from jsr.
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

const corsHeaders = sharedCorsHeaders();

// How many payments the card shows, and how many paid invoices are scanned to
// find them. Trial openings are paid zero-value invoices and get skipped, so
// the scan is wider than the answer.
const LIMIT = 10;
const SCAN = 100;

type Payment = {
  invoice_id: string;
  user_id: string | null;
  email: string | null;
  tier: string | null;
  // Stripe's billing_reason: subscription_create, subscription_cycle, ...
  reason: string | null;
  // Minor units, as Stripe reports them.
  amount: number;
  currency: string;
  refunded: number;
  paid_at: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Read the aal claim from a JWT that getUser() has ALREADY validated (never
// call this on an unverified token). base64url -> base64 padding for atob.
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

function customerId(inv: Stripe.Invoice): string | null {
  if (typeof inv.customer === "string") return inv.customer;
  return inv.customer?.id ?? null;
}

// The tier the payment was for, from the tier_id metadata on the Stripe Price
// (the same metadata stripe-webhook maps onto subscriptions.tier_id). A plan
// change invoice carries a credit line for the old price and a charge for the
// new one, so take the largest charge.
function tierFromInvoice(inv: Stripe.Invoice): string | null {
  let best: Stripe.InvoiceLineItem | null = null;
  for (const line of inv.lines?.data ?? []) {
    if (line.amount > 0 && (!best || line.amount > best.amount)) best = line;
  }
  return best?.price?.metadata?.tier_id ?? null;
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

  // Payment history is billing data about other people, so the same AAL2
  // requirement as every other admin read applies.
  if (jwtAal(authHeader) !== "aal2") {
    return json({ error: "mfa_required" }, 403);
  }

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

  let invoices: Stripe.Invoice[];
  try {
    // Expanding the charge is what tells a refunded payment apart: a refund
    // leaves the invoice "paid".
    const res = await stripe.invoices.list({
      status: "paid",
      limit: SCAN,
      expand: ["data.charge"],
    });
    invoices = res.data;
  } catch (err) {
    console.error("[admin-list-payments] stripe list failed:", (err as Error).message);
    return json({ error: "stripe_failed" }, 502);
  }

  // Stripe lists by creation time; a payment retried after a failure is paid
  // later than it was created, so re-sort by the moment it was paid.
  const paid = invoices
    .filter((inv) => (inv.amount_paid ?? 0) > 0)
    .map((inv) => ({
      inv,
      paidAt: inv.status_transitions?.paid_at ?? inv.created,
    }))
    .sort((a, b) => b.paidAt - a.paidAt)
    .slice(0, LIMIT);

  // Our account for each Stripe customer. A user can hold several
  // subscriptions rows over time, all on the same customer, so the newest row
  // names them; its tier is the fallback when the invoice's price has none.
  const customers = [
    ...new Set(paid.map(({ inv }) => customerId(inv)).filter((c): c is string => !!c)),
  ];
  const ours = new Map<string, { user_id: string; tier_id: string | null }>();
  if (customers.length > 0) {
    const { data: rows, error: rowsErr } = await admin
      .from("subscriptions")
      .select("user_id, stripe_customer_id, tier_id")
      .in("stripe_customer_id", customers)
      .order("updated_at", { ascending: false });
    if (rowsErr) {
      // Not fatal: the list still reads, just without links to accounts.
      console.error("[admin-list-payments] subscriptions read failed:", rowsErr.message);
    }
    for (const r of rows ?? []) {
      if (!ours.has(r.stripe_customer_id)) {
        ours.set(r.stripe_customer_id, { user_id: r.user_id, tier_id: r.tier_id });
      }
    }
  }

  const payments: Payment[] = paid.map(({ inv, paidAt }) => {
    const cust = customerId(inv);
    const account = cust ? ours.get(cust) : undefined;
    const charge = inv.charge && typeof inv.charge === "object" ? inv.charge : null;
    return {
      invoice_id: inv.id,
      user_id: account?.user_id ?? null,
      email: inv.customer_email ?? null,
      tier: tierFromInvoice(inv) ?? account?.tier_id ?? null,
      reason: inv.billing_reason ?? null,
      amount: inv.amount_paid,
      currency: inv.currency,
      refunded: charge?.amount_refunded ?? 0,
      paid_at: new Date(paidAt * 1000).toISOString(),
    };
  });

  return json({ payments });
});
