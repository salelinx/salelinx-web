-- Support tickets + replies, admin role, is_admin() helper, ticket rate
-- limits and retention.
--
-- Consolidated baseline (September 2026). This file is the net result of the
-- July 2026 baseline 003 plus the later incremental migrations that touched
-- support: 007 + 011 (user-deletion cascade, ticket retention purge), 009
-- (is_admin requires AAL2/MFA), 013 (message length caps), 014 + 018 (ticket
-- and reply rate limits), 024 (grant hygiene), 027 (reopen on user reply),
-- 028 (reply index). Full history in git.

-- =============================================================================
-- 1. admin_users - membership grants admin privileges
-- =============================================================================
-- No INSERT/UPDATE/DELETE policies: only the service role can grant admin
-- (do it via the Supabase dashboard SQL editor). See docs/ADMIN.md.

CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Regular users can only check their own row. Intentionally AAL1-readable so
-- the admin gates (proxy.ts, app/admin/layout.tsx) can route enrolled admins
-- to the MFA challenge.
CREATE POLICY "admin_users self read"
  ON public.admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. is_admin() helper - requires an AAL2 (MFA-verified) session
-- =============================================================================
-- SECURITY DEFINER so RLS on admin_users doesn't recursively block the check.
--
-- Every admin RLS policy and every admin SECURITY DEFINER RPC calls this, so
-- it is the single choke point for the MFA requirement (original migration
-- 009): the caller must be in admin_users AND have verified a TOTP code this
-- session. auth.jwt()->>'aal' is 'aal1'/'aal2' on user sessions, NULL for the
-- service role; COALESCE keeps those false. DEPLOY ORDER (lockout warning):
-- enroll every admin (Account > Security) BEFORE relying on this on a fresh
-- project, or the console locks them out until they enroll.
--
-- NOTE: anon deliberately keeps EXECUTE (via Supabase's default privileges).
-- RLS policies on support_tickets/replies/admin_audit_log call is_admin() for
-- the public role, and PostgreSQL checks EXECUTE when evaluating a policy
-- expression - revoking anon would turn "returns zero rows" into "permission
-- denied" for anonymous requests (original migration 024).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  )
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =============================================================================
-- 3. support_tickets
-- =============================================================================
-- Diagnostic metadata columns (app_version, tier_id, source, user_agent,
-- locale) are UNTRUSTED, DISPLAY-ONLY. The user INSERT policy only checks
-- auth.uid() = user_id, so a browser client can set any of these values.
-- Never branch authorization or entitlement logic on tier_id or source -
-- read the real tier from `subscriptions` if a decision depends on it.
--
-- notification_message_id stores the RFC 5322 Message-ID of the first
-- support-notification email sent to support@salelinx.com, so reply
-- notifications can set In-Reply-To/References and Gmail threads them.
-- Written by the send-support-email Edge Function. See docs/SUPPORT.md.
--
-- user_id cascades on user deletion (originals 007/011): the GDPR deletion
-- runbook requires every user-owned table to drop its rows with the account.

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CONSTRAINT support_tickets_type_check
    CHECK (type IN ('bug', 'feature', 'feedback', 'other')),
  message TEXT NOT NULL,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  app_version TEXT,
  tier_id TEXT,
  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'extension', 'email')),
  user_agent TEXT,
  locale TEXT,
  notification_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message length cap (original 013): TEXT had no bound, so a multi-megabyte
-- "message" would flow into the staff notification email in full. NOT VALID
-- preserved from the original: it applies to new rows only.
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_message_len
    CHECK (char_length(message) <= 10000) NOT VALID;

CREATE INDEX idx_support_tickets_status
  ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_user_id
  ON public.support_tickets(user_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can insert their own tickets, but can't impersonate the inbound-email
-- source: 'email'-sourced rows are created by the service role (Edge
-- Function), which bypasses RLS.
CREATE POLICY "Users can insert own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (source IS NULL OR source IN ('web', 'extension'))
  );

CREATE POLICY "Users can read own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all tickets"
  ON public.support_tickets FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update tickets"
  ON public.support_tickets FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tickets"
  ON public.support_tickets FOR DELETE
  USING (public.is_admin());

-- =============================================================================
-- 4. support_ticket_replies
-- =============================================================================

CREATE TABLE public.support_ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_ticket_replies
  ADD CONSTRAINT support_ticket_replies_body_len
    CHECK (char_length(body) <= 10000) NOT VALID;

CREATE INDEX idx_ticket_replies_ticket_id
  ON public.support_ticket_replies(ticket_id);
-- Reply rate-limit lookup (original 018).
CREATE INDEX idx_ticket_replies_user_created
  ON public.support_ticket_replies(user_id, created_at);
-- Admin console reply fetches order by created_at (original 028).
CREATE INDEX idx_support_ticket_replies_ticket_created
  ON public.support_ticket_replies(ticket_id, created_at);

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Ticket owners can see replies on their own tickets
CREATE POLICY "Owners read replies on own tickets"
  ON public.support_ticket_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Ticket owners can reply to their own tickets (is_admin must be false).
-- DELIBERATELY no status condition: the owner may reply to a CLOSED ticket
-- too, and the touch-parent trigger below reopens it (original 027). Do not
-- "tighten" this with `AND t.status = 'open'` - that would reinstate the
-- dead end where every support email says "reply on your ticket" and a
-- closed ticket offers nowhere to do it.
CREATE POLICY "Owners reply on own tickets"
  ON public.support_ticket_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_admin = FALSE
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Admins have full read/insert/delete
CREATE POLICY "Admins read all replies"
  ON public.support_ticket_replies FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins insert replies"
  ON public.support_ticket_replies FOR INSERT
  WITH CHECK (public.is_admin() AND auth.uid() = user_id);

CREATE POLICY "Admins delete replies"
  ON public.support_ticket_replies FOR DELETE
  USING (public.is_admin());

-- =============================================================================
-- 5. Touch updated_at on ticket changes; reopen on a non-admin reply
-- =============================================================================

CREATE OR REPLACE FUNCTION public.support_tickets_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.support_tickets_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_tickets_touch_updated_at();

-- A non-admin reply on a closed ticket reopens it (original 027). Admin
-- replies deliberately do NOT reopen: staff answering a closed ticket should
-- not resurrect it in their own queue; they have an explicit reopen control.
-- A reopen is an UPDATE so it never hits the 3-open-ticket cap (that trigger
-- is BEFORE INSERT), and the 20-replies-per-24h cap still bounds this path.

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

CREATE TRIGGER trg_support_ticket_replies_touch_parent
  AFTER INSERT ON public.support_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.support_ticket_replies_touch_parent();

-- =============================================================================
-- 6. Rate limits (originals 014 and 018)
-- =============================================================================
-- Server-side, so neither the website form nor a bot with a stolen JWT can
-- bypass them. Loose enough that a real user never notices: 3 concurrently
-- open tickets, 5 created per rolling 24h, 20 non-admin replies per rolling
-- 24h (admin replies exempt - staff answering many tickets must not be
-- throttled).

CREATE OR REPLACE FUNCTION public.enforce_support_ticket_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM support_tickets
    WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'support_ticket_daily_limit'
      USING HINT = 'You can open at most 5 tickets in 24 hours.';
  END IF;

  IF (
    SELECT count(*) FROM support_tickets
    WHERE user_id = NEW.user_id AND status = 'open'
  ) >= 3 THEN
    RAISE EXCEPTION 'support_ticket_open_limit'
      USING HINT = 'Please wait for a reply on your open tickets before opening another.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_support_ticket_limits() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_support_ticket_limits
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_support_ticket_limits();

CREATE OR REPLACE FUNCTION public.enforce_support_reply_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*) FROM support_ticket_replies
    WHERE user_id = NEW.user_id
      AND is_admin = FALSE
      AND created_at > now() - interval '24 hours'
  ) >= 20 THEN
    RAISE EXCEPTION 'support_reply_daily_limit'
      USING HINT = 'You have sent a lot of replies today. Please wait for the team to respond.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_support_reply_limits() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_support_reply_limits
  BEFORE INSERT ON public.support_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_support_reply_limits();

-- =============================================================================
-- 7. Support ticket retention purge (original 007)
-- =============================================================================
-- Closed tickets are purged 24 months after their last update, matching the
-- retention period stated in the privacy policy (docs/GDPR.md). No GRANT to
-- authenticated: only the service role or the cron job may run it.

CREATE OR REPLACE FUNCTION public.purge_old_support_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged INTEGER;
BEGIN
  DELETE FROM public.support_tickets
    WHERE status = 'closed'
      AND updated_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_support_tickets() FROM PUBLIC, anon, authenticated;

-- Schedule nightly at 03:17 UTC. Wrapped so the migration still succeeds on a
-- database without pg_cron; enable the extension in the Supabase dashboard
-- (Database > Extensions > pg_cron) and re-run this block if the NOTICE fires.
DO $$
BEGIN
  PERFORM cron.schedule(
    'purge-old-support-tickets',
    '17 3 * * *',
    $job$SELECT public.purge_old_support_tickets()$job$
  );
EXCEPTION WHEN invalid_schema_name OR undefined_function OR undefined_table THEN
  RAISE NOTICE 'pg_cron not available; schedule purge_old_support_tickets() manually (see docs/GDPR.md)';
END;
$$;
