-- Two tables were left off the "every user-owned table cascades from
-- auth.users" convention (docs/GDPR.md). In practice this meant deleting a
-- user who had ever filed a support ticket, or an admin with any audit log
-- entries, failed with a foreign key violation.

-- support_tickets: the deletion runbook already documents that removing a
-- user "cascades all user-owned rows including tickets" - this just makes
-- the constraint match that.
ALTER TABLE public.support_tickets
  DROP CONSTRAINT support_tickets_user_id_fkey,
  ADD CONSTRAINT support_tickets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- admin_audit_log: retention is documented as indefinite, even for admins
-- who are later removed (it deliberately holds no ticket content or user
-- IDs beyond the actor). Cascading would silently destroy audit history, so
-- the row survives and only the actor link is cleared.
ALTER TABLE public.admin_audit_log
  ALTER COLUMN actor_id DROP NOT NULL,
  DROP CONSTRAINT admin_audit_log_actor_id_fkey,
  ADD CONSTRAINT admin_audit_log_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
