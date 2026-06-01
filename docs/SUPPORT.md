# Support tickets

End-to-end picture of how a user files a support ticket (from the website or the Chrome extension), how it lands in `support@salelinx.com`'s Gmail, how staff manage and reply to it, and how the user is kept in the loop by email.

## Pieces

| Piece                            | Repo                       | Role                                                                                       |
| -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| Web support hub `/account/support` | `resale-bot-web`         | New-ticket form + the user's own thread + reply box. Admins also get the full management panel here. |
| Extension Support tab            | `muiltiplatform-seller-bot`| New-ticket form (with diagnostics) + read-only "my tickets" list + a deep-link to the web hub |
| `support_tickets` table          | shared Supabase            | One row per ticket. Columns: type, message, platform, status, diagnostics (app_version, tier_id, source, user_agent, locale), `notification_message_id` |
| `support_ticket_replies` table   | shared Supabase            | One row per reply (user or admin), `is_admin` flag stamped server-side                     |
| `admin_users` table + `is_admin()` | shared Supabase          | Admin membership + the RLS helper that gates the admin panel and admin writes              |
| Database Webhook x2              | Supabase dashboard         | Fire on INSERT into each of the two tables                                                 |
| `send-support-email`             | `resale-bot-web`           | Edge Function. Sends staff notifications, the user auto-ack, and admin-reply-to-user emails via Resend; persists Message-ID |
| Resend + Google Workspace        | external                   | Resend sends From `support@salelinx.com`; Gmail receives at the same address               |

## Who does what

- **Users** file and reply from either the website (`/account/support`) or the extension Support tab. The extension is read-only for existing threads and deep-links to the website to reply.
- **Staff** triage in two places: the `support@salelinx.com` Gmail inbox (notifications land there) and the admin panel on `/account/support` (visible only to `admin_users` members), where they reply, close/reopen, and delete tickets.
- The website is the canonical management surface; the extension's old admin panel was removed from the shipped bundle.

## End-to-end flow

```
User files a ticket (web form OR extension Support tab)
  ▼
INSERT INTO support_tickets (user_id, type, message, platform, source, ...)
  - web sets source='web' + locale + user_agent
  - extension sets source='extension' + app_version + tier_id + locale
  ▼
Database Webhook "support-ticket-created" fires
  ▼
POST {project-ref}.supabase.co/functions/v1/send-support-email
  x-support-webhook-secret: <secret>
  ▼
Edge Function (new ticket):
  1. Verify x-support-webhook-secret
  2. Look up author email via auth.admin.getUserById(record.user_id)  (service role)
  3. Send STAFF notification  -> To: support@salelinx.com, Reply-To: author
  4. Persist Message-ID to support_tickets.notification_message_id
  5. Send AUTO-ACK to author  -> To: author, Reply-To: support@  (best-effort)
  ▼
Staff see the ticket in Gmail AND in the /account/support admin panel.
The user gets an auto-ack and can track the ticket at /account/support.

Staff reply (admin panel inserts a reply row with is_admin = true)
  ▼
Database Webhook "support-ticket-reply-created" fires
  ▼
Edge Function (reply), is_admin = true:
  1. Load the parent ticket (need its user_id - the OWNER)
  2. Look up the OWNER's email (ticket.user_id, NOT the admin's id)
  3. Send the reply -> To: owner, From: support@, Reply-To: support@
     (presented as "SaleLinx Support"; admin identity never shown)
  ▼
The user receives the reply by email and also sees it in their thread.

User replies (web reply box inserts a reply row with is_admin = false)
  ▼
Edge Function (reply), is_admin = false:
  1. Load the parent ticket
  2. Send a STAFF notification -> To: support@, Reply-To: user,
     threaded under notification_message_id
  ▼
Gmail threads the user reply under the original notification.
```

## Email routing summary

| Trigger                         | To                  | From                 | Reply-To             | Threaded?                  |
| ------------------------------- | ------------------- | -------------------- | -------------------- | -------------------------- |
| New ticket (staff notif)        | `SUPPORT_NOTIFY_TO` | `SUPPORT_NOTIFY_FROM`| ticket author        | owns `notification_message_id` |
| New ticket (auto-ack)           | ticket author       | `SUPPORT_NOTIFY_FROM`| `SUPPORT_NOTIFY_TO`  | no (standalone)            |
| User reply (staff notif)        | `SUPPORT_NOTIFY_TO` | `SUPPORT_NOTIFY_FROM`| user                 | under `notification_message_id` |
| Admin reply (to user)           | ticket **owner**    | `SUPPORT_NOTIFY_FROM`| `SUPPORT_NOTIFY_TO`  | no (owner never saw the staff thread) |

The admin-reply recipient is the **ticket owner** (`ticket.user_id`), never the admin who authored the reply (`record.user_id`). This is the single most important correctness detail in the function.

## Threading details

We use RFC 5322 `Message-ID` / `In-Reply-To` / `References` headers, not subject-based threading. Resend doesn't return the raw SMTP Message-ID, but generates IDs in a stable format: `<{resend_email_id}@{sending_domain}>`. We reconstruct that from the `id` in the response + the domain of `SUPPORT_NOTIFY_FROM`, then persist it on the ticket as `notification_message_id`. The staff-side thread (new-ticket notif + user replies) threads under that id. Admin-reply-to-user emails are intentionally NOT threaded under it (the user never received the staff message); subject reuse keeps them loosely grouped in the user's inbox.

## Subject format

`[<Type>] <first 50 chars of the message>` for the staff notification and admin reply. `<Type>` is `Bug` / `Feature` / `Feedback`. The auto-ack uses a friendlier subject (`We received your support request [<Type>]`). Platform is not in the subject; it shows up in the staff notification body as a `Platform:` row.

## Where things live

| Concern                                      | File                                                            |
| -------------------------------------------- | --------------------------------------------------------------- |
| Edge Function (single file: handler + email rendering) | `supabase/functions/send-support-email/index.ts`      |
| Function gateway config                      | `supabase/config.toml` (`[functions.send-support-email]`)       |
| Diagnostics + source columns                 | `support_tickets` (migration `026_support_ticket_metadata.sql`) |
| Threading column                             | `support_tickets.notification_message_id` (migration `025`)     |
| Tickets + replies schema + admin RLS         | migrations `009_support_tickets.sql` + `012_admin_and_ticket_replies.sql` |
| Web hub (form + thread + admin)              | `app/[locale]/account/support/page.tsx` + `components/support/*` |
| Admin detection helper                       | `lib/supabase/admin.ts` (`isAdmin`)                             |
| Extension Support tab                        | `../muiltiplatform-seller-bot/src/panel/tabs/support.ts`        |
| Database Webhook config                      | Supabase dashboard (Database -> Webhooks)                       |

The function is deployed via the Supabase Dashboard's single-file upload, so the email templates live inline in `index.ts` rather than in a sibling `templates.ts`.

## Admin access

Admin is membership in the `admin_users` table (grant via the Supabase dashboard; there are no write RLS policies on it). The web hub calls `isAdmin(user.id)` to decide whether to render the admin panel, but that check is cosmetic: every admin write (reply with `is_admin=true`, status update, delete) is independently gated by RLS via `public.is_admin()`. A non-admin who somehow rendered the panel would see only their own tickets and be rejected on any admin write.

## Secrets

Set via `supabase secrets set` (NOT `.env.local`):

| Secret                       | Example                                       | Notes                                                          |
| ---------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| `RESEND_API_KEY`             | `re_...`                                      | Shared with `send-auth-email`                                  |
| `SUPPORT_NOTIFY_FROM`        | `SaleLinx Support <support@salelinx.com>`     | Must be on a Resend-verified domain                            |
| `SUPPORT_NOTIFY_TO`          | `support@salelinx.com`                        | Where staff notifications land                                 |
| `SUPPORT_NOTIFY_HOOK_SECRET` | `<random string, ~32+ chars>`                 | Sent as `x-support-webhook-secret` from the Database Webhooks  |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

## Failure modes

| Symptom                                                              | Likely cause                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tickets create but no email arrives                                  | Database Webhook not configured, or `x-support-webhook-secret` mismatch -> function returns 401                  |
| Staff notif arrives but the user gets no auto-ack                    | Auto-ack is best-effort; check function logs for `auto-ack failed`. The staff path still succeeds                |
| Admin reply emails the admin instead of the user                    | The recipient must be `ticket.user_id` (owner), not `record.user_id` (admin). Check the logged `owner=` value   |
| User-reply threading broken (each is a new thread)                  | `notification_message_id` is null on the ticket (pre-dates the function, or the UPDATE failed)                   |
| Function returns 500 "function misconfigured"                        | A required env var is unset. `supabase secrets list` to confirm                                                 |
| Function returns 502 "delivery failed"                              | Resend rejected the send (From domain not verified, or no matching `auth.users` row)                            |

## Future work

- **Inbound parsing.** Wire staff replies sent directly from Gmail (not via the admin panel) back into `support_ticket_replies`. Most likely path: Resend inbound webhook -> new Edge Function -> match thread by `In-Reply-To` against `notification_message_id`.
- **Status updates from email.** Allow `close` / `reopen` commands in email replies to flip `support_tickets.status`.
- **Localized emails.** The ack/admin-reply emails are English; the ticket now carries a `locale` column, so they could be rendered in the user's language (as `send-auth-email` already does).

## Related docs

- `docs/EDGE-FUNCTIONS.md` - the Edge Function table, Deno specifics, deploy steps
- `docs/ARCHITECTURE.md` - the broader two-repo / one-Supabase picture
- `../muiltiplatform-seller-bot/docs/` - the extension side (Support tab, write paths into the two tables)
