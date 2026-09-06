# Referrals

User-to-user referral program. Referrers share a link; referees get a
first-month discount at checkout; referrers earn free time on their own plan
per referral that converts to a paid subscription. How much time depends on
the tier the REFEREE bought (see Reward rules): Starter = 1 week, Pro =
2 weeks, Business = 1 month.

## The flow

```
Referrer opens /account -> Referrals card
  get_or_create_referral_code() RPC creates their code lazily
  share link: {SITE_URL}/r/{CODE}
  â–¼
Friend clicks the link -> app/r/[code]/route.ts
  sets slx_ref cookie (HttpOnly, 30 days, last-touch wins)
  redirects to /invited (landing page explaining the deal)
  â–¼
Friend signs up and confirms email (any auth path)
  proxy.ts sees a signed-in request still carrying slx_ref
  claim_referral(code) RPC inserts a referrals row (pending), cookie cleared
  â–¼
Friend subscribes -> create-checkout-session
  has_pending_referral() true -> that tier's coupon auto-applied
  (allow_promotion_codes omitted; Stripe rejects the pair)
  â–¼
First PAID invoice (amount_paid > 0) -> stripe-webhook
  referrals row -> converted, converted_at stamped
  Two webhook paths flip it, whichever arrives first (status-guarded no-ops
  of each other): checkout.session.completed converts instant purchases
  (its latest_invoice is checked for amount_paid > 0 - it knows the user
  directly, so it never races the subscriptions insert), and
  invoice.payment_succeeded converts trials at day 7 and renewals

  â–¼
7 days later -> process-referral-rewards (daily Cron)
  referee still entitled? referrer has a live subscription?
  stripe.customers.createBalanceTransaction: MINUS a fraction of the
  referrer's current plan price (fraction set by the referee's tier)
  = credit on their next invoice(s)
  row -> rewarded, receipt stored (amount, currency, balance txn id)
```

## Leaderboard display name (021) - UNUSED since Aug 2026

The extension removed its leaderboard and display-name UI in Aug 2026 (its
Refer & Earn tab now shows a reward explainer instead), so nothing calls
`set_referral_display_name` or `referral_leaderboard` any more. The DB
objects below still exist and still enforce their rules; dropping them is a
pending product decision. Everything in this section and the Leaderboard
section describes what they do while they remain.

`referral_codes.display_name` is an optional self-chosen name for the
extension's leaderboard. NULL falls back to the linked shop username (Depop
preferred), then the neutral `Seller #<rank>` placeholder. (The old masked
email-prefix fallback was dropped pre-squash; 007_referrals.sql carries the
self-chosen name on top with server-side moderation.)

Note before dropping these objects: the privacy policy and the Referral
Program Terms (updated Sep 2026) describe the display-name scheme in
conditional terms ("if the app offers a leaderboard"), and names users chose
while the UI existed still live in `referral_codes.display_name`. Dropping
the column means deleting that user content; reviving the UI means the legal
copy is already accurate. Either way, keep the legal pages in step.

Set it with `set_referral_display_name(p_name)`, which returns
`{ok:true, display_name}` or `{ok:false, error:'code'}` rather than raising,
so the caller can show a message per failure. Pass '' or NULL to clear it.
Codes: too_short, too_long, bad_chars, no_letters, blocked_word,
impersonation, taken, no_referral_code, not_authenticated.

### Moderation

Four layers, because a client-side check is only a suggestion (anyone with
their own token can call the API directly):

1. **CHECK constraint** on the column: 3-20 chars, ASCII-only charset, at
   least one letter, no doubled or edge spaces. ASCII-only is what blocks
   Cyrillic/Greek homoglyphs (an "admin" spelled with a Cyrillic a); no
   wordlist catches those.
2. **BEFORE trigger** (`referral_codes_display_name_guard`): normalises, then
   runs the wordlist on every write path, so a future INSERT/UPDATE RLS
   policy cannot open a side door round the RPC.
3. **`referral_display_name_problem(text)`**: the wordlist itself. Matching
   runs on a leet-folded, letters-only copy, so "5h1t" and "F.U.C.K" collapse
   onto the plain word. Three rules, because one cannot serve every term:
   match-anywhere for long unambiguous words, whole-word for terms that live
   inside ordinary ones (a substring rule for "ass" rejects Cassie, class and
   bass: the Scunthorpe problem), and contains-with-allowlist for the two
   whose innocent carriers are countable ("dick" must reject BigD1ck while
   accepting Dickinson). Impersonation terms (salelinx, admin, official,
   support, staff, founder...) are checked separately so the UI can say why.
4. **`admin_clear_referral_display_name(user_id)`**: the backstop. No wordlist
   is complete, so an admin (gated on `is_admin()`, which inherits the AAL2
   requirement from 009) can blank a name and let it fall back to the derived
   one.

A partial unique index on `lower(display_name)` stops someone taking the name
of the person above them, which is the impersonation risk that actually
matters on a leaderboard.

The extension used to mirror these rules in `src/utils/referral-name.ts` for
instant feedback while typing; that mirror was deleted with the extension's
leaderboard UI. This function remains the gate for any future caller.

## State machine (`referrals.status`)

```
pending â”€â”€(first paid invoice)â”€â”€> converted â”€â”€(job claims row)â”€â”€> rewarding â”€â”€(credit granted)â”€â”€> rewarded
   â”‚                                  â”‚
   â”‚                                  â”œâ”€â”€(referee lapsed inside the hold)â”€â”€â”€â”€â”€â”€> void
   â””â”€â”€(never pays; row just sits)     â””â”€â”€(referrer had no subscription 90d)â”€â”€â”€â”€> void
```

- `pending` - claimed at signup; referee has not paid.
- `converted` - first paid invoice seen; held 7 days (refund window).
- `rewarding` - a reward-job run has claimed the row; if the run crashes,
  rows older than 1 hour are picked up again (recovery pass).
- `rewarded` - credit granted; `stripe_balance_txn_id` is the receipt.
- `void` - referee lapsed before payout, or the reward sat unclaimable for
  90 days (referrer never had a live subscription to credit).

## Schema (migration `007_referrals.sql`)

- `referral_codes` - one row per user, created lazily. Code: 8 chars from
  `A-HJ-NP-Z2-9` (no 0/O/1/I/L).
- `referrals` - one row per referred signup; `referee_id` is UNIQUE (one
  referral per referee, ever). Both FKs cascade from `auth.users`.

RLS: referrers SELECT their own rows (the /account card). **Referees get no
policy** - it would expose `referrer_id`, another user's UUID. The
referee-side read surface is the `has_pending_referral()` RPC (a boolean).

## Leaderboard (migration `007_referrals.sql`)

`referral_leaderboard(p_limit)` - SECURITY DEFINER RPC that backed the
extension's Refer & Earn tab until Aug 2026 (currently unused; kept for any
future surface). Cross-user
aggregates can't come from RLS-scoped reads, so the RPC exposes ONLY
`(rank, display_name, score, is_me)` - never UUIDs or full emails:

- `display_name` - the referrer's linked shop username (Depop preferred,
  then Vinted; it's the name buyers already see publicly), else a neutral
  rank-based handle `Seller #<rank>`. The email-derived fallback that
  originally shipped was removed pre-squash: a public
  cross-user surface must never show email-derived data.
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
  (`active | trialing | past_due`) at payout or the row voids. A refund or
  chargeback on the qualifying payment is now caught separately: the
  `stripe-webhook` handles `charge.refunded` and `charge.dispute.created` and
  voids any pre-payout referral (`pending`/`converted`/`rewarding`) for that
  referee, so a refund-but-stay-subscribed no longer mints a reward. Rows
  already `rewarded` are logged for manual review, not auto-reversed (the
  credit may already be spent on an invoice).
- Reward: a FRACTION of one month of the referrer's CURRENT plan - the
  unit_amount of their live Stripe subscription's price times the fraction
  for the tier the referee is on at payout, credited as a negative customer
  balance transaction. Stripe applies it automatically to upcoming invoices.

  | Referee's tier | Fraction | Reads as |
  | --- | --- | --- |
  | starter | 25% | 1 week |
  | pro | 50% | 2 weeks |
  | business | 100% | 1 month |

  "A week" is a quarter of a month by design, not 7/30.44 days: 4 Starter
  referrals, 2 Pro or 1 Business come to exactly one free month on every
  plan. The referee's tier is read from their newest subscriptions row AT
  PAYOUT (a plan change inside the hold moves the reward with it). The
  fraction table and rounding rule (`REWARD_FRACTION_BP`,
  `computeReferralReward`) live in `_shared/referral-reward-math.ts` - pure,
  no Deno APIs, so the vitest suite (`tests/referral-reward-math.test.ts`)
  imports the very module the function runs; an unknown referee tier has no
  priced reward, so the row defers with an error log rather than guessing
  (same policy as a non-monthly referrer price). The fraction and referee
  tier are stamped into the balance transaction's metadata; the row's
  `reward_amount_cents` receipt stores the actual credited amount, so the
  /account credit total stays correct across rule changes.
- Full matrix at today's GBP prices (referrer down, referee across):

  | Referrer \ Referee | starter (25%) | pro (50%) | business (100%) |
  | --- | --- | --- | --- |
  | starter (Â£7.99) | Â£2.00 | Â£4.00 | Â£7.99 |
  | pro (Â£14.99) | Â£3.75 | Â£7.50 | Â£14.99 |
  | business (Â£24.99) | Â£6.25 | Â£12.50 | Â£24.99 |

  `Math.round` on the fraction; 799 * 25% = 199.75 -> 200 is the only pair
  that rounds at these prices. Payback is at most 2 months of referee list
  price for every combination (the flat one-month rule cost up to 4).
- Referrer has no live subscription: the row stays `converted` and retries
  daily; after 90 days it voids.
- Cap: 10 rewarded referrals per referrer per month; excess conversions
  defer to the next month (never void).
- Non-monthly referrer price: deferred with an error log ("a fraction of a
  month" needs a product decision for annual billing; only monthly prices
  exist today).
- Unknown referee tier (not in `REWARD_FRACTION_BP`): deferred with an error
  log, same policy - a new tier must be given a fraction before its
  referrals pay out.

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
- Refund/chargeback on the qualifying payment voids a pre-payout referral
  (`charge.refunded` / `charge.dispute.created` in `stripe-webhook`), closing
  the refund-but-stay-subscribed reward leak.
- Not defended (accepted for now): stolen-card conversions inside the hold,
  same-person multi-account with distinct cards, and a refund that lands
  AFTER a reward is already `rewarded` (logged for manual review, not
  auto-reversed).

## Config

| What | Where |
| --- | --- |
| Referee discount coupons | Stripe dashboard (test + live), one per tier, IDs in `REFERRAL_COUPON_STARTER` / `_PRO` / `_BUSINESS` secrets (`REFERRAL_COUPON_ID` is the fallback for any tier without one). Resolved by `_shared/referral-coupons.ts`; see `docs/STRIPE.md` for the price table |
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

Because the offer is now a first-month price PER TIER, the endpoint returns
`{ discount, byTier: { starter, pro, business } }`: `byTier` is what the cards
use (`ReferralPrice` takes a `tier` prop and calls
`useReferralDiscount(tier)`), while `discount` stays as the shared/legacy
coupon so a response cached from before this change still renders something.
`ReferralDiscountBanner` asks for no tier, so once every tier has its own
coupon it gets `null` and falls back to its numberless copy
(`discountBanner`) - which is the honest thing to say when there is no single
figure to quote. The per-card struck-through prices carry the actual numbers.
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
| Schema + RPCs | `supabase/migrations/007_referrals.sql` |
| Leaderboard RPC | `supabase/migrations/007_referrals.sql` |
| Share link | `app/r/[code]/route.ts` (+ `/r/` in `proxy.ts` skipIntl) |
| Invite landing page | `app/[locale]/invited/page.tsx` (`Invited` namespace in `messages/*.json`) |
| Referee-side discount UI | `components/ReferralDiscountBanner.tsx`, `components/ReferralPrice.tsx`, `lib/referral-discount.ts` |
| Coupon terms read | `supabase/functions/get-referral-discount/index.ts` |
| Claim | `proxy.ts` (first signed-in request with the cookie) |
| Conversion | `supabase/functions/stripe-webhook/index.ts` |
| Referee discount | `supabase/functions/create-checkout-session/index.ts` |
| Reward grant | `supabase/functions/process-referral-rewards/index.ts` |
| Account UI | `components/ReferralsCard.tsx`, `lib/supabase/referrals.ts` |
