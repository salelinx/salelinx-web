// deno-lint-ignore-file
// admin-finance-stats: the numbers on /admin/finance. Read-only: it lists
// Stripe's paid invoices, subscriptions and refunds and never writes anywhere.
//
// Stripe is the source because the database keeps only each customer's first
// payment (subscriptions.first_paid_at). Money is reported in one currency, the
// one most revenue came in; anything in another currency is named in
// `other_currencies` rather than summed in. MRR is at list price: coupons and
// referral balance credits are not taken off.
//
// Auth: the same gate as admin-list-payments (getUser, AAL2, admin_users).

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import {
  monthKey,
  monthsBack,
  mrrByTier,
  primaryCurrency,
  revenueByMonth,
  type PaidInvoice,
  type RecurringItem,
} from "./stats.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = sharedCorsHeaders();

const MONTHS = 12;
// Ceilings on how many Stripe objects one load walks, so a large account can't
// run the function past its time limit. Far above today's volume.
const MAX_INVOICES = 5000;
const MAX_SUBSCRIPTIONS = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Read the aal claim from a JWT that getUser() has ALREADY validated.
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

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : (v?.id ?? null);

async function take<T>(list: AsyncIterable<T>, max: number): Promise<T[]> {
  const out: T[] = [];
  for await (const item of list) {
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
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
  if (jwtAal(authHeader) !== "aal2")
    return json({ error: "mfa_required" }, 403);

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

  const now = new Date();
  const months = monthsBack(now, MONTHS);
  const windowStart =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1) / 1000;
  const monthStart =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;

  let invoices: PaidInvoice[];
  let items: RecurringItem[];
  let payingCustomers: Set<string>;
  let trialing: number;
  let cancelledThisMonth: number;
  let refunds: { amount: number; currency: string }[];
  try {
    const [paidRaw, activeRaw, trialingRaw, cancelledRaw, refundsRaw] =
      await Promise.all([
        // A month's grace before the window: a retried invoice is paid after it was created.
        take(
          stripe.invoices.list({
            status: "paid",
            created: { gte: windowStart - 31 * 86400 },
            limit: 100,
            expand: ["data.charge"],
          }),
          MAX_INVOICES,
        ),
        take(
          stripe.subscriptions.list({ status: "active", limit: 100 }),
          MAX_SUBSCRIPTIONS,
        ),
        take(
          stripe.subscriptions.list({ status: "trialing", limit: 100 }),
          MAX_SUBSCRIPTIONS,
        ),
        // Listed by creation, not cancellation, so every cancelled one is walked and filtered.
        take(
          stripe.subscriptions.list({ status: "canceled", limit: 100 }),
          MAX_SUBSCRIPTIONS,
        ),
        take(
          stripe.refunds.list({ created: { gte: monthStart }, limit: 100 }),
          MAX_INVOICES,
        ),
      ]);

    // A paid zero-value invoice is a trial opening, not a payment.
    invoices = paidRaw
      .filter((inv) => (inv.amount_paid ?? 0) > 0)
      .map((inv) => {
        const charge =
          inv.charge && typeof inv.charge === "object" ? inv.charge : null;
        return {
          customer: idOf(inv.customer as string | { id: string } | null),
          amount: inv.amount_paid,
          refunded: charge?.amount_refunded ?? 0,
          currency: inv.currency,
          paidAt: inv.status_transitions?.paid_at ?? inv.created,
        };
      });

    items = activeRaw.flatMap((sub) =>
      sub.items.data
        .filter((it) => it.price?.recurring && it.price.unit_amount != null)
        .map((it) => ({
          tier: it.price.metadata?.tier_id ?? null,
          unitAmount: it.price.unit_amount!,
          quantity: it.quantity ?? 1,
          currency: it.price.currency,
          interval: it.price.recurring!.interval,
          intervalCount: it.price.recurring!.interval_count ?? 1,
        })),
    );
    payingCustomers = new Set(
      activeRaw
        .map((s) => idOf(s.customer as string | { id: string }))
        .filter((c): c is string => !!c),
    );
    trialing = trialingRaw.length;
    cancelledThisMonth = cancelledRaw.filter(
      (s) => (s.canceled_at ?? 0) >= monthStart,
    ).length;
    refunds = refundsRaw.filter((r) => r.status === "succeeded");
  } catch (err) {
    console.error(
      "[admin-finance-stats] stripe read failed:",
      (err as Error).message,
    );
    return json({ error: "stripe_failed" }, 502);
  }

  const currency = primaryCurrency(invoices);
  const revenue = revenueByMonth(invoices, months, currency);
  const mrr = mrrByTier(items, currency);
  const refundsThisMonth = refunds
    .filter((r) => r.currency === currency)
    .reduce((sum, r) => sum + r.amount, 0);

  // First payments this month come from the database, which records exactly that.
  const { count: newPaying, error: newErr } = await admin
    .from("subscriptions")
    .select("user_id", { count: "exact", head: true })
    .gte("first_paid_at", new Date(monthStart * 1000).toISOString());
  if (newErr)
    console.error(
      "[admin-finance-stats] first_paid_at read failed:",
      newErr.message,
    );

  const otherCurrencies = [
    ...new Set([
      ...invoices.map((i) => i.currency),
      ...items.map((i) => i.currency),
    ]),
  ].filter((c) => c !== currency);

  return json({
    currency,
    mrr: mrr.total,
    arr: mrr.total * 12,
    paying_customers: payingCustomers.size,
    arpu: payingCustomers.size
      ? Math.round(mrr.total / payingCustomers.size)
      : 0,
    trialing,
    mrr_by_tier: [...mrr.byTier].map(([tier, amount]) => ({ tier, amount })),
    revenue_this_month: revenue[revenue.length - 1],
    revenue_last_month: revenue[revenue.length - 2] ?? 0,
    revenue_by_month: months.map((month, i) => ({ month, amount: revenue[i] })),
    new_paying_this_month: newErr ? null : (newPaying ?? 0),
    cancelled_this_month: cancelledThisMonth,
    refunds_this_month: refundsThisMonth,
    other_currencies: otherCurrencies,
    generated_at: now.toISOString(),
    month: monthKey(monthStart),
  });
});
