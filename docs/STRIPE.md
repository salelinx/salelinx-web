# Stripe

Subscription billing via Stripe Checkout + Customer Portal. Zero custom payment UI.

## Product structure

One Stripe Product per tier, with two Prices per product (monthly + annual).

| Tier     | Monthly                  | Annual                  |
| -------- | ------------------------ | ----------------------- |
| Starter  | `price_starter_monthly`  | `price_starter_annual`  |
| Pro      | `price_pro_monthly`      | `price_pro_annual`      |
| Business | `price_business_monthly` | `price_business_annual` |

Plus a one-time:
| | Price |
|---|---|
| Lifetime Pro | `price_lifetime_pro` (one-time) |

**Metadata on each Stripe Price:** `tier_id: 'pro'` and `billing_cycle: 'monthly' | 'annual' | 'lifetime'`. The webhook uses this metadata to map Stripe → `subscriptions.tier_id` without a separate lookup table.

## Checkout flow

```
/pricing — Subscribe button
  ▼
POST /functions/v1/create-checkout-session { priceId, successUrl, cancelUrl }
  (Edge Function, verifies JWT)
  ▼
stripe.checkout.sessions.create({ mode: 'subscription', price, client_reference_id: user.id })
  ▼
redirect browser to session.url
  ▼
User completes payment on Stripe's hosted page
  ▼
Stripe redirects to successUrl
  ▼
Stripe fires webhook customer.subscription.created → our webhook upserts subscriptions row
```

**Key detail:** `client_reference_id` is set to Supabase `user.id` so the webhook can map the Stripe customer back to our user.

## Manage subscription (Customer Portal)

```
/account — "Manage subscription" button
  ▼
POST /functions/v1/create-portal-session { returnUrl }
  ▼
stripe.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url })
  ▼
redirect browser to session.url
```

Customer Portal handles:

- Change plan (upgrade / downgrade)
- Update payment method
- Cancel / resume subscription
- Download invoices
- Change billing address

No custom UI needed.

## Webhook events to handle

All in `supabase/functions/stripe-webhook/index.ts`. Priority:

| Event                                       | What to do                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `customer.subscription.created`             | Insert row in `subscriptions` keyed on `client_reference_id` (user_id). Set `tier_id` from price metadata. |
| `customer.subscription.updated`             | Update `tier_id`, `status`, `current_period_end`. Handles plan changes + renewals.                         |
| `customer.subscription.deleted`             | Set `status = 'canceled'`. Don't delete the row — keep history.                                            |
| `invoice.payment_failed`                    | Set `status = 'past_due'`. Trigger payment-failed email via Resend.                                        |
| `invoice.payment_succeeded`                 | Reset `status = 'active'` if it was `past_due`.                                                            |
| `checkout.session.completed` (for lifetime) | Insert `subscriptions` row with `tier_id = 'pro_lifetime'`, no `current_period_end`.                       |

Any event not listed → respond 200 silently, don't 500.

## Test mode vs live

- `STRIPE_SECRET_KEY=sk_test_...` → test cards only (`4242 4242 4242 4242` etc.)
- `STRIPE_WEBHOOK_SECRET=whsec_test_...` → different secret per mode
- Same code path works for both; Stripe keys determine which environment Stripe hits

Use **Stripe CLI** for local webhook testing:

```bash
stripe listen --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

It prints a temporary `whsec_...` that you set as `STRIPE_WEBHOOK_SECRET` while testing.

## Pricing changes

Don't overwrite Stripe Prices — **create a new Price and update the pricing page** (or keep the old one for existing subs). Stripe Prices are immutable in practice; changing one would affect existing billing.

Workflow to raise Pro from £14.99 to £17.99:

1. Create new Price `price_pro_monthly_v2` at £17.99
2. Update pricing page to use the new price ID for new signups
3. Existing subs on v1 keep paying £14.99 (by design — grandfathered)
4. (Optional) Later, migrate existing subs to v2 with a Stripe subscription update

## Annual discount

Annual = 17% off (2 months free). Stripe Price for annual is set at `£<monthly> × 10` — configured manually when creating the Price, not calculated at runtime.

## Lifetime deal

Separate one-time Price. After purchase, webhook inserts `subscriptions` with:

- `tier_id = 'pro_lifetime'` (or similar custom tier ID)
- `status = 'active'`
- `current_period_end = null`
- `stripe_subscription_id = null` (it's a one-time payment, not a sub)

Cap at 100 sales via a feature flag or a counter checked before checkout session creation.

## Gotchas

- **Webhook signature verification needs raw body.** Edge Functions handle this naturally via `req.text()`. Don't JSON.parse before passing to `constructEvent`.
- **`constructEventAsync` in Deno**, not `constructEvent` — the Deno crypto provider is async.
- **API version pinned in code** — `2025-02-24.acacia`. Bumping is a breaking change; read Stripe's upgrade guide first.
- **Test vs live keys are both `sk_*`** — easy to mix up. Prefix env vars with environment (`STRIPE_SECRET_KEY_TEST` / `..._LIVE`) if it becomes a problem.
- **Never trust metadata from the client** — all tier mapping happens inside the webhook where Stripe's server has signed the payload.
- **Customer Portal requires at least one active subscription** — if `stripe_customer_id` is null, the `create-portal-session` endpoint returns 404. UI should hide the button in that case.
