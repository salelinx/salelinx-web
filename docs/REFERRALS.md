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
  redirects to /invited (landing page explaining the deal)
  ▼
Friend signs up and confirms email (any auth path)
  proxy.ts sees a signed-in request still carrying slx_ref
  claim_referral(code) RPC inserts a referrals row (pending), cookie cleared
  ▼
Friend subscribes -> create-checkout-session
  has_pending_referral() true -> REFERRAL_COUPON_ID auto-applied
  (allow_promotion_codes omitted; Stripe rejects the pair)
  ▼
First PAID invoice (amount_paid > 0) -> stripe-webhook
  referrals row -> converted, converted_at stamped
  Two webhook paths flip it, whichever arrives first (status-guarded no-ops
  of each other): checkout.session.completed converts instant purchases
  (its latest_invoice is checked for amount_paid > 0 - it knows the user
  directly, so it never races the subscriptions insert), and
  invoice.payment_succeeded converts trials at day 7 and renewals

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

## Leaderboard (migration `020_referral_leaderboard.sql`)

`referral_leaderboard(p_limit)` - SECURITY DEFINER RPC backing the
extension's Refer & Earn tab (and any future website surface). Cross-user
aggregates can't come from RLS-scoped reads, so the RPC exposes ONLY
`(rank, display_name, score, is_me)` - never UUIDs or full emails:

- `display_name` - the referrer's linked shop username (Depop preferred,
  then Vinted; it's the name buyers already see publicly), else the first
  two characters of their email + `***`.
- `score` - converted/rewarding/rewarded referrals only. pending is
  excluded so spam signups never move the board; void never counts. Ties
  break toward whoever converted first.
- The caller's own row is always included even below the top N, so a UI
  can show "your rank" without a second call.
- `authenticated` only (`anon` revoked). `p_limit` clamps to 1..25.

## Claim guards (`claim_referral`)

The claim fires in `proxy.ts` on the first signed-in request that still
carries the `slx_ref` cookie. It CANNOT live in `/auth/callback`: signup
verification goes through `/auth/confirm`, which verifies client-side via
`verifyOtp` and deliberately skips the callback hop, so the callback never
runs for signups. The proxy point catches every auth path (email confirm,
no-confirmation signups, even sign-in days later within the cookie window).

Every guard returns FALSE instead of raising - the RPC runs on the request
path and must never break anything:

- no session / null code / bad shape
- unknown code
- self-referral
- account older than 48h (an existing signed-in user who clicks a referral
  link just gets the cookie cleared; the age check plus the UNIQUE
  constraint make all replays no-ops)
- already claimed (unique_violation swallowed)

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

### Showing the referee their discount

The coupon is only applied inside Stripe checkout, so before this the offer
was invisible on the site and read as broken. Two client islands fix that,
both no-ops unless `has_pending_referral()` is true:

- `ReferralDiscountBanner` - on `/account` and above the pricing grid.
- `ReferralPrice` - strikes the list price through against the referred
  price on each pricing card.

Both read the coupon's TERMS from the public `get-referral-discount` Edge
Function (percent/amount, duration - never the coupon id), so the displayed
offer tracks whatever the coupon actually is. Hardcoding a percentage in the
frontend would drift silently the first time the coupon is edited in Stripe.
`applyDiscount` refuses to compute a price it cannot derive faithfully (an
`amount_off` in a different currency to the listed price), falling back to
the plain price rather than showing a number checkout will contradict.

Coupon note: create it with `duration: 'once'` and verify with a Stripe
test clock that the discount survives the 14-day trial's $0 invoice. If the
trial invoice consumes it, recreate as `duration: 'repeating',
duration_in_months: 2` (keeps the window open past the trial so the first
paid invoice gets it). See `docs/STRIPE.md`.

## Touch points

| Piece | File |
| --- | --- |
| Schema + RPCs | `supabase/migrations/010_referrals.sql` |
| Leaderboard RPC | `supabase/migrations/020_referral_leaderboard.sql` |
| Share link | `app/r/[code]/route.ts` (+ `/r/` in `proxy.ts` skipIntl) |
| Invite landing page | `app/[locale]/invited/page.tsx` (`Invited` namespace in `messages/*.json`) |
| Referee-side discount UI | `components/ReferralDiscountBanner.tsx`, `components/ReferralPrice.tsx`, `lib/referral-discount.ts` |
| Coupon terms read | `supabase/functions/get-referral-discount/index.ts` |
| Claim | `proxy.ts` (first signed-in request with the cookie) |
| Conversion | `supabase/functions/stripe-webhook/index.ts` |
| Referee discount | `supabase/functions/create-checkout-session/index.ts` |
| Reward grant | `supabase/functions/process-referral-rewards/index.ts` |
| Account UI | `components/ReferralsCard.tsx`, `lib/supabase/referrals.ts` |
