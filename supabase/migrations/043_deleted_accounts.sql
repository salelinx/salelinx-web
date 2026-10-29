-- Deleted-account tombstones for /admin/users: no FK to auth.users and no readable email (docs/GDPR.md).

CREATE TABLE public.deleted_accounts (
  user_id UUID PRIMARY KEY,
  email_hash TEXT,
  signed_up_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tier_id TEXT,
  status TEXT,
  country TEXT,
  signup_source TEXT
);

CREATE INDEX idx_deleted_accounts_email_hash ON public.deleted_accounts(email_hash);

ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

-- Must match lib/admin/deleted-email-hash.ts, which hashes the admin's search.
CREATE OR REPLACE FUNCTION public.deleted_email_hash(p_email TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(extensions.digest('slx-deleted:' || lower(trim(p_email)), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION public.deleted_email_hash(TEXT) FROM PUBLIC, anon, authenticated;

-- BEFORE, so the subscription has not cascaded yet; errors are swallowed so an erasure never fails here.
CREATE OR REPLACE FUNCTION public.record_deleted_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO deleted_accounts (
      user_id, email_hash, signed_up_at, tier_id, status, country, signup_source
    )
    SELECT
      OLD.id,
      CASE WHEN OLD.email IS NULL THEN NULL ELSE deleted_email_hash(OLD.email) END,
      OLD.created_at,
      s.tier_id,
      s.status,
      OLD.raw_app_meta_data ->> 'country',
      OLD.raw_user_meta_data -> 'signup_source' ->> 'source'
    FROM (SELECT 1) one
    LEFT JOIN LATERAL (
      SELECT sub.tier_id, sub.status
      FROM subscriptions sub
      WHERE sub.user_id = OLD.id
      ORDER BY sub.updated_at DESC
      LIMIT 1
    ) s ON TRUE
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_deleted_account failed: %', SQLERRM;
  END;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.record_deleted_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_record_deleted_account
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.record_deleted_account();

-- The admin 'user.delete' audit entry carries no user id, only account_created_at.
CREATE OR REPLACE FUNCTION public.admin_list_deleted_accounts()
RETURNS TABLE (
  user_id UUID,
  email_hash TEXT,
  signed_up_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  tier_id TEXT,
  status TEXT,
  country TEXT,
  signup_source TEXT,
  deleted_by_admin BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.user_id,
    d.email_hash,
    d.signed_up_at,
    d.deleted_at,
    d.tier_id,
    d.status,
    d.country,
    d.signup_source,
    EXISTS (
      SELECT 1 FROM admin_audit_log a
      WHERE a.action = 'user.delete'
        AND (a.metadata ->> 'account_created_at')::timestamptz = d.signed_up_at
    ) AS deleted_by_admin
  FROM deleted_accounts d
  WHERE public.is_admin()
  ORDER BY d.deleted_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_deleted_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_deleted_accounts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prune_deleted_accounts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM deleted_accounts WHERE deleted_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_deleted_accounts() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prune-deleted-accounts',
      '40 3 * * *',
      'SELECT public.prune_deleted_accounts()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule prune_deleted_accounts() manually (see docs/GDPR.md)';
  END IF;
END;
$$;
