-- Admin role + support ticket replies/status/delete
--
-- Adds:
--   1. admin_users table — flip a row into this table in the Supabase
--      dashboard to grant a user admin privileges
--   2. is_admin() SECURITY DEFINER helper used in RLS policies
--   3. status + updated_at on support_tickets
--   4. support_ticket_replies thread table
--   5. RLS policies giving admins full read/update/delete on tickets and
--      full read/insert/delete on replies, while still letting each user
--      see only their own thread

-- =============================================================================
-- 1. admin_users
-- =============================================================================

CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can see who else is admin; regular users can only check their own row
CREATE POLICY "admin_users self read"
  ON public.admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — only the service role can grant admin
-- (do it via the Supabase dashboard SQL editor)

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
-- 3. support_tickets — add status + updated_at
-- =============================================================================

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
  ON public.support_tickets(user_id);

-- Admin read/update/delete policies (additive — user policies from 009 stay)
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
