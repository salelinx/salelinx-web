-- Announcements shown in the SaleLinx extension, written in /admin/announcements.
--
-- An admin writes a message and every matching user sees it in the extension.
-- It can be anything: an outage notice, "please update", a new feature, an
-- offer, a tip. Each message chooses for itself:
--
--   look         theme (a colour from a fixed set, so it reads in light and
--                dark mode), icon (from a fixed set) or an emoji instead, and
--                an optional image uploaded to the announcement-images bucket
--   content      title and body in up to four languages, up to two buttons
--   placements   where it shows: banner (panel, and the login screen when
--                signed out), popup (over the panel), launcher (card by the
--                launcher tile while the panel is closed), badge (red "!" on
--                the toolbar icon) and toolbar (the toolbar popup)
--   frequency    until_closed, once, every_open or always (no close button)
--   priority     normal, high or urgent: the order messages are shown in
--   audience     plan, marketplace, version range, signed in, language, panel
--                tab, and optionally a list of specific users
--   schedule     starts_at, ends_at
--
-- The extension owns the display and most of the matching (it knows the
-- user's plan, marketplaces, version, language and tab). The one filter that
-- must happen here is "specific users": the recipient list is never sent to
-- anyone, so active_announcements() only returns a targeted message to the
-- users it is aimed at.
--
-- Copy is plain text, JSONB keyed by the extension's locales ('en', 'fr',
-- 'es', 'de'). English is required; a missing locale falls back to English.
-- The extension sets it with textContent, so nothing here is ever HTML.
--
-- Tables:
--
--   announcements            the rows. Not public: RLS lets only admins read
--                            it, and the extension reads through
--                            active_announcements().
--   announcement_recipients  who a targeted message is for, one row per user.
--                            A user's rows go with their account (ON DELETE
--                            CASCADE on auth.users), so account deletion
--                            needs no extra step. Admin read only.
--   announcement_signal      one row, a counter. Triggers on the two tables
--                            above bump it on every write, and the extension
--                            subscribes to it with postgres_changes, then
--                            re-reads active_announcements(). Realtime checks
--                            RLS against the NEW row, so watching
--                            announcements directly could never deliver the
--                            UPDATE that ends a message. The counter carries
--                            nothing but a number and a time.
--
-- The triggers use transition tables and only bump when rows really changed.
-- A deleted account cascades a DELETE into announcement_recipients, and a
-- plain statement trigger would fire for it even with no rows, pushing a
-- refetch to every install for nothing.
--
-- revision starts at 1 and goes up only when an admin saves with "show again
-- to people who dismissed it". The extension keys dismissals and "seen" on
-- (id, revision), so a typo fix leaves dismissed messages dismissed.
--
-- Personal data: created_by (the authoring admin, ON DELETE SET NULL like
-- status_overrides.set_by) and announcement_recipients.user_id. Neither is
-- ever returned to the public, and the audit entries carry neither: a save
-- logs how many recipients a message had, never who (docs/GDPR.md forbids
-- user ids in audit metadata).
--
-- Images: the public announcement-images bucket, written by admins only. The
-- row stores the path inside the bucket, never a URL, so the extension builds
-- the address itself and can only ever load from this bucket.
--
-- Apply by hand (supabase db query --linked -f), never db push. Re-runnable.
-- Safe either side of the web deploy: until this runs, /admin/announcements
-- shows a load error and the extension finds no function to call. Apply it
-- before releasing an extension version that reads announcements.

BEGIN;

-- =============================================================================
-- 1. announcements
-- =============================================================================
-- Per-value length caps, trimming, the button shape and the URL allowlist are
-- enforced by admin_save_announcement(); the CHECKs here are the cheap
-- structural ones, a backstop for direct SQL edits. ends_at > starts_at is
-- deliberately NOT a CHECK: ending a scheduled message sets ends_at to now,
-- before its start.
--
-- The lists of themes, icons, placements and frequencies are shared with the
-- extension, which draws them: adding one means a new extension version that
-- knows it, then a migration that allows it here. The extension falls back
-- for anything it does not know (theme blue, icon info, placement ignored,
-- frequency until_closed), so an older version still shows something sensible.
--
-- Panel tabs are checked for shape only: the list lives in
-- lib/announcements/types.ts, so a new panel tab needs no migration. The
-- extension simply never matches a tab id it does not have.

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  theme TEXT NOT NULL DEFAULT 'blue'
    CHECK (theme IN ('blue', 'green', 'purple', 'amber', 'red', 'grey')),
  icon TEXT NOT NULL DEFAULT 'info' CHECK (icon IN (
    'none', 'info', 'warning', 'alert', 'megaphone', 'sparkles', 'gift',
    'lightbulb', 'wrench', 'bell', 'star', 'heart'
  )),
  -- Shown instead of the icon when set. Up to 16 characters (a flag or a
  -- family emoji is several code points), no whitespace.
  emoji TEXT CHECK (
    emoji IS NULL OR (length(emoji) BETWEEN 1 AND 16 AND emoji !~ '[[:space:][:cntrl:]]')
  ),
  -- { "en": "...", "fr": "...", ... }. Known locale keys only, English
  -- required.
  title JSONB NOT NULL CHECK (
    jsonb_typeof(title) = 'object'
    AND (title - ARRAY['en', 'fr', 'es', 'de']) = '{}'::jsonb
    AND length(btrim(COALESCE(title->>'en', ''))) > 0
  ),
  body JSONB NOT NULL CHECK (
    jsonb_typeof(body) = 'object'
    AND (body - ARRAY['en', 'fr', 'es', 'de']) = '{}'::jsonb
    AND length(btrim(COALESCE(body->>'en', ''))) > 0
  ),
  -- A path inside the announcement-images bucket, e.g. '2026/11/ab12.png'.
  -- Lowercase letters, digits, '_', '-' and '.', in segments that start with
  -- a letter or digit, so never '..' as a segment.
  image_path TEXT CHECK (
    image_path IS NULL
    OR (length(image_path) <= 200
        AND image_path ~ '^[a-z0-9][a-z0-9_.-]*(/[a-z0-9][a-z0-9_.-]*)*$')
  ),
  -- [{ "label": { "en": "..." }, "url": "https://..." }], at most two. The
  -- first is drawn as the main button.
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(buttons) = 'array' AND jsonb_array_length(buttons) <= 2
  ),
  placements TEXT[] NOT NULL DEFAULT '{banner}' CHECK (
    cardinality(placements) >= 1
    AND placements <@ ARRAY['banner', 'popup', 'launcher', 'badge', 'toolbar']::TEXT[]
  ),
  frequency TEXT NOT NULL DEFAULT 'until_closed'
    CHECK (frequency IN ('until_closed', 'once', 'every_open', 'always')),
  -- Empty means everyone. 'none' is a signed-in user with no live plan.
  audience_tiers TEXT[] NOT NULL DEFAULT '{}' CHECK (
    audience_tiers <@ ARRAY['trial', 'starter', 'pro', 'business', 'none']::TEXT[]
  ),
  -- Empty means everyone. The extension matches a user who has ANY of these
  -- marketplaces switched on.
  audience_platforms TEXT[] NOT NULL DEFAULT '{}' CHECK (
    audience_platforms <@ ARRAY['depop', 'vinted', 'ebay']::TEXT[]
  ),
  -- Empty means everyone. The extension's display language.
  audience_locales TEXT[] NOT NULL DEFAULT '{}' CHECK (
    audience_locales <@ ARRAY['en', 'fr', 'es', 'de']::TEXT[]
  ),
  -- Empty means every tab. Panel tab ids ('crosslist', 'listings', ...).
  audience_tabs TEXT[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(audience_tabs) <= 30
    AND array_to_string(audience_tabs, ',') ~ '^([a-z]{2,30}(,[a-z]{2,30})*)?$'
  ),
  -- Inclusive bounds on the extension version. NULL means no bound.
  min_version TEXT CHECK (
    min_version IS NULL OR min_version ~ '^[0-9]+(\.[0-9]+){0,3}$'
  ),
  max_version TEXT CHECK (
    max_version IS NULL OR max_version ~ '^[0-9]+(\.[0-9]+){0,3}$'
  ),
  signed_in_only BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL means until an admin ends it.
  ends_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- A message for certain panel tabs only shows inside the panel: the
  -- launcher card, the badge and the toolbar popup have no tab.
  CONSTRAINT announcements_tab_placements CHECK (
    cardinality(audience_tabs) = 0 OR placements <@ ARRAY['banner', 'popup']::TEXT[]
  ),
  -- The badge leads to the toolbar popup, so the message must be there.
  CONSTRAINT announcements_badge_needs_toolbar CHECK (
    NOT ('badge' = ANY (placements)) OR 'toolbar' = ANY (placements)
  )
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admins read the table directly (the console); everyone else goes through
-- active_announcements(). Writes only through the SECURITY DEFINER functions
-- below, so there are no INSERT / UPDATE / DELETE grants or policies at all.
REVOKE ALL ON TABLE public.announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.announcements TO authenticated;

DROP POLICY IF EXISTS "announcements admin read" ON public.announcements;

-- Through is_admin(), so it inherits the AAL2 requirement like every other
-- admin surface.
CREATE POLICY "announcements admin read"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- 2. announcement_recipients - who a targeted message is for
-- =============================================================================
-- No rows for a message means everyone (subject to the other filters). Only
-- admin_save_announcement() writes here.

CREATE TABLE IF NOT EXISTS public.announcement_recipients (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, user_id)
);

-- The cascade from auth.users looks rows up by user.
CREATE INDEX IF NOT EXISTS announcement_recipients_user_idx
  ON public.announcement_recipients (user_id);

ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.announcement_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.announcement_recipients TO authenticated;

DROP POLICY IF EXISTS "announcement_recipients admin read" ON public.announcement_recipients;

CREATE POLICY "announcement_recipients admin read"
  ON public.announcement_recipients FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- 3. announcement_signal - the one-row counter the extension subscribes to
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.announcement_signal (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rev BIGINT NOT NULL DEFAULT 0,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.announcement_signal (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.announcement_signal ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.announcement_signal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.announcement_signal TO anon, authenticated;

DROP POLICY IF EXISTS "announcement_signal public read" ON public.announcement_signal;

-- Signed-out extension users need the push too (a "login is broken" notice).
CREATE POLICY "announcement_signal public read"
  ON public.announcement_signal FOR SELECT
  TO anon, authenticated
  USING (true);

-- Statement level, so a write that touches several rows is one bump, and only
-- when the statement changed at least one row (see the header). Every trigger
-- below names its transition table "changed". Fires for the console's RPCs
-- and for edits made in the SQL editor alike.
CREATE OR REPLACE FUNCTION public.announcements_bump_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM changed) THEN
    UPDATE public.announcement_signal
    SET rev = rev + 1,
        changed_at = NOW()
    WHERE id = 1;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.announcements_bump_signal()
  FROM PUBLIC, anon, authenticated;

-- A trigger with a transition table takes one event, hence three per table.
DROP TRIGGER IF EXISTS announcements_bump_signal ON public.announcements;
DROP TRIGGER IF EXISTS announcements_bump_signal_ins ON public.announcements;
DROP TRIGGER IF EXISTS announcements_bump_signal_upd ON public.announcements;
DROP TRIGGER IF EXISTS announcements_bump_signal_del ON public.announcements;
CREATE TRIGGER announcements_bump_signal_ins
  AFTER INSERT ON public.announcements
  REFERENCING NEW TABLE AS changed
  FOR EACH STATEMENT EXECUTE FUNCTION public.announcements_bump_signal();
CREATE TRIGGER announcements_bump_signal_upd
  AFTER UPDATE ON public.announcements
  REFERENCING NEW TABLE AS changed
  FOR EACH STATEMENT EXECUTE FUNCTION public.announcements_bump_signal();
CREATE TRIGGER announcements_bump_signal_del
  AFTER DELETE ON public.announcements
  REFERENCING OLD TABLE AS changed
  FOR EACH STATEMENT EXECUTE FUNCTION public.announcements_bump_signal();

DROP TRIGGER IF EXISTS announcement_recipients_bump_signal_ins ON public.announcement_recipients;
DROP TRIGGER IF EXISTS announcement_recipients_bump_signal_upd ON public.announcement_recipients;
DROP TRIGGER IF EXISTS announcement_recipients_bump_signal_del ON public.announcement_recipients;
CREATE TRIGGER announcement_recipients_bump_signal_ins
  AFTER INSERT ON public.announcement_recipients
  REFERENCING NEW TABLE AS changed
  FOR EACH STATEMENT EXECUTE FUNCTION public.announcements_bump_signal();
CREATE TRIGGER announcement_recipients_bump_signal_upd
  AFTER UPDATE ON public.announcement_recipients
  REFERENCING NEW TABLE AS changed
  FOR EACH STATEMENT EXECUTE FUNCTION public.announcements_bump_signal();
CREATE TRIGGER announcement_recipients_bump_signal_del
  AFTER DELETE ON public.announcement_recipients
  REFERENCING OLD TABLE AS changed
  FOR EACH STATEMENT EXECUTE FUNCTION public.announcements_bump_signal();

-- Idempotent: ADD TABLE raises if the table is already in the publication, and
-- this migration must be safe to re-run (same guard as 008_device_sessions).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'announcement_signal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_signal;
  END IF;
END;
$$;

-- =============================================================================
-- 4. announcement-images bucket
-- =============================================================================
-- Public, so the extension can show an image with a plain URL and no session
-- (signed-out users get announcements too). Admins upload from the editor and
-- the console removes an image no message uses any more. 2 MB, still images
-- only: no SVG, which can carry script.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcement-images', 'announcement-images', true, 2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can read announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete announcement images" ON storage.objects;

CREATE POLICY "Admins can read announcement images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-images' AND public.is_admin());
CREATE POLICY "Admins can upload announcement images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcement-images' AND public.is_admin());
CREATE POLICY "Admins can delete announcement images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'announcement-images' AND public.is_admin());

-- =============================================================================
-- 5. announcement_cta_url_ok() - the button URL allowlist
-- =============================================================================
-- The one place the list lives in SQL. Mirrored by ctaUrlOk() in
-- lib/announcements/types.ts (tests/announcements.test.ts compares the two
-- lists) and enforced again by the extension before it opens anything.
--
-- https only, at most 500 characters, printable ASCII only (no whitespace,
-- control characters or anything non-ASCII), no '@' (so no user:pass@host) and
-- no backslash: browsers read '\' as '/' in an https URL, so
-- https://evil.com\.salelinx.com would match the host pattern as a salelinx.com
-- subdomain but open evil.com. The host is what follows https:// up to the
-- first '/', '?' or '#'; a ':' there (an explicit port) fails the pattern. It
-- must be plain DNS labels and one of:
--   salelinx.com and any subdomain of it
--   chromewebstore.google.com
--   depop.com, www.depop.com
--   www.vinted.<market> and www.ebay.<site> for the markets listed below

CREATE OR REPLACE FUNCTION public.announcement_cta_url_ok(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_vinted CONSTANT TEXT[] := ARRAY[
    'co.uk', 'fr', 'de', 'com', 'es', 'it', 'pl', 'nl', 'be', 'pt', 'at', 'se',
    'dk', 'fi', 'cz', 'ro', 'sk', 'hu', 'lt', 'ie'
  ];
  c_ebay CONSTANT TEXT[] := ARRAY[
    'co.uk', 'com', 'de', 'fr', 'it', 'es', 'ie', 'nl', 'at', 'com.au', 'ca'
  ];
  v_host TEXT;
BEGIN
  IF p_url IS NULL OR length(p_url) > 500 THEN
    RETURN FALSE;
  END IF;
  IF left(p_url, 8) <> 'https://' THEN
    RETURN FALSE;
  END IF;
  -- Non-ASCII takes more than one byte (the database is UTF8); then ASCII
  -- whitespace and control characters, '@' and backslash.
  IF octet_length(p_url) <> length(p_url)
     OR p_url ~ '[[:space:][:cntrl:]]'
     OR strpos(p_url, '@') > 0
     OR strpos(p_url, chr(92)) > 0 THEN
    RETURN FALSE;
  END IF;

  v_host := lower(substring(p_url FROM '^https://([^/?#:@]+)(?:[/?#]|$)'));
  IF v_host IS NULL
     OR v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$' THEN
    RETURN FALSE;
  END IF;

  RETURN v_host = 'salelinx.com'
    OR right(v_host, 13) = '.salelinx.com'
    OR v_host = 'chromewebstore.google.com'
    OR v_host IN ('depop.com', 'www.depop.com')
    OR (left(v_host, 11) = 'www.vinted.' AND substr(v_host, 12) = ANY (c_vinted))
    OR (left(v_host, 9) = 'www.ebay.' AND substr(v_host, 10) = ANY (c_ebay));
END;
$$;

-- Internal: only the save function below calls it.
REVOKE ALL ON FUNCTION public.announcement_cta_url_ok(TEXT)
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 6. announcement_clean_text() - normalise one localized copy object
-- =============================================================================
-- Returns the object with every value trimmed and blank values dropped (blank
-- means "fall back to English"), or NULL when it is not valid: not an object,
-- a key other than en / fr / es / de, a value that is not a string, or a value
-- longer than p_max characters after trimming. A JSON null value counts as
-- blank. Whether 'en' is present is the caller's check.

CREATE OR REPLACE FUNCTION public.announcement_clean_text(
  p_text JSONB,
  p_max INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_out JSONB := '{}'::jsonb;
  v_key TEXT;
  v_value JSONB;
  v_text TEXT;
BEGIN
  IF p_text IS NULL OR jsonb_typeof(p_text) <> 'object' THEN
    RETURN NULL;
  END IF;

  FOR v_key, v_value IN SELECT e.key, e.value FROM jsonb_each(p_text) e LOOP
    IF v_key NOT IN ('en', 'fr', 'es', 'de') THEN
      RETURN NULL;
    END IF;
    IF jsonb_typeof(v_value) = 'null' THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(v_value) <> 'string' THEN
      RETURN NULL;
    END IF;
    v_text := btrim(v_value #>> '{}', E' \t\r\n');
    IF v_text = '' THEN
      CONTINUE;
    END IF;
    IF length(v_text) > p_max THEN
      RETURN NULL;
    END IF;
    v_out := v_out || jsonb_build_object(v_key, v_text);
  END LOOP;

  RETURN v_out;
END;
$$;

-- Internal: only the save function below calls it.
REVOKE ALL ON FUNCTION public.announcement_clean_text(JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 7. announcement_text_list() - a JSON array of strings as TEXT[]
-- =============================================================================
-- De-duplicated, empty for a missing or null value, NULL when it is not an
-- array of strings. Order is the caller's business.

CREATE OR REPLACE FUNCTION public.announcement_text_list(p_value JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
    RETURN '{}';
  END IF;
  IF jsonb_typeof(p_value) <> 'array' THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_value) e WHERE jsonb_typeof(e) <> 'string'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE(
    (SELECT array_agg(DISTINCT e) FROM jsonb_array_elements_text(p_value) e),
    '{}'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.announcement_text_list(JSONB)
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 8. active_announcements() - what the extension reads
-- =============================================================================
-- Everything not yet ended that starts within the next day, so the extension
-- can hold a scheduled message and show it on time without a write to wake
-- it. A message with recipients is returned only to those users (auth.uid(),
-- so never to a signed-out caller), with targeted = true so the extension can
-- drop it when the user signs out; the list itself is never returned. Every
-- other filter is the extension's job (it knows the user's plan,
-- marketplaces, version, language and tab). Callable by anon on purpose:
-- signed-out users must see alerts too, e.g. "login is broken". Leaves out
-- created_by and created_at.

DROP FUNCTION IF EXISTS public.active_announcements();

CREATE FUNCTION public.active_announcements()
RETURNS TABLE (
  id UUID,
  priority TEXT,
  theme TEXT,
  icon TEXT,
  emoji TEXT,
  title JSONB,
  body JSONB,
  image_path TEXT,
  buttons JSONB,
  placements TEXT[],
  frequency TEXT,
  audience_tiers TEXT[],
  audience_platforms TEXT[],
  audience_locales TEXT[],
  audience_tabs TEXT[],
  min_version TEXT,
  max_version TEXT,
  signed_in_only BOOLEAN,
  targeted BOOLEAN,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  revision INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.priority, a.theme, a.icon, a.emoji, a.title, a.body,
         a.image_path, a.buttons, a.placements, a.frequency,
         a.audience_tiers, a.audience_platforms, a.audience_locales,
         a.audience_tabs, a.min_version, a.max_version, a.signed_in_only,
         r.any_recipient, a.starts_at, a.ends_at, a.revision, a.updated_at
  FROM public.announcements a
  CROSS JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM public.announcement_recipients x WHERE x.announcement_id = a.id
    ) AS any_recipient
  ) r
  WHERE (a.ends_at IS NULL OR a.ends_at > NOW())
    AND a.starts_at <= NOW() + INTERVAL '1 day'
    AND (
      NOT r.any_recipient
      OR EXISTS (
        SELECT 1 FROM public.announcement_recipients x
        WHERE x.announcement_id = a.id AND x.user_id = auth.uid()
      )
    )
  ORDER BY a.starts_at, a.id;
$$;

REVOKE ALL ON FUNCTION public.active_announcements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_announcements() TO anon, authenticated;

-- =============================================================================
-- 9. admin_save_announcement() - create or edit one announcement
-- =============================================================================
-- One function for both, like admin_save_roadmap_item, so the validation exists
-- once. p_is_new says which: a create inserts (with p_id when given, a new id
-- otherwise; an id that exists answers id_taken), an edit updates the row and
-- answers not_found when it is gone. Returns {ok: true, id}, or {ok: false,
-- error} and, for unknown_recipients, the emails that match no account.
--
-- p_data holds the fields, named as the columns: priority, theme, icon,
-- emoji, title, body, image_path, buttons, placements, frequency,
-- audience_tiers, audience_platforms, audience_locales, audience_tabs,
-- min_version, max_version, signed_in_only, starts_at, ends_at. A missing
-- value takes the column default; starts_at missing means now.
--
-- p_recipient_emails is the whole list (it replaces what was there). Empty or
-- NULL means no specific users. At most 1000; matched without regard to case.
--
-- Error codes, in the order they are checked: invalid_priority,
-- invalid_look (theme, icon or emoji), invalid_title, invalid_body,
-- invalid_image (bad path, or no such file in the bucket), invalid_buttons
-- (not a list of at most two, a key other than label and url, a label with
-- no English or over 40), invalid_button_url (off the allowlist),
-- invalid_placements (none, unknown, or the badge without the toolbar
-- popup), invalid_frequency, invalid_audience, invalid_tabs (a tab id of the
-- wrong shape, or tabs with a place outside the panel), invalid_version (bad
-- format, or the lowest above the highest), invalid_schedule (ends_at not
-- after starts_at), too_many_recipients, unknown_recipients, not_found,
-- id_taken.
--
-- revision goes up by one only with p_show_again, which is what makes the
-- extension show it again to people who dismissed it. The audit entry
-- carries the whole old and new rows without created_by, and the number of
-- recipients before and after, never who they are (docs/GDPR.md).

DROP FUNCTION IF EXISTS public.admin_save_announcement(
  UUID, BOOLEAN, TEXT, JSONB, JSONB, JSONB, TEXT, BOOLEAN, TEXT[], TEXT[],
  TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.admin_save_announcement(
  p_id UUID,
  p_is_new BOOLEAN,
  p_data JSONB,
  p_recipient_emails TEXT[],
  p_show_again BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tiers CONSTANT TEXT[] := ARRAY['trial', 'starter', 'pro', 'business', 'none'];
  c_platforms CONSTANT TEXT[] := ARRAY['depop', 'vinted', 'ebay'];
  c_locales CONSTANT TEXT[] := ARRAY['en', 'fr', 'es', 'de'];
  c_placements CONSTANT TEXT[] := ARRAY['banner', 'popup', 'launcher', 'badge', 'toolbar'];
  c_themes CONSTANT TEXT[] := ARRAY['blue', 'green', 'purple', 'amber', 'red', 'grey'];
  c_icons CONSTANT TEXT[] := ARRAY[
    'none', 'info', 'warning', 'alert', 'megaphone', 'sparkles', 'gift',
    'lightbulb', 'wrench', 'bell', 'star', 'heart'
  ];
  c_version CONSTANT TEXT := '^[0-9]+(\.[0-9]+){0,3}$';
  v_data JSONB := COALESCE(p_data, '{}'::jsonb);
  v_previous public.announcements%ROWTYPE;
  v_previous_count INTEGER := 0;
  v_exists BOOLEAN := FALSE;
  v_id UUID;
  v_priority TEXT := COALESCE(v_data->>'priority', 'normal');
  v_theme TEXT := COALESCE(v_data->>'theme', 'blue');
  v_icon TEXT := COALESCE(v_data->>'icon', 'info');
  v_emoji TEXT := NULLIF(btrim(COALESCE(v_data->>'emoji', ''), E' \t\r\n'), '');
  v_title JSONB;
  v_body JSONB;
  v_image TEXT := NULLIF(btrim(COALESCE(v_data->>'image_path', ''), E' \t\r\n'), '');
  v_buttons JSONB := '[]'::jsonb;
  v_button JSONB;
  v_label JSONB;
  v_url TEXT;
  v_placements TEXT[];
  v_frequency TEXT := COALESCE(v_data->>'frequency', 'until_closed');
  v_tiers TEXT[];
  v_platforms TEXT[];
  v_locales TEXT[];
  v_tabs TEXT[];
  v_min TEXT := NULLIF(btrim(COALESCE(v_data->>'min_version', ''), E' \t\r\n'), '');
  v_max TEXT := NULLIF(btrim(COALESCE(v_data->>'max_version', ''), E' \t\r\n'), '');
  v_signed_in_only BOOLEAN := COALESCE((v_data->>'signed_in_only')::BOOLEAN, FALSE);
  v_starts TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
  v_emails TEXT[];
  v_user_ids UUID[];
  v_unknown TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_priority NOT IN ('normal', 'high', 'urgent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_priority');
  END IF;

  IF NOT v_theme = ANY (c_themes) OR NOT v_icon = ANY (c_icons)
     OR (v_emoji IS NOT NULL
         AND (length(v_emoji) > 16 OR v_emoji ~ '[[:space:][:cntrl:]]')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_look');
  END IF;

  v_title := public.announcement_clean_text(v_data->'title', 120);
  IF v_title IS NULL OR NOT v_title ? 'en' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_title');
  END IF;

  v_body := public.announcement_clean_text(v_data->'body', 600);
  IF v_body IS NULL OR NOT v_body ? 'en' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_body');
  END IF;

  -- The file must be in the bucket: a typo'd path would show a broken image
  -- to every user.
  IF v_image IS NOT NULL AND (
    length(v_image) > 200
    OR v_image !~ '^[a-z0-9][a-z0-9_.-]*(/[a-z0-9][a-z0-9_.-]*)*$'
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'announcement-images' AND o.name = v_image
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_image');
  END IF;

  -- Buttons: a list of at most two { label, url }. A button whose label is
  -- blank in every language and whose URL is blank is no button.
  IF v_data ? 'buttons' AND jsonb_typeof(v_data->'buttons') <> 'null' THEN
    IF jsonb_typeof(v_data->'buttons') <> 'array'
       OR jsonb_array_length(v_data->'buttons') > 2 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_buttons');
    END IF;
    FOR v_button IN SELECT e FROM jsonb_array_elements(v_data->'buttons') e LOOP
      IF jsonb_typeof(v_button) <> 'object'
         OR (v_button - ARRAY['label', 'url']) <> '{}'::jsonb THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_buttons');
      END IF;
      IF v_button ? 'url' AND jsonb_typeof(v_button->'url') NOT IN ('string', 'null') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_buttons');
      END IF;
      v_label := public.announcement_clean_text(COALESCE(v_button->'label', '{}'::jsonb), 40);
      v_url := NULLIF(btrim(COALESCE(v_button->>'url', ''), E' \t\r\n'), '');
      IF v_label IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_buttons');
      END IF;
      CONTINUE WHEN v_label = '{}'::jsonb AND v_url IS NULL;
      IF NOT v_label ? 'en' OR v_url IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_buttons');
      END IF;
      IF NOT public.announcement_cta_url_ok(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_button_url');
      END IF;
      v_buttons := v_buttons || jsonb_build_array(
        jsonb_build_object('label', v_label, 'url', v_url)
      );
    END LOOP;
  END IF;

  -- Lists are stored de-duplicated in a fixed order, so they do not depend on
  -- the order checkboxes were ticked in.
  v_placements := public.announcement_text_list(
    COALESCE(v_data->'placements', '["banner"]'::jsonb)
  );
  IF v_placements IS NULL OR cardinality(v_placements) = 0
     OR NOT v_placements <@ c_placements
     OR ('badge' = ANY (v_placements) AND NOT 'toolbar' = ANY (v_placements)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_placements');
  END IF;
  SELECT array_agg(p ORDER BY array_position(c_placements, p))
  INTO v_placements FROM unnest(v_placements) p;

  IF v_frequency NOT IN ('until_closed', 'once', 'every_open', 'always') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_frequency');
  END IF;

  v_tiers := public.announcement_text_list(v_data->'audience_tiers');
  v_platforms := public.announcement_text_list(v_data->'audience_platforms');
  v_locales := public.announcement_text_list(v_data->'audience_locales');
  IF v_tiers IS NULL OR NOT v_tiers <@ c_tiers
     OR v_platforms IS NULL OR NOT v_platforms <@ c_platforms
     OR v_locales IS NULL OR NOT v_locales <@ c_locales THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_audience');
  END IF;
  SELECT COALESCE(array_agg(t ORDER BY array_position(c_tiers, t)), '{}')
  INTO v_tiers FROM unnest(v_tiers) t;
  SELECT COALESCE(array_agg(p ORDER BY array_position(c_platforms, p)), '{}')
  INTO v_platforms FROM unnest(v_platforms) p;
  SELECT COALESCE(array_agg(l ORDER BY array_position(c_locales, l)), '{}')
  INTO v_locales FROM unnest(v_locales) l;

  v_tabs := public.announcement_text_list(v_data->'audience_tabs');
  IF v_tabs IS NULL OR cardinality(v_tabs) > 30
     OR EXISTS (SELECT 1 FROM unnest(v_tabs) t WHERE t !~ '^[a-z]{2,30}$')
     OR (cardinality(v_tabs) > 0 AND NOT v_placements <@ ARRAY['banner', 'popup']) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_tabs');
  END IF;
  SELECT COALESCE(array_agg(t ORDER BY t), '{}') INTO v_tabs FROM unnest(v_tabs) t;

  IF (v_min IS NOT NULL AND v_min !~ c_version)
     OR (v_max IS NOT NULL AND v_max !~ c_version) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_version');
  END IF;
  -- Compared as four numbers, padded with zeros, so 1.6 = 1.6.0 and
  -- 1.10 > 1.9. A range with nobody in it is a mistake, not an audience.
  IF v_min IS NOT NULL AND v_max IS NOT NULL
     AND (string_to_array(v_min, '.')::NUMERIC[] || ARRAY[0, 0, 0]::NUMERIC[])[1:4]
       > (string_to_array(v_max, '.')::NUMERIC[] || ARRAY[0, 0, 0]::NUMERIC[])[1:4] THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_version');
  END IF;

  BEGIN
    v_starts := COALESCE(NULLIF(v_data->>'starts_at', '')::TIMESTAMPTZ, NOW());
    v_ends := NULLIF(v_data->>'ends_at', '')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_schedule');
  END;
  IF v_ends IS NOT NULL AND v_ends <= v_starts THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_schedule');
  END IF;

  -- Recipients by email, matched without regard to case.
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(e))), '{}')
  INTO v_emails
  FROM unnest(COALESCE(p_recipient_emails, '{}')) e
  WHERE btrim(e) <> '';
  IF cardinality(v_emails) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_recipients');
  END IF;
  SELECT COALESCE(array_agg(u.id), '{}')
  INTO v_user_ids
  FROM auth.users u
  WHERE lower(u.email) = ANY (v_emails);
  SELECT COALESCE(array_agg(e ORDER BY e), '{}')
  INTO v_unknown
  FROM unnest(v_emails) e
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = e);
  IF cardinality(v_unknown) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_recipients', 'emails', to_jsonb(v_unknown));
  END IF;

  IF p_is_new THEN
    v_id := COALESCE(p_id, gen_random_uuid());
    IF EXISTS (SELECT 1 FROM public.announcements WHERE id = v_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'id_taken');
    END IF;
  ELSE
    SELECT * INTO v_previous FROM public.announcements WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    v_exists := TRUE;
    v_id := p_id;
    SELECT count(*) INTO v_previous_count
    FROM public.announcement_recipients WHERE announcement_id = v_id;
  END IF;

  IF v_exists THEN
    UPDATE public.announcements
    SET priority = v_priority,
        theme = v_theme,
        icon = v_icon,
        emoji = v_emoji,
        title = v_title,
        body = v_body,
        image_path = v_image,
        buttons = v_buttons,
        placements = v_placements,
        frequency = v_frequency,
        audience_tiers = v_tiers,
        audience_platforms = v_platforms,
        audience_locales = v_locales,
        audience_tabs = v_tabs,
        min_version = v_min,
        max_version = v_max,
        signed_in_only = v_signed_in_only,
        starts_at = v_starts,
        ends_at = v_ends,
        revision = revision + CASE WHEN COALESCE(p_show_again, FALSE) THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.announcements (
      id, priority, theme, icon, emoji, title, body, image_path, buttons,
      placements, frequency, audience_tiers, audience_platforms,
      audience_locales, audience_tabs, min_version, max_version,
      signed_in_only, starts_at, ends_at, created_by
    )
    VALUES (
      v_id, v_priority, v_theme, v_icon, v_emoji, v_title, v_body, v_image,
      v_buttons, v_placements, v_frequency, v_tiers, v_platforms, v_locales,
      v_tabs, v_min, v_max, v_signed_in_only, v_starts, v_ends, auth.uid()
    );
  END IF;

  -- Replace the recipient list, touching only what changed so an unchanged
  -- list does not push a refetch to every install.
  DELETE FROM public.announcement_recipients
  WHERE announcement_id = v_id AND NOT user_id = ANY (v_user_ids);
  INSERT INTO public.announcement_recipients (announcement_id, user_id)
  SELECT v_id, uid FROM unnest(v_user_ids) uid
  ON CONFLICT DO NOTHING;

  PERFORM public.log_admin_action(
    CASE WHEN v_exists THEN 'announcement.update' ELSE 'announcement.create' END,
    'announcements',
    v_id::TEXT,
    jsonb_build_object(
      'old', CASE WHEN v_exists THEN to_jsonb(v_previous) - 'created_by' ELSE NULL END,
      'new', (SELECT to_jsonb(a) - 'created_by' FROM public.announcements a WHERE a.id = v_id),
      'recipients', jsonb_build_object(
        'before', v_previous_count,
        'after', cardinality(v_user_ids)
      ),
      'show_again', v_exists AND COALESCE(p_show_again, FALSE)
    )
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_announcement(UUID, BOOLEAN, JSONB, TEXT[], BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_announcement(UUID, BOOLEAN, JSONB, TEXT[], BOOLEAN)
  TO authenticated;

-- =============================================================================
-- 10. admin_announcement_recipients() - the editor's list of emails
-- =============================================================================
-- Every targeted message's recipients as emails, for the console's list and
-- editor. Admins only; emails, like admin_user_emails().

CREATE OR REPLACE FUNCTION public.admin_announcement_recipients()
RETURNS TABLE (announcement_id UUID, email TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT r.announcement_id, u.email::TEXT
  FROM public.announcement_recipients r
  JOIN auth.users u ON u.id = r.user_id
  ORDER BY r.announcement_id, u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_announcement_recipients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_announcement_recipients() TO authenticated;

-- =============================================================================
-- 11. admin_end_announcement() - take one down now
-- =============================================================================
-- Sets ends_at to now when it is open-ended or still in the future, which
-- covers a scheduled message too (it then never starts). One that has already
-- ended succeeds without writing or logging anything. Reversible by editing
-- the end time again.

CREATE OR REPLACE FUNCTION public.admin_end_announcement(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.announcements%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_previous FROM public.announcements WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_previous.ends_at IS NOT NULL AND v_previous.ends_at <= NOW() THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  UPDATE public.announcements
  SET ends_at = NOW(),
      updated_at = NOW()
  WHERE id = p_id;

  PERFORM public.log_admin_action(
    'announcement.end',
    'announcements',
    p_id::TEXT,
    jsonb_build_object(
      'old', to_jsonb(v_previous) - 'created_by',
      'new', (SELECT to_jsonb(a) - 'created_by' FROM public.announcements a WHERE a.id = p_id)
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_end_announcement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_end_announcement(UUID) TO authenticated;

-- =============================================================================
-- 12. admin_delete_announcement() - remove one for good
-- =============================================================================
-- The audit entry carries the whole row, so a delete is reversible from the
-- log, all but who a targeted message was for (only the count is kept). That
-- is why the console asks for a confirm, not step-up reauth (the roadmap's
-- rule). Ending is the softer alternative. Returns the image path, which the
-- console removes from the bucket when no other message uses it.

CREATE OR REPLACE FUNCTION public.admin_delete_announcement(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.announcements%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_previous FROM public.announcements WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.announcement_recipients WHERE announcement_id = p_id;

  DELETE FROM public.announcements WHERE id = p_id;

  PERFORM public.log_admin_action(
    'announcement.delete',
    'announcements',
    p_id::TEXT,
    jsonb_build_object(
      'old', to_jsonb(v_previous) - 'created_by',
      'recipients', jsonb_build_object('before', v_count, 'after', 0)
    )
  );

  RETURN jsonb_build_object('ok', true, 'image_path', v_previous.image_path);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_announcement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_announcement(UUID) TO authenticated;

COMMIT;
