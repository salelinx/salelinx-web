-- Roadmap cards can be archived: kept in /admin/roadmap, gone from the site.
--
-- A column rather than a fourth status, so an archived card keeps the column
-- and dates it had, and Restore can put it back as it was. It is independent of
-- `visible` for the same reason: a published card comes back published and a
-- hidden draft comes back hidden.
--
-- The public RLS policy is what makes an archived card look deleted from
-- outside: anon cannot read the row at all, whatever `visible` says. The admin
-- policy is untouched, so the console still sees it.
--
-- No personal data, so no ROPA entry or deletion-runbook step (docs/GDPR.md).
--
-- Apply by hand (supabase db query --linked -f), never db push. Safe either
-- side of the web deploy: until this runs the console's Archive button answers
-- with an error and nothing changes. Re-runnable.

ALTER TABLE public.roadmap_items
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ALTER rather than DROP + CREATE, so the table is never without the policy.
ALTER POLICY "roadmap_items public read"
  ON public.roadmap_items
  USING (visible AND archived_at IS NULL);

-- =============================================================================
-- 1. admin_archive_roadmap_item() - archive or restore one card
-- =============================================================================
-- One function for both, like admin_save_roadmap_item. The audit entry carries
-- the whole old row, as every other roadmap write does. Asking for the state a
-- card is already in succeeds without writing or logging anything.
--
-- A restored card goes to the bottom of its column, since the order there has
-- moved on while it was away.

CREATE OR REPLACE FUNCTION public.admin_archive_roadmap_item(
  p_id TEXT,
  p_archived BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.roadmap_items%ROWTYPE;
  v_sort INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_archived IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_archived');
  END IF;

  SELECT * INTO v_previous FROM public.roadmap_items WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p_archived = (v_previous.archived_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_archived THEN
    UPDATE public.roadmap_items
    SET archived_at = NOW(),
        updated_at = NOW()
    WHERE id = p_id;
  ELSE
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort
    FROM public.roadmap_items
    WHERE status = v_previous.status AND archived_at IS NULL;

    UPDATE public.roadmap_items
    SET archived_at = NULL,
        sort_order = v_sort,
        updated_at = NOW()
    WHERE id = p_id;
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN p_archived THEN 'roadmap.item_archive' ELSE 'roadmap.item_restore' END,
    'roadmap_items',
    p_id,
    jsonb_build_object(
      'old', to_jsonb(v_previous),
      'new', (SELECT to_jsonb(r) FROM public.roadmap_items r WHERE r.id = p_id)
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_roadmap_item(TEXT, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_roadmap_item(TEXT, BOOLEAN)
  TO authenticated;

-- =============================================================================
-- 2. admin_reorder_roadmap_items() - archived cards are not in the column
-- =============================================================================
-- 032's body verbatim except for the archived_at filter. The console only sends
-- the cards on the board, so counting archived rows here would answer
-- stale_order for every column holding one.

CREATE OR REPLACE FUNCTION public.admin_reorder_roadmap_items(
  p_status TEXT,
  p_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('exploring', 'building', 'shipped') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY sort_order, id), '{}')
  INTO v_current
  FROM public.roadmap_items
  WHERE status = p_status AND archived_at IS NULL;

  IF cardinality(COALESCE(p_ids, '{}')) <> cardinality(v_current)
     OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x) <> cardinality(v_current)
     OR NOT (p_ids <@ v_current) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_order');
  END IF;

  UPDATE public.roadmap_items r
  SET sort_order = u.ord
  FROM unnest(p_ids) WITH ORDINALITY AS u(id, ord)
  WHERE r.id = u.id;

  PERFORM public.log_admin_action(
    'roadmap.reorder',
    'roadmap_items',
    p_status,
    jsonb_build_object('old', to_jsonb(v_current), 'new', to_jsonb(p_ids))
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reorder_roadmap_items(TEXT, TEXT[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reorder_roadmap_items(TEXT, TEXT[])
  TO authenticated;
