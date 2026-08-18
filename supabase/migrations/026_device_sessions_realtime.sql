-- Publish device_sessions to Realtime so an evicted device learns it was
-- evicted immediately, instead of on its next heartbeat.
--
-- The concurrent-device cap (015_device_sessions.sql) is enforced by
-- claim_device_session: a takeover DELETEs the stalest device's row and the
-- claimant takes the slot. The loser, though, only found out when it next
-- called the RPC - so "Use here instead" appeared to do nothing on the other
-- machine for as long as the heartbeat interval. Pushing the DELETE turns that
-- into sub-second.
--
-- The extension subscribes to DELETEs on its own row and signs the session out
-- when one arrives. The heartbeat still runs (it is what HOLDS the slot), so
-- it doubles as the fallback if the socket ever drops: a device whose row is
-- gone is denied on its next claim and signs out then instead.
--
-- Security: this publishes row CHANGES, not read access. Realtime still
-- evaluates the table's RLS for each subscriber, and device_sessions has only
-- the "device_sessions self read" policy (auth.uid() = user_id), so a
-- subscriber can only ever be told about their own rows. Nothing here widens
-- what anyone can read.
--
-- Privacy: the payload carries the replica identity columns only - a random
-- per-install device id and the owning user's uuid. No user agent, no
-- marketplace data. Consistent with docs/GDPR.md, which already covers
-- device_sessions.

-- REPLICA IDENTITY FULL so a DELETE payload carries the whole old row rather
-- than just the primary key. The default (primary key: user_id, device_id)
-- would technically be enough to identify the evicted install, but FULL is
-- what makes Realtime's RLS check and its `filter` reliably able to see
-- user_id on a delete. The table is tiny and low-churn (one row per install,
-- pruned after 30 idle days), so the extra WAL is negligible.
ALTER TABLE public.device_sessions REPLICA IDENTITY FULL;

-- Idempotent: ADD TABLE raises if the table is already in the publication, and
-- this migration must be safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'device_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
  END IF;
END;
$$;
