-- Let a user reply to a closed ticket, and reopen it when they do.
--
-- Since 094 (fix/support-email-no-reply) every user-facing support email is
-- Reply-To no-reply and tells the reader to answer on their ticket. For a
-- CLOSED ticket that instruction had nowhere to land: the reply box is hidden
-- on closed tickets, closed tickets are collapsed out of the list by default,
-- and the email itself bounces. Three dead ends for someone following our own
-- copy.
--
-- Underneath sat an RLS gap: "Owners reply on own tickets" only ever checked
-- ownership, never status, so the database already ACCEPTED replies on closed
-- tickets - the restriction was client-side only. This migration makes the
-- database the authority and picks reopen (not refusal) as the behaviour, so
-- the funnel the email promises actually works end to end.
--
-- Deliberately NOT counted against the 3-open-ticket cap in
-- enforce_support_ticket_limits(): that trigger is BEFORE INSERT on
-- support_tickets and a reopen is an UPDATE, so it never fires. Continuing an
-- existing conversation is not the spam vector the cap exists for, and the
-- 20-replies-per-24h cap in 018 still bounds this path.

-- =============================================================================
-- 1. Reopen the parent ticket on a non-admin reply
-- =============================================================================
-- Folded into the existing touch-parent trigger rather than added as a second
-- AFTER INSERT trigger: both write the same row, and one UPDATE avoids a
-- second write plus any ordering question between them.
--
-- Admin replies deliberately do NOT reopen. Staff answering a closed ticket
-- (a follow-up note, a correction) should not resurrect it in their own queue;
-- they have an explicit reopen control in the admin console.
--
-- CREATE OR REPLACE resets EXECUTE to PUBLIC, so the REVOKE from
-- 024_function_grant_hygiene.sql is re-applied at the bottom of this file.
-- See the CLAUDE.md gotcha.

CREATE OR REPLACE FUNCTION public.support_ticket_replies_touch_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
    SET updated_at = NOW(),
        status = CASE
          WHEN NEW.is_admin = FALSE AND status = 'closed' THEN 'open'
          ELSE status
        END
    WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.support_ticket_replies_touch_parent()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 2. RLS: intentionally unchanged
-- =============================================================================
-- "Owners reply on own tickets" (003_support.sql) checks ownership and
-- is_admin = FALSE, with no status condition. That was the gap described
-- above, but given reopen-on-reply it is now the CORRECT policy: the owner may
-- reply to any ticket of theirs, open or closed, and the trigger above brings
-- a closed one back to 'open'.
--
-- Recorded here so a future reader does not "tighten" it with
-- `AND t.status = 'open'` and silently reinstate the dead end.
