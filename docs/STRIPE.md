# Stripe

Subscription billing via Stripe Checkout + Customer Portal. Zero custom payment UI.

## Product structure

One Stripe Product per tier, each with a single monthly Price. (Annual pricing not offered yet - can be added later by creating a second Price per product with `billing_cycle: 'annual'` metadata.)

| Tier     | Monthly                  |
| -------- | ------------------------ |
| Starter  | `price_starter_monthly`  |
| Pro      | `price_pro_monthly`      |
| Business | `price_business_monthly` |

**Metadata on each Stripe Price:** `tier_id: 'pro'` and `billing_cycle: 'monthly'`. The webhook uses this metadata to map Stripe → `subscriptions.tier_id` without a separate lookup table.

## Checkout flow

```
/pricing - Subscribe button
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

## Free trial policy (enforced server-side)

The pricing page's trial card sends `trialDays` with the Starter price, but the client value is only a REQUEST. `create-checkout-session` decides the terms:

- **14 days, Starter only.** The function retrieves the price from Stripe and applies the trial only when its metadata says `tier_id: 'starter'`. The length is a server constant, so a crafted request cannot get a longer trial or a trial on Pro/Business. The trial is **opt-in**: the request must carry `withTrial: true`. The trial card and the Starter card post the same Starter price, so without it the server cannot tell them apart and pressing Subscribe on Starter silently started a trial instead of subscribing. The flag only expresses intent - every eligibility gate still runs server-side, and the length is still a server constant, so a caller can decline a trial or ask for the standard one but never lengthen it or attach it to Pro/Business.
- **One per account.** Any existing `subscriptions` row for the user (even canceled) means no trial: the checkout proceeds at full price. The pricing page hides the trial card for users with history (`PricingSection` counts their rows), so honest users never see a misleading CTA.
- **Card required.** `payment_method_collection` is left at Stripe's default ("always"), so the card is taken up front and the trial converts to a paid Starter subscription automatically at day 14 unless the user cancels (copy on the trial card and FAQ discloses this).
- **No duplicate subscriptions.** If the user already has an entitled row (`active`, `trialing`, `past_due`), the function returns 409 `already_subscribed` and `SubscribeButton` redirects to `/account`. Plan changes go through the Customer Portal.
- **Customer reuse.** If a prior row has a `stripe_customer_id`, checkout passes `customer` instead of `customer_email` so one user does not accumulate Stripe customers.

Both clients resolve the user's tier from the newest ENTITLED row (`active | trialing | past_due`); lapsed rows fall back to the zero-limit free config. See `lib/supabase/subscription.ts` (web) and the extension's `src/utils/cloud/subscription.ts`.

## Manage subscription (Customer Portal)

```
/account - "Manage subscription" button
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

| Event                                               | What to do                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checkout.session.completed` (mode: `subscription`) | Initial insert. `client_reference_id` → `user_id`. Retrieve the subscription (expand `items.data.price`) and read `tier_id` from price metadata. Upsert on `stripe_subscription_id`.                                                                                                                   |
| `customer.subscription.updated`                     | Update `tier_id`, `status`, `current_period_end` on the row matched by `stripe_subscription_id`. Handles plan changes + renewals.                                                                                                                                                                      |
| `customer.subscription.deleted`                     | Set `status = 'canceled'`. Don't delete the row - keep history.                                                                                                                                                                                                                                        |
| `invoice.payment_failed`                            | Set `status = 'past_due'`. Trigger payment-failed email via Resend.                                                                                                                                                                                                                                    |
| `invoice.payment_succeeded`                         | Reset `status = 'active'` only if it was `past_due`. Also flips a pending referral to `converted` on the first invoice with `amount_paid > 0` (see `docs/REFERRALS.md`).                                                                                                                               |
| `charge.refunded`                                   | Referral clawback. Map charge → invoice → subscription → referee; void any pre-payout referral (`pending`/`converted`/`rewarding`) so a refunded first payment cannot still mint a referrer reward. Already-`rewarded` rows are logged for manual review, not auto-reversed (see `docs/REFERRALS.md`). |
| `charge.dispute.created`                            | Same clawback as `charge.refunded`, resolved via the dispute's charge id. A chargeback on the qualifying payment voids the pending referral.                                                                                                                                                           |

Any event not listed → respond 200 silently, don't 500.

**Enabled events:** `charge.refunded` and `charge.dispute.created` must be added to the webhook endpoint's enabled-events list in the Stripe dashboard (both test and live). Without that, Stripe never delivers them and the clawback handler is dead code.

**Why not `customer.subscription.created`?** `client_reference_id` only lives on the Checkout Session, not the Subscription object - so `checkout.session.completed` is the only event that carries the mapping back to our `user_id`. We use it for the initial insert and rely on `customer.subscription.updated` for subsequent lifecycle changes.

**Error handling:** the handler throws on missing metadata / missing user mapping. Non-200 responses tell Stripe to retry with exponential backoff, which is what we want - silently swallowing a failed insert would leave the user paid-up but un-provisioned.

## Test mode vs live

- `STRIPE_SECRET_KEY=sk_test_...` → test cards only (`4242 4242 4242 4242` etc.)
- `STRIPE_WEBHOOK_SECRET=whsec_test_...` → different secret per mode
- Same code path works for both; Stripe keys determine which environment Stripe hits

Use **Stripe CLI** for local webhook testing:

```bash
stripe listen --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

It prints a temporary `whsec_...` that you set as `STRIPE_WEBHOOK_SECRET` while testing.

## Referrals (coupon + customer balance)

Two Stripe features back the referral program (`docs/REFERRALS.md`):

- **Referee first-month discount**: a hand-created Coupon whose ID lives in the
  `REFERRAL_COUPON_ID` Edge Function secret. `create-checkout-session` passes it
  via `discounts: [{ coupon }]` when the buyer has a pending referral.
  **`discounts` and `allow_promotion_codes` are mutually exclusive** on a
  Checkout Session - the function drops the promo-code field for referred
  checkouts, so a referred user cannot also enter a promo code.
  Create the coupon with `duration: 'once'`, then verify with a **test clock**
  that the discount survives the 14-day trial's $0 invoice; if the trial invoice
  consumes it, recreate as `duration: 'repeating', duration_in_months: 2`.
- **Referrer reward**: `process-referral-rewards` calls
  `stripe.customers.createBalanceTransaction` with a **negative** amount (=
  credit) equal to one month of the referrer's current plan price. Stripe
  applies customer balance automatically to upcoming invoices; no plan or
  subscription change is involved. The transaction carries
  `metadata.referral_id` and an idempotency key so retries can never
  double-credit.

## Pricing changes

Don't overwrite Stripe Prices - **create a new Price and update the pricing page** (or keep the old one for existing subs). Stripe Prices are immutable in practice; changing one would affect existing billing.

Workflow to raise Pro from £14.99 to £17.99:

1. Create new Price `price_pro_monthly_v2` at £17.99
2. Update pricing page to use the new price ID for new signups
3. Existing subs on v1 keep paying £14.99 (by design - grandfathered)
4. (Optional) Later, migrate existing subs to v2 with a Stripe subscription update

## Gotchas

- **Webhook signature verification needs raw body.** Edge Functions handle this naturally via `req.text()`. Don't JSON.parse before passing to `constructEvent`.
- **`constructEventAsync` in Deno**, not `constructEvent` - the Deno crypto provider is async.
- **Replay guard + livemode check.** The webhook skips events whose id is already in `stripe_webhook_events` (recorded after successful handling, so failed events still retry) and drops events whose `livemode` does not match the configured key. Migration `013_edge_hardening.sql`.
- **API version pinned in code** - `2025-02-24.acacia`. Bumping is a breaking change; read Stripe's upgrade guide first.
- **Test vs live keys are both `sk_*`** - easy to mix up. Prefix env vars with environment (`STRIPE_SECRET_KEY_TEST` / `..._LIVE`) if it becomes a problem.
- **Never trust metadata from the client** - all tier mapping happens inside the webhook where Stripe's server has signed the payload.
- **Customer Portal requires at least one active subscription** - if `stripe_customer_id` is null, the `create-portal-session` endpoint returns 404. UI should hide the button in that case.
- **Admin tier overrides don't stick on Stripe-managed rows.** The admin console can set `subscriptions.tier_id`/`status` directly (`admin_set_user_subscription`, see `docs/ADMIN.md`), but any later webhook event for that `stripe_subscription_id` overwrites them, and the override never changes what Stripe charges. Durable overrides are for comp rows (no Stripe ids) or lapsed subscriptions only. For a real paid plan change the console calls the `admin-change-plan` Edge Function, which swaps the price on the live Stripe subscription (prorated) and lets the webhook sync the row back.
