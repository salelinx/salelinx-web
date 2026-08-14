-- Support tickets + replies, admin role, is_admin() helper.
--
-- Consolidated baseline (July 2026). This file is the net result of the
-- original migrations 009, 012_admin_and_ticket_replies, 025, 026 and 028.
-- Full history in git.

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

-- Regular users can only check their own row
CREATE POLICY "admin_users self read"
  ON public.admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. is_admin() helper
-- =============================================================================
-- SECURITY DEFINER so RLS on admin_users doesn't recursively block the check.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
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

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
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

CREATE INDEX idx_ticket_replies_ticket_id
  ON public.support_ticket_replies(ticket_id);

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

-- Ticket owners can reply to their own tickets (is_admin must be false)
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
-- 5. Touch updated_at on ticket changes and when a new reply is inserted
-- =============================================================================

CREATE OR REPLACE FUNCTION public.support_tickets_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_tickets_touch_updated_at();

CREATE OR REPLACE FUNCTION public.support_ticket_replies_touch_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
    SET updated_at = NOW()
    WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_replies_touch_parent
  AFTER INSERT ON public.support_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.support_ticket_replies_touch_parent();
