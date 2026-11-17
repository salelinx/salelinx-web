-- Test and staff accounts hidden from /admin/users. Display only.
CREATE TABLE IF NOT EXISTS public.admin_hidden_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_hidden_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_hidden_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.admin_hidden_users TO authenticated;

DROP POLICY IF EXISTS "admin_hidden_users admin" ON public.admin_hidden_users;
CREATE POLICY "admin_hidden_users admin"
  ON public.admin_hidden_users FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
