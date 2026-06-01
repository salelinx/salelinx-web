-- release_notes — per-version bullet lists shown in the panel's "Update
-- available" banner. RLS public-read so unauthenticated extensions still
-- pull notes. Writes are admin-only (service role / dashboard).
--
-- Banner flow: SW receives chrome.runtime.onUpdateAvailable → records the
-- staged version → handler fetchReleaseNotes(version) queries this table →
-- panel renders bullets under the "v{version} is available" headline.
-- See src/utils/updates.ts.
--
-- is_critical is reserved for a future forced-reload path (e.g. security
-- fix that can't wait for SW idle). The current UI tints the banner red
-- when true but still allows dismissal.

CREATE TABLE public.release_notes (
  version TEXT PRIMARY KEY,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_release_notes_published_at
  ON public.release_notes(published_at DESC);

ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

-- Public read so the banner can resolve notes without authenticating. The
-- extension queries this from the SW with the user's session, but logged-out
-- users (or users without a Supabase row yet) still get the notes.
CREATE POLICY "release_notes public read"
  ON public.release_notes FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies → service role only. Add rows via the
-- Supabase dashboard or a CI script:
--   INSERT INTO public.release_notes (version, notes) VALUES
--     ('2.0.1', '["Faster auto-offers", "Fixed Vinted CSRF capture"]');
