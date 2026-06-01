-- support_tickets.notification_message_id
--
-- Stores the RFC 5322 Message-ID of the first support-notification email
-- sent to support@salelinx.com when a ticket is created. Reply
-- notifications (one per support_ticket_replies row where is_admin = false)
-- set In-Reply-To and References to this value so Gmail threads them under
-- the original notification.
--
-- Written by the send-support-email Edge Function in the resale-bot-web repo:
--   1. Database Webhook fires on INSERT into support_tickets
--   2. Function POSTs the notification to Resend, captures the Message-ID
--      from the response, and UPDATEs this column on the same row
--   3. Database Webhook fires on INSERT into support_ticket_replies
--      (is_admin = false), function reads notification_message_id from the
--      parent ticket and sets headers accordingly

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS notification_message_id TEXT;
