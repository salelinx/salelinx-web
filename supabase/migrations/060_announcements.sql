-- Announcements shown in the SaleLinx extension, written in /admin/announcements.
--
-- An admin writes a short message ("Vinted crosslisting is broken, we're on
-- it", "please update to 1.6.2", planned maintenance) and every matching user
-- sees it in the extension: a banner in the panel for info and warning, a popup
-- once and then a red banner for critical. The extension owns the display and
-- the matching (tier, marketplaces, version range, signed in); this file owns
-- the rows, their validation and how the extension hears about a change.
--
-- Copy is plain text, JSONB keyed by the extension's locales ('en', 'fr',
-- 'es', 'de'). English is required; a missing locale falls back to English.
-- The extension escapes the text, so nothing here is ever rendered as HTML. A
-- message may carry one button whose URL must be on the allowlist in
-- announcement_cta_url_ok() below; the extension checks the same list itself
-- and the console mirrors it in lib/announcements/types.ts.
--
-- Two tables, because of how Realtime works:
--
--   announcements        the rows. Not public: RLS lets only admins read it,
--                        and the extension reads through active_announcements(),
--                        which leaves out created_by and created_at.
--   announcement_signal  one row, a counter. A statement trigger on
--                        announcements bumps it on every write, and the
--                        extension subscribes to it with postgres_changes,
--                        then re-reads active_announcements(). Realtime checks
--                        RLS against the NEW row, so watching announcements
--                        directly could never deliver the UPDATE that ends a
--                        message (and announcements must not be public anyway).
--                        The counter row carries nothing but a number and a
--                        time, so it is readable by everyone.
--
-- revision starts at 1 and goes up only when an admin saves with "show again
-- to people who dismissed it". The extension keys a dismissal on (id,
-- revision), so a typo fix leaves dismissed messages dismissed.
--
-- created_by is the authoring admin's id, ON DELETE SET NULL like
-- status_overrides.set_by (docs/GDPR.md): deleting an admin anonymises the row
-- rather than silently taking down a live notice. It is never returned to the
-- public and is left out of the audit entries.
--
-- Apply by hand (supabase db query --linked -f), never db push. Re-runnable.
-- Safe either side of the web deploy: until this runs, /admin/announcements
-- shows a load error and the extension finds no function to call.

BEGIN;

-- =============================================================================
-- 1. announcements
-- =============================================================================
-- Per-value length caps, trimming and the button URL allowlist are enforced by
-- admin_save_announcement(); the CHECKs here are the cheap structural ones, a
-- backstop for direct SQL edits. ends_at > starts_at is deliberately NOT a
-- CHECK: ending a scheduled message sets ends_at to now, before its start.

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
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
  -- The button. Both NULL means no button; see announcements_cta_pair.
  cta_label JSONB CHECK (
    cta_label IS NULL OR (
      jsonb_typeof(cta_label) = 'object'
      AND (cta_label - ARRAY['en', 'fr', 'es', 'de']) = '{}'::jsonb
      AND length(btrim(COALESCE(cta_label->>'en', ''))) > 0
    )
  ),
  cta_url TEXT,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  -- Empty means everyone. 'none' is a signed-in user with no live plan.
  audience_tiers TEXT[] NOT NULL DEFAULT '{}' CHECK (
    audience_tiers <@ ARRAY['trial', 'starter', 'pro', 'business', 'none']::TEXT[]
  ),
  -- Empty means everyone. The extension matches a user who has ANY of these
  -- marketplaces switched on.
  audience_platforms TEXT[] NOT NULL DEFAULT '{}' CHECK (
    audience_platforms <@ ARRAY['depop', 'vinted', 'ebay']::TEXT[]
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
  CONSTRAINT announcements_cta_pair CHECK ((cta_label IS NULL) = (cta_url IS NULL))
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
-- 2. announcement_signal - the one-row counter the extension subscribes to
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

-- Statement level, so a write that touches several rows is one bump. Fires
-- for the console's RPCs and for edits made in the SQL editor alike.
CREATE OR REPLACE FUNCTION public.announcements_bump_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.announcement_signal
  SET rev = rev + 1,
      changed_at = NOW()
  WHERE id = 1;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.announcements_bump_signal()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS announcements_bump_signal ON public.announcements;
CREATE TRIGGER announcements_bump_signal
  AFTER INSERT OR UPDATE OR DELETE ON public.announcements
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.announcements_bump_signal();

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
-- 3. announcement_cta_url_ok() - the button URL allowlist
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
-- 4. announcement_clean_text() - normalise one localized copy object
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
-- 5. active_announcements() - what the extension reads
-- =============================================================================
-- Everything not yet ended that starts within the next day, so the extension
-- can hold a scheduled message and show it on time without a write to wake
-- it. Filtering by audience is the extension's job (it knows the user's tier,
-- marketplaces and version; signed-out callers have no tier). Callable by anon
-- on purpose: signed-out users must see alerts too, e.g. "login is broken".
-- Deliberately omits created_by and created_at.

CREATE OR REPLACE FUNCTION public.active_announcements()
RETURNS TABLE (
  id UUID,
  severity TEXT,
  title JSONB,
  body JSONB,
  cta_label JSONB,
  cta_url TEXT,
  dismissible BOOLEAN,
  audience_tiers TEXT[],
  audience_platforms TEXT[],
  min_version TEXT,
  max_version TEXT,
  signed_in_only BOOLEAN,
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
  SELECT a.id, a.severity, a.title, a.body, a.cta_label, a.cta_url,
         a.dismissible, a.audience_tiers, a.audience_platforms,
         a.min_version, a.max_version, a.signed_in_only,
         a.starts_at, a.ends_at, a.revision, a.updated_at
  FROM public.announcements a
  WHERE (a.ends_at IS NULL OR a.ends_at > NOW())
    AND a.starts_at <= NOW() + INTERVAL '1 day'
  ORDER BY a.starts_at, a.id;
$$;

REVOKE ALL ON FUNCTION public.active_announcements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_announcements() TO anon, authenticated;

-- =============================================================================
-- 6. admin_save_announcement() - create or edit one announcement
-- =============================================================================
-- One function for both, like admin_save_roadmap_item, so the validation exists
-- once. p_is_new says which: a create inserts (with p_id when given, a new id
-- otherwise; an id that exists answers id_taken), an edit updates the row and
-- answers not_found when it is gone. Returns {ok: true, id}.
--
-- Error codes: invalid_severity, invalid_title, invalid_body, invalid_cta
-- (label without URL or the reverse, a label with no English, or a label over
-- 40), invalid_cta_url (off the allowlist), invalid_audience, invalid_version
-- (bad format, or the lowest version above the highest), invalid_schedule
-- (ends_at not after starts_at), not_found, id_taken.
--
-- p_starts_at NULL means now. revision goes up by one only with p_show_again,
-- which is what makes the extension show it again to people who dismissed it.
-- The audit entry carries the whole old and new rows (without created_by, per
-- docs/GDPR.md's rule against user ids in audit metadata), so every edit is
-- reversible from the log.

CREATE OR REPLACE FUNCTION public.admin_save_announcement(
  p_id UUID,
  p_is_new BOOLEAN,
  p_severity TEXT,
  p_title JSONB,
  p_body JSONB,
  p_cta_label JSONB,
  p_cta_url TEXT,
  p_dismissible BOOLEAN,
  p_audience_tiers TEXT[],
  p_audience_platforms TEXT[],
  p_min_version TEXT,
  p_max_version TEXT,
  p_signed_in_only BOOLEAN,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
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
  c_version CONSTANT TEXT := '^[0-9]+(\.[0-9]+){0,3}$';
  v_previous public.announcements%ROWTYPE;
  v_exists BOOLEAN := FALSE;
  v_id UUID;
  v_title JSONB;
  v_body JSONB;
  v_cta_label JSONB;
  v_cta_url TEXT := NULLIF(btrim(p_cta_url, E' \t\r\n'), '');
  v_tiers TEXT[];
  v_platforms TEXT[];
  v_min TEXT := NULLIF(btrim(p_min_version, E' \t\r\n'), '');
  v_max TEXT := NULLIF(btrim(p_max_version, E' \t\r\n'), '');
  v_starts TIMESTAMPTZ := COALESCE(p_starts_at, NOW());
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_severity IS NULL OR p_severity NOT IN ('info', 'warning', 'critical') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_severity');
  END IF;

  v_title := public.announcement_clean_text(p_title, 120);
  IF v_title IS NULL OR NOT v_title ? 'en' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_title');
  END IF;

  v_body := public.announcement_clean_text(p_body, 600);
  IF v_body IS NULL OR NOT v_body ? 'en' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_body');
  END IF;

  -- A label left blank in every language is no label.
  IF p_cta_label IS NOT NULL AND jsonb_typeof(p_cta_label) <> 'null' THEN
    v_cta_label := public.announcement_clean_text(p_cta_label, 40);
    IF v_cta_label IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_cta');
    END IF;
    IF v_cta_label = '{}'::jsonb THEN
      v_cta_label := NULL;
    END IF;
  END IF;
  IF (v_cta_label IS NOT NULL AND NOT v_cta_label ? 'en')
     OR (v_cta_label IS NULL) <> (v_cta_url IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cta');
  END IF;
  IF v_cta_url IS NOT NULL AND NOT public.announcement_cta_url_ok(v_cta_url) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cta_url');
  END IF;

  -- De-duplicated, in a fixed order, so the stored arrays do not depend on the
  -- order checkboxes were ticked in. A NULL element fails the <@ check.
  SELECT COALESCE(array_agg(t ORDER BY array_position(c_tiers, t)), '{}')
  INTO v_tiers
  FROM (SELECT DISTINCT unnest(COALESCE(p_audience_tiers, '{}')) AS t) s;
  SELECT COALESCE(array_agg(p ORDER BY array_position(c_platforms, p)), '{}')
  INTO v_platforms
  FROM (SELECT DISTINCT unnest(COALESCE(p_audience_platforms, '{}')) AS p) s;
  IF NOT v_tiers <@ c_tiers OR NOT v_platforms <@ c_platforms THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_audience');
  END IF;

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

  IF p_ends_at IS NOT NULL AND p_ends_at <= v_starts THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_schedule');
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
  END IF;

  IF v_exists THEN
    UPDATE public.announcements
    SET severity = p_severity,
        title = v_title,
        body = v_body,
        cta_label = v_cta_label,
        cta_url = v_cta_url,
        dismissible = COALESCE(p_dismissible, TRUE),
        audience_tiers = v_tiers,
        audience_platforms = v_platforms,
        min_version = v_min,
        max_version = v_max,
        signed_in_only = COALESCE(p_signed_in_only, FALSE),
        starts_at = v_starts,
        ends_at = p_ends_at,
        revision = revision + CASE WHEN COALESCE(p_show_again, FALSE) THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.announcements (
      id, severity, title, body, cta_label, cta_url, dismissible,
      audience_tiers, audience_platforms, min_version, max_version,
      signed_in_only, starts_at, ends_at, created_by
    )
    VALUES (
      v_id, p_severity, v_title, v_body, v_cta_label, v_cta_url,
      COALESCE(p_dismissible, TRUE), v_tiers, v_platforms, v_min, v_max,
      COALESCE(p_signed_in_only, FALSE), v_starts, p_ends_at, auth.uid()
    );
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN v_exists THEN 'announcement.update' ELSE 'announcement.create' END,
    'announcements',
    v_id::TEXT,
    jsonb_build_object(
      'old', CASE WHEN v_exists THEN to_jsonb(v_previous) - 'created_by' ELSE NULL END,
      'new', (SELECT to_jsonb(a) - 'created_by' FROM public.announcements a WHERE a.id = v_id),
      'show_again', v_exists AND COALESCE(p_show_again, FALSE)
    )
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_announcement(
  UUID, BOOLEAN, TEXT, JSONB, JSONB, JSONB, TEXT, BOOLEAN, TEXT[], TEXT[],
  TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_announcement(
  UUID, BOOLEAN, TEXT, JSONB, JSONB, JSONB, TEXT, BOOLEAN, TEXT[], TEXT[],
  TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) TO authenticated;

-- =============================================================================
-- 7. admin_end_announcement() - take one down now
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
-- 8. admin_delete_announcement() - remove one for good
-- =============================================================================
-- The audit entry carries the whole row, so a delete is reversible from the
-- log; that is why the console asks for a confirm, not step-up reauth (the
-- roadmap's rule). Ending is the softer alternative.

CREATE OR REPLACE FUNCTION public.admin_delete_announcement(p_id UUID)
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

  DELETE FROM public.announcements WHERE id = p_id;

  PERFORM public.log_admin_action(
    'announcement.delete',
    'announcements',
    p_id::TEXT,
    jsonb_build_object('old', to_jsonb(v_previous) - 'created_by')
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_announcement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_announcement(UUID) TO authenticated;

COMMIT;
