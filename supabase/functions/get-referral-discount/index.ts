// deno-lint-ignore-file
import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const couponId = Deno.env.get("REFERRAL_COUPON_ID") ?? "";
  // No coupon configured is a valid state (the program runs without a
  // referee-side discount), not an error - the UI just says nothing.
  if (!couponId) return json({ discount: null }, 200, true);

  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    if (!coupon.valid) return json({ discount: null }, 200, true);

    return json(
      {
        discount: {
          percentOff: coupon.percent_off ?? null,
          amountOff: coupon.amount_off ?? null,
          currency: coupon.currency ?? null,
          duration: coupon.duration, // 'once' | 'repeating' | 'forever'
          durationInMonths: coupon.duration_in_months ?? null,
        },
      },
      200,
      true,
    );
  } catch {
    // A deleted or mistyped coupon must not break the pricing page.
    return json({ discount: null }, 200);
  }
});
