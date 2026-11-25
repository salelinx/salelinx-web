-- A place for an announcement on its own: 'login', the extension's login
-- screen, which is what people signed out of SaleLinx see (it covers the
-- panel). Until now a banner went there as well as into the panel, so every
-- message reached people signed out. Now the login screen shows only messages
-- that tick it, and it can be ticked alone.
--
-- The extension (salelinx-app src/shared/announcements.ts) gives someone
-- signed out only the 'login' place and someone signed in every place but
-- 'login'. The console saves signed_in_only as "not on the login screen", so
-- a build that does not know 'login' still keeps other messages off it.
--
-- Changes:
--   1. announcements.placements allows 'login'. The panel-tab rule
--      (announcements_tab_placements: tabs need banner or popup only) already
--      keeps it off a message for certain tabs, which the login screen, having
--      no tab, could never show.
--   2. admin_save_announcement() accepts 'login' and keeps it in the fixed
--      order after 'launcher'. Its body is 064's apart from c_placements.
--
-- One transaction, re-runnable: the constraint is dropped and added again,
-- and the function is replaced (its grants stay).

BEGIN;

ALTER TABLE public.announcements
  DROP CONSTRAINT announcements_placements_check,
  ADD CONSTRAINT announcements_placements_check CHECK (
    cardinality(placements) >= 1
    AND placements <@ ARRAY['banner', 'popup', 'launcher', 'login', 'badge', 'toolbar']::TEXT[]
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
  c_placements CONSTANT TEXT[] := ARRAY['banner', 'popup', 'launcher', 'login', 'badge', 'toolbar'];
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

COMMIT;
