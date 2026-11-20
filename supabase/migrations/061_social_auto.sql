-- Social: automatic tags, experiments defined by a rule, and the weekly brief.
-- See docs/SOCIAL.md "Automatic tags", "Rule experiments" and "Brief".
-- Numbered 061 because two open branches already carry a 060.

-- =============================================================================
-- 1. social_set_auto_tags() - tags from scripts/social-tag.mjs and Trend Remix
-- =============================================================================
-- Service role only (local scripts with the CLI's key). Never overwrites tags a
-- person has set: it writes only where there are none yet or the current ones
-- are themselves automatic. Not audited, since no person did it; tags.by says
-- where they came from.

CREATE OR REPLACE FUNCTION public.social_set_auto_tags(
  p_post_id UUID,
  p_platform TEXT,
  p_external_id TEXT,
  p_tags JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_tags IS NULL OR jsonb_typeof(p_tags) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_tags');
  END IF;
  p_tags := p_tags || '{"by": "auto"}'::jsonb;

  IF p_post_id IS NOT NULL THEN
    UPDATE public.social_posts SET tags = p_tags
    WHERE id = p_post_id AND (tags = '{}'::jsonb OR tags->>'by' = 'auto');
  ELSE
    UPDATE public.marketing_videos SET tags = p_tags
    WHERE platform = p_platform AND external_id = p_external_id
      AND (tags = '{}'::jsonb OR tags->>'by' = 'auto');
  END IF;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'written', v_rows > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.social_set_auto_tags(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_set_auto_tags(UUID, TEXT, TEXT, JSONB) TO service_role;

-- =============================================================================
-- 2. Rule experiments
-- =============================================================================
-- dimension set: members are every video posted from starts_at whose value on
-- that Compare dimension (lib/social/compare.ts) is one variant's
-- variants[].value. Worked out on the page; social_experiment_videos stays for
-- hand-picked experiments.

ALTER TABLE public.social_experiments
  ADD COLUMN dimension TEXT CHECK (char_length(dimension) <= 40),
  ADD COLUMN starts_at TIMESTAMPTZ,
  ADD COLUMN target_per_variant INT NOT NULL DEFAULT 8 CHECK (target_per_variant BETWEEN 2 AND 100),
  ADD CONSTRAINT social_experiments_rule CHECK ((dimension IS NULL) = (starts_at IS NULL));

DROP FUNCTION public.admin_save_social_experiment(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_save_social_experiment(
  p_id UUID,
  p_name TEXT,
  p_hypothesis TEXT,
  p_metric TEXT,
  p_variants JSONB,
  p_status TEXT,
  p_winner TEXT,
  p_conclusion TEXT,
  p_dimension TEXT,
  p_starts_at TIMESTAMPTZ,
  p_target_per_variant INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := p_id;
  v_previous JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) NOT BETWEEN 2 AND 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'An experiment needs 2 to 5 variants.');
  END IF;
  IF p_dimension IS NOT NULL AND (
    p_starts_at IS NULL
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_variants) v WHERE COALESCE(v->>'value', '') = '')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a start date and a value for every variant.');
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.social_experiments (
      name, hypothesis, metric, variants, status, winner, conclusion,
      dimension, starts_at, target_per_variant
    )
    VALUES (
      p_name, p_hypothesis, p_metric, p_variants, p_status, p_winner, p_conclusion,
      p_dimension, CASE WHEN p_dimension IS NULL THEN NULL ELSE p_starts_at END,
      COALESCE(p_target_per_variant, 8)
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT to_jsonb(e) INTO v_previous FROM public.social_experiments e WHERE e.id = v_id FOR UPDATE;
    IF v_previous IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    UPDATE public.social_experiments SET
      name = p_name, hypothesis = p_hypothesis, metric = p_metric,
      variants = p_variants, status = p_status, winner = p_winner,
      conclusion = p_conclusion, dimension = p_dimension,
      starts_at = CASE WHEN p_dimension IS NULL THEN NULL ELSE p_starts_at END,
      target_per_variant = COALESCE(p_target_per_variant, 8),
      updated_at = NOW()
    WHERE id = v_id;
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN p_id IS NULL THEN 'social.experiment_create' ELSE 'social.experiment_update' END,
    'social_experiments', v_id::text,
    jsonb_build_object('name', p_name, 'status', p_status, 'winner', p_winner, 'old', v_previous)
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_social_experiment(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_social_experiment(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT) TO authenticated;

-- =============================================================================
-- 3. social_brief - the latest weekly brief, one row
-- =============================================================================
-- Written by the Experiments page whenever an admin opens it (lib/social/brief.ts
-- works it out there); read by the planner for its best times and by Trend
-- Remix's scripts/brief.mjs with the service role.

CREATE TABLE public.social_brief (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brief JSONB NOT NULL CHECK (jsonb_typeof(brief) = 'object' AND pg_column_size(brief) <= 20000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.social_brief ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_brief FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.social_brief TO authenticated;
CREATE POLICY "Admins can read the social brief"
  ON public.social_brief FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_save_social_brief(p_brief JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.social_brief (id, brief, updated_at) VALUES (1, p_brief, NOW())
  ON CONFLICT (id) DO UPDATE SET brief = EXCLUDED.brief, updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_social_brief(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_social_brief(JSONB) TO authenticated;
