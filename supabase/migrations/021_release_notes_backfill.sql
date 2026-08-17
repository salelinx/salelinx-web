-- release_notes, take two.
--
-- Migration 005 creates this table and is recorded as applied in
-- supabase_migrations.schema_migrations, but the table was never actually
-- created on the remote project. The tracking table itself only appeared
-- later and was backfilled with all 20 versions marked applied, so 005's
-- SQL never ran against the database. This migration creates the object for
-- real, and is written to be safe if 005 is ever replayed on a fresh
-- database or if this migration is run twice.
--
-- Nothing here causes anyone's extension to prompt for an update. The panel's
-- "Update available" banner is driven entirely by chrome.runtime.onUpdateAvailable,
-- which Chrome fires only when it has staged a new Web Store build on that
-- user's machine. This table just supplies the bullet list shown under the
-- "v{version} is available" headline, plus the is_critical red tint. With no
-- matching row the banner still shows, only without bullets. See the extension
-- repo's docs/technical/UPDATES.md.

CREATE TABLE IF NOT EXISTS public.release_notes (
  version TEXT PRIMARY KEY,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_published_at
  ON public.release_notes(published_at DESC);

ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

-- Public read so the banner can resolve notes without authenticating. The
-- extension queries this from the service worker with the user's session, but
-- logged-out users (and users without a Supabase row yet) still get the notes.
DROP POLICY IF EXISTS "release_notes public read" ON public.release_notes;
CREATE POLICY "release_notes public read"
  ON public.release_notes FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies, so writes are service role only. Add one
-- row per released version, keyed by the exact manifest.version string:
--   INSERT INTO public.release_notes (version, notes) VALUES
--     ('2.0.1', '["Faster auto-offers", "Fixed Vinted CSRF capture"]');
