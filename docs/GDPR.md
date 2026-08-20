# GDPR compliance

Internal reference: what personal data SaleLinx processes, where it lives, how
long we keep it, and the runbooks for deletion, export, and breaches. The
user-facing version of this is the privacy policy
(`app/[locale]/legal/privacy/page.tsx`); keep the two consistent. If you change
a data flow, update this file, the policy, and the record below in the same PR.

## Record of processing activities (Article 30)

| Activity | Data | Data subjects | Legal basis | Where stored | Retention |
| --- | --- | --- | --- | --- | --- |
| Accounts and auth | Email, hashed password, locale, sign-in timestamps | Users | Contract | Supabase `auth.users` | Life of account |
| Subscriptions | Stripe customer/subscription IDs, tier, status, period end | Users | Contract | Supabase `subscriptions`, Stripe | Life of account; invoices kept by Stripe for tax law |
| Usage metering | Per-feature integer counts per period | Users | Contract | Supabase `usage_counters` | Rows untouched for 14 months purged nightly (migration 018); rest, life of account |
| Cloud sync (opt-in) | Listing content: titles, descriptions, prices, attributes, photos, enriched marketplace payloads | Users | Contract | Supabase `listings` + `listing-images` bucket | Until user disables sync or deletes account |
| Linked accounts | Marketplace user ID and username | Users | Contract | Supabase `linked_accounts` | Life of account |
| Platform credentials | Client-side encrypted marketplace session blobs (we cannot read them) | Users | Contract | Supabase `platform_credentials` | Life of account |
| Support | Ticket message, replies, app version, user agent, locale; email resolved from auth at send time | Users | Contract / legitimate interest | Supabase `support_tickets`, `support_ticket_replies`; copies in the support inbox | 24 months after ticket closed (automated purge); inbox purged manually |
| Referrals | Share code; referrer-referee account linkage, status, reward amounts; leaderboard display name (linked shop username, else a neutral placeholder) and successful-referral count shown to other participants | Users | Legitimate interest (growth program users opt into by sharing) | Supabase `referral_codes`, `referrals`, `linked_accounts` (display name); leaderboard is a read-only RPC aggregate | Life of account (both FKs cascade) |
| Transactional email | Recipient address, message content | Users | Contract | Resend (delivery logs) | Per Resend retention |
| Uninstall feedback | Reason chip, optional free-text comment, extension version, panel locale. Anonymous by design: no user id, email, or IP (migration 035; /uninstall page) | Former users, unidentifiable | Legitimate interest | Supabase `uninstall_feedback` (anon insert-only) | Indefinite; contains no personal data unless a commenter volunteers it, in which case delete on request |
| Label emails | Merged label PDF containing buyer name and delivery details, recipient address | Users and their buyers | Processor acting on the user's instruction | Transits Edge Function + Resend only; not stored by us | Not stored |
| Category resolution (not yet live) | Listing title and description (truncated to 2000 chars), category IDs | Users | Contract | Would transit the `resolve-category` Edge Function only; matched in memory, never logged or stored. **No extension build calls it yet, so this flow is not currently active** | Not stored |
| Device sessions | Random per-install device ID, user agent, last-seen timestamps | Users | Legitimate interest (enforcing the per-plan concurrent-device cap) | Supabase `device_sessions` | Rows idle 30+ days pruned on next claim; cascades on account deletion |
| Terms acceptance | Terms version and acceptance timestamp | Users | Legal obligation / legitimate interest (record of consent to contract) | Supabase `auth.users` user metadata | Life of account |
| Admin audit log | Admin ID, action, target IDs | Admins | Legitimate interest | Supabase `admin_audit_log` | Indefinite (contains no ticket content or user IDs by design) |

Anti-abuse tombstones: `trial_history` and `link_history` store only a salted
SHA-256 hash of a marketplace account identity (no username, no email, nothing
reversible) so trial eligibility survives account deletion. They deliberately
have no FK to `auth.users`; deleting a user does not remove them, by design, and
they hold nothing identifiable. Noted here so the deletion runbook does not add
them.

Not processed at all: analytics or tracking data, browsing history, marketplace
passwords or session tokens in readable form, card details (Stripe-hosted
checkout), buyer conversation content on our servers.

Buyer data stance: for buyer personal data handled via order features, the
seller is the controller and SaleLinx is a processor. It is processed in the
extension locally; the only server-side touchpoint is the `send-shipping-labels`
Edge Function passing a label PDF to Resend. Never add code that persists buyer
data server-side without revisiting the policy and terms first.

## Processors and DPAs

| Processor | Purpose | DPA |
| --- | --- | --- |
| Supabase | Auth, database, storage, Edge Functions | Accept in dashboard (Organization > Legal Documents) |
| Stripe | Payments | Part of Stripe Services Agreement; confirm DPA at stripe.com/legal/dpa |
| Resend | Email delivery | Sign at resend.com/legal/dpa |
| Vercel | Website hosting | Accept in dashboard (Team Settings > Legal) |

Keep this table current. If a new processor is added, add it to the privacy
policy's "Service providers" section in the same change.

Customer-facing DPA: because sellers are controllers of their buyers' data and
SaleLinx is their processor, we publish an Article 28 Data Processing Addendum at
`/legal/dpa` (`app/[locale]/legal/dpa/page.tsx`). Its subprocessor list (Resend,
Supabase, Vercel) is the buyer-data subset of the table above; if a subprocessor
that touches buyer data changes, update that page before the change takes effect
so sellers can object. Stripe is not on that list (it processes billing data as a
separate controller, not buyer data on our behalf).

## Retention schedule

- Account and cloud data: deleted with the account (see deletion runbook).
- Support tickets: closed tickets are purged 24 months after their last update
  by `purge_old_support_tickets()` (migration `007_gdpr_data_hygiene.sql`),
  scheduled nightly via pg_cron. If pg_cron is not enabled on the project, the
  migration raises a NOTICE; enable it (Database > Extensions) and run
  `SELECT cron.schedule('purge-old-support-tickets', '17 3 * * *', 'SELECT public.purge_old_support_tickets()');`
- Support inbox (`support@salelinx.com`): purge threads for deleted users
  manually; the DB purge does not reach the mailbox.
- Edge Function logs: must not contain email addresses or message content.
  User IDs are acceptable. This is enforced by convention; check any new
  `console.log` in `supabase/functions/`.
- Endpoint health telemetry (`endpoint_health`, migration
  `030_endpoint_health.sql`): 90 days, via `prune_endpoint_health()`. Schedule it
  alongside the ticket purge:
  `SELECT cron.schedule('prune-endpoint-health', '23 3 * * *', 'SELECT public.prune_endpoint_health()');`

### Endpoint health telemetry is not personal data

`endpoint_health` deliberately has **no `user_id` column**. It stores counters
only: a normalized endpoint key (`vinted:POST /api/v2/item_upload/drafts`), an
outcome bucket, an HTTP status, a count, an extension version, and an hour
bucket. No URLs with identifiers, no request bodies, no listing or buyer data,
nothing that singles out a person.

That is why it needs no consent gate and appears in no deletion or export
runbook - there is nothing in it to erase or export. This is a deliberate design
choice, not an oversight: a consent gate would put holes in exactly the dataset
that has to be complete to detect a marketplace outage.

**Do not add a `user_id`, install id, or any other identifier to this table.**
Doing so converts it into personal data and drags it into the ROPA, the
retention schedule, the deletion runbook, and arguably a consent requirement. If
per-user endpoint debugging is ever needed, build it as a separate, consented
table rather than widening this one.

The `report-telemetry` Edge Function does validate the caller's JWT, but purely
as an anti-spam gate - the identity is discarded and never stored. Anonymous
data over authenticated transport.

## Deletion runbook (right to erasure)

Self-serve first: users can delete their own account from `/account` (Danger
zone). The flow is deliberately high-friction: password re-entry (skipped for
Google-only accounts, which have no password; the emailed link is their
step-up), then a confirmation link emailed to the account address (60-minute
expiry), then a final confirm on `/account/delete-confirm`. It runs the `delete-account` Edge
Function, which performs the same steps as the staff paths below (storage,
Stripe customer, auth user) with no staff involvement. Because staff are not
notified, sweep the `support@salelinx.com` inbox periodically for threads
whose senders no longer have accounts (the manual follow-up in step 3 below
has no trigger for self-serve deletions).

The staff runbook below remains for email requests (some users will still
email instead) and for admin accounts, which the self-serve path refuses.

Trigger: user emails a deletion request from their account email address
(promised turnaround in the policy: 30 days).

1. Verify the request came from the account email (reply-to check; if in doubt
   ask them to confirm from that address).
2. Delete via either path (both run the same steps: storage objects, the
   Stripe customer - cancels any subscription; Stripe keeps invoices for tax
   law, which the policy discloses - then the auth user, which cascades all
   user-owned rows including tickets):
   - **Admin console:** `/admin/users` > open the user > Danger zone >
     Delete account (step-up reauth; backed by the `admin-delete-user` Edge
     Function, see `docs/ADMIN.md`). No dry run; the drawer shows what the
     account holds first.
   - **Script:** dry run `node scripts/delete-user-account.mjs user@example.com`,
     then re-run with `--execute`. Requires `SUPABASE_SERVICE_ROLE_KEY` in the
     environment or `.env.local` (dashboard > Settings > API; never commit it).
3. Manual follow-ups neither path can do:
   - Delete the user's threads from the `support@salelinx.com` inbox.
   - If they emailed other addresses, purge those too.
4. Confirm completion to the user by email.

Supabase database backups age out on the platform's schedule; deleted data
disappears from backups automatically within the backup retention window.

## Export runbook (access / portability)

On request from the account email:

1. Auth profile: dashboard > Authentication > user (email, created, last sign-in).
2. Rows for their `user_id` from: `listings`, `linked_accounts`, `user_settings`,
   `subscriptions`, `usage_counters`, `user_storage`, `support_tickets`,
   `support_ticket_replies`, `referral_codes`, and `referrals` (where they are
   referrer or referee; redact the OTHER party's UUID before sending - it is
   someone else's personal data) (SQL editor, export as CSV or JSON).
3. Storage: download `listing-images/{userId}/` if they want the images.
4. Do not export `platform_credentials` content (it is encrypted client-side
   and useless outside their device); note its existence instead.
5. Send within a month, in a machine-readable format (JSON or CSV).

## Breach response

If personal data may have been exposed (leaked service key, RLS bypass,
compromised admin account, processor breach):

1. Contain: rotate the affected secret (Supabase service key, Resend or Stripe
   keys), revoke sessions, disable the affected function or route.
2. Assess: what data, which users, over what window. Check Supabase logs and
   `admin_audit_log`.
3. Notify: if the breach is a risk to individuals, report to the ICO within 72
   hours of becoming aware (ico.org.uk, "report a breach"). If high risk to
   individuals, also notify the affected users directly without undue delay.
4. Record: write up cause, scope, and fixes in an internal note even if no
   notification was required (Article 33(5) requires keeping a record).

## Data protection complaints (DUAA s.164A, in force 19 June 2026)

The Data (Use and Access) Act 2025 added a duty to facilitate data protection
complaints and acknowledge them within 30 days. The privacy policy tells users
to email `support@salelinx.com` with the subject "Data protection complaint".
Handling:

1. Acknowledge receipt within 30 days (sooner is better; a one-line reply
   counts).
2. Investigate and reply with the outcome. Keep the thread in the support
   inbox as the record.
3. The reply must mention the user's right to complain to the ICO regardless
   of our outcome.

## Development rules

- No PII (email addresses, message bodies, buyer data) in `console.log` inside
  Edge Functions. User UUIDs are acceptable. This covers listing titles and
  descriptions, which `resolve-category` receives: match them, never log them.
- Every new user-owned table must reference `auth.users(id) ON DELETE CASCADE`
  so the deletion runbook keeps working.
- `admin_audit_log.metadata` must never contain ticket content or user IDs.
- New features that touch buyer (not seller) personal data need a privacy
  policy and terms update before shipping.
