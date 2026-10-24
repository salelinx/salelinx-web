-- Roadmap cards can carry an eBay chip.
--
-- 032 limited roadmap_items.marketplaces to depop and vinted, in two places:
-- the column CHECK and admin_save_roadmap_item's own validation. eBay is now a
-- marketplace (040_ebay.sql), so the eBay cards and anything that ships on all
-- three need the chip. lib/roadmap/types.ts ROADMAP_MARKETPLACES gains 'ebay'
-- in the same change; the public card already labels it (lib/docs/status.ts).
--
-- Widening a CHECK only allows more values, so every existing row stays valid.
-- One statement, so the table is never without the constraint. The function
-- is 032's body verbatim except for the allowed list.
--
-- Apply by hand (supabase db query --linked -f), never db push. Until it runs,
-- saving an eBay-tagged card answers invalid_marketplaces and nothing changes.

ALTER TABLE public.roadmap_items
  DROP CONSTRAINT roadmap_items_marketplaces_check,
  ADD CONSTRAINT roadmap_items_marketplaces_check
  CHECK (marketplaces <@ ARRAY['depop', 'vinted', 'ebay']::TEXT[]);

CREATE OR REPLACE FUNCTION public.admin_save_roadmap_item(
  p_id TEXT,
  p_is_new BOOLEAN,
  p_status TEXT,
  p_tag TEXT,
  p_marketplaces TEXT[],
  p_title JSONB,
  p_description JSONB,
  p_target_quarter TEXT,
  p_shipped_month TEXT,
  p_visible BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_locales CONSTANT TEXT[] := ARRAY['en', 'fr', 'es', 'de', 'ar', 'zh'];
  v_previous public.roadmap_items%ROWTYPE;
  v_exists BOOLEAN;
  v_title JSONB;
  v_description JSONB;
  v_tag TEXT := NULLIF(btrim(p_tag), '');
  v_marketplaces TEXT[];
  v_target TEXT := NULLIF(btrim(p_target_quarter), '');
  v_shipped TEXT := NULLIF(btrim(p_shipped_month), '');
  v_sort INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_id IS NULL OR p_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_id) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_id');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('exploring', 'building', 'shipped') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  IF v_tag IS NOT NULL
     AND v_tag NOT IN ('inventory', 'automation', 'ai', 'insights', 'marketplaces') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_tag');
  END IF;

  -- De-duplicated, in a fixed order, so the stored array does not depend on
  -- the order checkboxes were ticked in.
  SELECT COALESCE(array_agg(m ORDER BY m), '{}')
  INTO v_marketplaces
  FROM (SELECT DISTINCT unnest(COALESCE(p_marketplaces, '{}')) AS m) s;
  IF NOT v_marketplaces <@ ARRAY['depop', 'vinted', 'ebay']::TEXT[] THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_marketplaces');
  END IF;

  IF v_target IS NOT NULL AND v_target !~ '^[0-9]{4}-Q[1-4]$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_quarter');
  END IF;
  IF v_shipped IS NOT NULL AND v_shipped !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_shipped_month');
  END IF;

  IF p_title IS NULL OR jsonb_typeof(p_title) <> 'object'
     OR p_description IS NULL OR jsonb_typeof(p_description) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_copy');
  END IF;

  SELECT COALESCE(jsonb_object_agg(e.key, btrim(e.value)), '{}'::jsonb)
  INTO v_title
  FROM jsonb_each_text(p_title) e
  WHERE e.key = ANY (c_locales) AND btrim(e.value) <> '';

  SELECT COALESCE(jsonb_object_agg(e.key, btrim(e.value)), '{}'::jsonb)
  INTO v_description
  FROM jsonb_each_text(p_description) e
  WHERE e.key = ANY (c_locales) AND btrim(e.value) <> '';

  IF NOT v_title ? 'en' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_required');
  END IF;
  IF NOT v_description ? 'en' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'description_required');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(v_title) e WHERE length(e.value) > 120) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_too_long');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(v_description) e WHERE length(e.value) > 400) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'description_too_long');
  END IF;

  SELECT * INTO v_previous FROM public.roadmap_items WHERE id = p_id FOR UPDATE;
  v_exists := FOUND;

  IF p_is_new AND v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id_taken');
  END IF;
  IF NOT p_is_new AND NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_exists AND v_previous.status = p_status THEN
    v_sort := v_previous.sort_order;
  ELSE
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort
    FROM public.roadmap_items WHERE status = p_status;
  END IF;

  IF v_exists THEN
    UPDATE public.roadmap_items
    SET status = p_status,
        sort_order = v_sort,
        tag = v_tag,
        marketplaces = v_marketplaces,
        title = v_title,
        description = v_description,
        target_quarter = v_target,
        shipped_month = v_shipped,
        visible = COALESCE(p_visible, TRUE),
        updated_at = NOW()
    WHERE id = p_id;
  ELSE
    INSERT INTO public.roadmap_items (
      id, status, sort_order, tag, marketplaces, title, description,
      target_quarter, shipped_month, visible
    )
    VALUES (
      p_id, p_status, v_sort, v_tag, v_marketplaces, v_title, v_description,
      v_target, v_shipped, COALESCE(p_visible, TRUE)
    );
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN v_exists THEN 'roadmap.item_update' ELSE 'roadmap.item_create' END,
    'roadmap_items',
    p_id,
    jsonb_build_object(
      -- Whole old row, so any edit can be undone by reading the log.
      'old', CASE WHEN v_exists THEN to_jsonb(v_previous) ELSE NULL END,
      'new', (SELECT to_jsonb(r) FROM public.roadmap_items r WHERE r.id = p_id)
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_roadmap_item(
  TEXT, BOOLEAN, TEXT, TEXT, TEXT[], JSONB, JSONB, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_roadmap_item(
  TEXT, BOOLEAN, TEXT, TEXT, TEXT[], JSONB, JSONB, TEXT, TEXT, BOOLEAN
) TO authenticated;

