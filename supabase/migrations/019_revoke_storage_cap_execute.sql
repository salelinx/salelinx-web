-- Harden get_user_storage_cap against cross-user tier disclosure.
--
-- 004_storage_quota.sql granted EXECUTE to `authenticated`, but the function
-- is SECURITY DEFINER and takes an arbitrary p_user_id. That let any signed-in
-- user call it through PostgREST (rpc/get_user_storage_cap) with someone else's
-- UUID and read back that user's cloud_storage_bytes cap, which discloses their
-- coarse subscription tier. It is a confused-deputy: identity should come from
-- the caller, not a parameter.
--
-- The only real callers are the two storage triggers (enforce_storage_quota
-- and apply_storage_delta), which are themselves SECURITY DEFINER and invoke
-- this function with their own (owner) privileges, so they do not need the
-- direct grant to `authenticated`. Revoking it closes the PostgREST surface
-- without affecting quota enforcement.
--
-- Idempotent: REVOKE on an already-revoked grant is a no-op.

REVOKE EXECUTE ON FUNCTION public.get_user_storage_cap(UUID) FROM authenticated;
