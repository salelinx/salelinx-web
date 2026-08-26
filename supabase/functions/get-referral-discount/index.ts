// deno-lint-ignore-file
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import {
  COUPON_TIERS,
  referralCouponFor,
} from "../_shared/referral-coupons.ts";

// Public read of the referee discount coupon's TERMS - never the coupon id.
//
// The referral discount used to be invisible until Stripe checkout, so a
// referred user had no way to tell it had worked. The site needs to state
// the offer ("20% off your first month"), and the only truthful source for
// that is the coupon itself: hardcoding a percentage in the frontend would
// silently drift the moment the coupon is edited in Stripe.
//
// Terms are not sensitive - they are marketing copy we are about to render
// publicly - so this needs no auth. The coupon ID is deliberately NOT
// returned: it is the thing `create-checkout-session` applies server-side,
// and echoing it invites redemption attempts from hand-built checkouts.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status: number, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // Coupon terms change roughly never; a 10 min cache keeps the pricing
      // page off Stripe's API on every render.
      ...(cache ? { "Cache-Control": "public, max-age=600" } : {}),
    },
  });
}

type Terms = {
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  // amount_off per currency from the coupon's currency_options (multi-currency
  // coupons). Keyed by lowercase code ("gbp", "eur", "usd"), primary currency
  // included. Null for percent coupons and single-currency coupons.
  amountOffByCurrency: Record<string, number> | null;
  duration: string;
  durationInMonths: number | null;
};

// Retrieve once per distinct coupon id, not once per tier: the three tiers
// commonly share one coupon (during rollout, or whenever the offer is a flat
// percentage), and this runs on every cold pricing-page render.
async function loadTerms(
  id: string,
  cache: Map<string, Terms | null>,
): Promise<Terms | null> {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id) ?? null;

  let terms: Terms | null = null;
  try {
    // currency_options is only returned when expanded.
    const coupon = await stripe.coupons.retrieve(id, {
      expand: ["currency_options"],
    });
    if (coupon.valid) {
      let amountOffByCurrency: Record<string, number> | null = null;
      const opts = coupon.currency_options as
        | Record<string, { amount_off?: number | null }>
        | undefined;
      if (coupon.amount_off != null && opts) {
        amountOffByCurrency = {};
        for (const [code, opt] of Object.entries(opts)) {
          if (opt?.amount_off != null) {
            amountOffByCurrency[code.toLowerCase()] = opt.amount_off;
          }
        }
        if (Object.keys(amountOffByCurrency).length === 0) {
          amountOffByCurrency = null;
        }
      }
      terms = {
        percentOff: coupon.percent_off ?? null,
        amountOff: coupon.amount_off ?? null,
        currency: coupon.currency ?? null,
        amountOffByCurrency,
        duration: coupon.duration, // 'once' | 'repeating' | 'forever'
        durationInMonths: coupon.duration_in_months ?? null,
      };
    }
  } catch {
    // A deleted or mistyped coupon must not break the pricing page. Null here
    // means the card shows the plain list price, and checkout still applies
    // whatever Stripe actually holds.
    terms = null;
  }

  cache.set(id, terms);
  return terms;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const cache = new Map<string, Terms | null>();

  // `discount` is the shared coupon, kept for older clients that predate
  // per-tier pricing (and for a cached response being read by newer code).
  // `byTier` is what the pricing cards use now. Both resolve through
  // referralCouponFor, so the advertised price always matches the coupon
  // create-checkout-session will apply for that plan.
  const shared = await loadTerms(
    Deno.env.get("REFERRAL_COUPON_ID") ?? "",
    cache,
  );

  const byTier: Record<string, Terms | null> = {};
  for (const tier of COUPON_TIERS) {
    byTier[tier] = await loadTerms(referralCouponFor(tier), cache);
  }

  // No coupon configured anywhere is a valid state (the program can run with
  // no referee-side discount), not an error - the UI just says nothing.
  return json({ discount: shared, byTier }, 200, true);
});
