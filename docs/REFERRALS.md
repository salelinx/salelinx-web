# Referrals

User-to-user referral program. Referrers share a link; referees get a
first-month discount at checkout; referrers earn one free month per referral
that converts to a paid subscription.

## The flow

```
Referrer opens /account -> Referrals card
  get_or_create_referral_code() RPC creates their code lazily
  share link: {SITE_URL}/r/{CODE}
  ▼
Friend clicks the link -> app/r/[code]/route.ts
  sets slx_ref cookie (HttpOnly, 30 days, last-touch wins)
  redirects to /features
  ▼
Friend signs up, confirms email -> /auth/callback
  after exchangeCodeForSession succeeds: claim_referral(code) RPC
  inserts a referrals row (status = pending), cookie cleared
  ▼
Friend subscribes -> create-checkout-session
  has_pending_referral() true -> REFERRAL_COUPON_ID auto-applied
  (allow_promotion_codes omitted; Stripe rejects the pair)
  ▼
First PAID invoice (amount_paid > 0) -> stripe-webhook
  referrals row -> converted, converted_at stamped
  (a 7-day Starter trial converts at day 7, when the first real charge lands)
  ▼
7 days later -> process-referral-rewards (daily Cron)
  referee still entitled? referrer has a live subscription?
  stripe.customers.createBalanceTransaction: MINUS one month of the
  referrer's current plan price = credit on their next invoice(s)
  row -> rewarded, receipt stored (amount, currency, balance txn id)
```

## State machine (`referrals.status`)

```
pending ──(first paid invoice)──> converted ──(job claims row)──> rewarding ──(credit granted)──> rewarded
   │                                  │
   │                                  ├──(referee lapsed inside the hold)──────> void
   └──(never pays; row just sits)     └──(referrer had no subscription 90d)────> void
```

- `pending` - claimed at signup; referee has not paid.
- `converted` - first paid invoice seen; held 7 days (refund window).
- `rewarding` - a reward-job run has claimed the row; if the run crashes,
  rows older than 1 hour are picked up again (recovery pass).
- `rewarded` - credit granted; `stripe_balance_txn_id` is the receipt.
- `void` - referee lapsed before payout, or the reward sat unclaimable for
  90 days (referrer never had a live subscription to credit).

## Schema (migration `010_referrals.sql`)

- `referral_codes` - one row per user, created lazily. Code: 8 chars from
  `A-HJ-NP-Z2-9` (no 0/O/1/I/L).
- `referrals` - one row per referred signup; `referee_id` is UNIQUE (one
  referral per referee, ever). Both FKs cascade from `auth.users`.

RLS: referrers SELECT their own rows (the /account card). **Referees get no
policy** - it would expose `referrer_id`, another user's UUID. The
referee-side read surface is the `has_pending_referral()` RPC (a boolean).

## Claim guards (`claim_referral`)

Every guard returns FALSE instead of raising - the RPC runs inside the auth
callback and must never break sign-in:

- no session / null code / bad shape
- unknown code
- self-referral
- account older than 48h (the callback also fires for password reset and
  email change; the age check plus the UNIQUE constraint make those replays
  no-ops)
- already claimed (unique_violation swallowed)

Known limitation: if Supabase "Confirm email" is ever turned OFF, signup
bypasses `/auth/callback` and claims are silently lost.

## Reward rules (`process-referral-rewards`)

- Runs daily (dashboard Cron -> POST with `x-referral-cron-secret`).
- Hold: 7 days after `converted_at`. Referee must still be entitled
  (`active | trialing | past_due`) at payout or the row voids. A true Stripe
  refund on a still-active subscription is NOT detected - accepted
  limitation; handling `charge.refunded` is a future enhancement.
- Reward: one month of the referrer's CURRENT plan - the unit_amount of
  their live Stripe subscription's price, credited as a negative customer
  balance transaction. Stripe applies it automatically to upcoming invoices.
- Referrer has no live subscription: the row stays `converted` and retries
  daily; after 90 days it voids.
- Cap: 10 rewarded referrals per referrer per month; excess conversions
  defer to the next month (never void).
- Non-monthly referrer price: deferred with an error log ("one free month"
  needs a product decision for annual billing; only monthly prices exist
  today).

### Idempotency (why a credit can never double-grant)

1. Atomic claim: `UPDATE ... WHERE status='converted'` - concurrent runs get
   0 rows.
2. Stripe idempotency key `referral-reward-<id>` - a crash between claim and
   finalize retries safely within Stripe's ~24h key window.
3. Stale `rewarding` rows first scan the customer's balance transactions for
   `metadata.referral_id` before granting - covers retries after the key
   window expired.

### Recovery runbook (stuck `rewarding` row)

Rows in `rewarding` older than 1 hour re-enter the next run automatically
and either find the existing credit (finalize) or grant it. If a row is
stuck for days, check the function logs for the referral id; the fix is
almost always a missing/rotated secret or a Stripe API error, and re-running
the function is safe (see idempotency above).

## Fraud posture

- Rewards require a real paid invoice (card-required trials mean a
  fraudster must actually pay to mint a reward).
- Self-referral blocked; one referral per referee ever; 48h claim window.
- 7-day hold absorbs quick refunds; monthly cap limits blast radius.
- Not defended (accepted for now): stolen-card conversions inside the hold,
  same-person multi-account with distinct cards.

## Config

| What | Where |
| --- | --- |
| Referee discount coupon | Stripe dashboard (test + live), ID in `REFERRAL_COUPON_ID` secret |
| Cron auth | `REFERRAL_CRON_SECRET` secret + dashboard Cron job header |
| Hold / expiry / cap / batch | constants in `process-referral-rewards/index.ts` |
| Cookie | `slx_ref`, set by `app/r/[code]/route.ts` |

Coupon note: create it with `duration: 'once'` and verify with a Stripe
test clock that the discount survives the 7-day trial's $0 invoice. If the
trial invoice consumes it, recreate as `duration: 'repeating',
duration_in_months: 2` (keeps the window open past the trial so the first
paid invoice gets it). See `docs/STRIPE.md`.

## Touch points

| Piece | File |
| --- | --- |
| Schema + RPCs | `supabase/migrations/010_referrals.sql` |
| Share link | `app/r/[code]/route.ts` (+ `/r/` in `proxy.ts` skipIntl) |
| Claim | `app/auth/callback/route.ts` |
| Conversion | `supabase/functions/stripe-webhook/index.ts` |
| Referee discount | `supabase/functions/create-checkout-session/index.ts` |
| Reward grant | `supabase/functions/process-referral-rewards/index.ts` |
| Account UI | `components/ReferralsCard.tsx`, `lib/supabase/referrals.ts` |
