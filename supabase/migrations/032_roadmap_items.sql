-- Public roadmap, editable from the admin console (/admin/roadmap).
--
-- The roadmap on the homepage used to be a code constant (lib/roadmap/data.ts)
-- with its copy in messages/*.json, so moving one card between columns meant a
-- deploy. This table is now the only source: one row per card, its title and
-- description stored per locale.
--
-- Copy is JSONB keyed by locale ('en', 'fr', 'es', 'de', 'ar', 'zh', matching
-- i18n/routing.ts). English is required; any other locale may be absent, and
-- the site falls back to English for it. The console is English-only, so a
-- translation is an optional extra rather than a precondition for publishing.
--
-- The footer label of a card ("Target Q4 2026", "Shipped Apr 2026") is NOT
-- stored as text. It is built at render time from status plus target_quarter /
-- shipped_month, so it comes out translated in every locale without anyone
-- typing it six times.
--
-- No personal data: there is deliberately no updated_by column. Who changed a
-- card is in admin_audit_log, which every write below goes through, so this
-- table needs no ROPA entry and no deletion-runbook step (docs/GDPR.md).

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  -- Stable slug. Never shown; used as the React key and in audit entries.
  id TEXT PRIMARY KEY CHECK (
    id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(id) <= 60
  ),
  status TEXT NOT NULL CHECK (status IN ('exploring', 'building', 'shipped')),
  -- Position within its status column, ascending. Gaps are fine; ties break
  -- on id.
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Optional category chip. Labels are translated in messages/*.json under
  -- Roadmap.tag, so the set is closed here to match.
  tag TEXT CHECK (
    tag IS NULL
    OR tag IN ('inventory', 'automation', 'ai', 'insights', 'marketplaces')
  ),
  -- Marketplace chips. Same closed set as the Marketplace type in
  -- lib/docs/types.ts.
  marketplaces TEXT[] NOT NULL DEFAULT '{}' CHECK (
    marketplaces <@ ARRAY['depop', 'vinted']::TEXT[]
  ),
  -- { "en": "...", "fr": "...", ... }. Known locale keys only, English
  -- required. Per-value length caps are enforced by admin_save_roadmap_item();
  -- the total-size cap here is a backstop for direct SQL edits.
  title JSONB NOT NULL CHECK (
    jsonb_typeof(title) = 'object'
    AND (title - ARRAY['en', 'fr', 'es', 'de', 'ar', 'zh']) = '{}'::jsonb
    AND length(btrim(COALESCE(title->>'en', ''))) > 0
    AND length(title::text) <= 2000
  ),
  description JSONB NOT NULL CHECK (
    jsonb_typeof(description) = 'object'
    AND (description - ARRAY['en', 'fr', 'es', 'de', 'ar', 'zh']) = '{}'::jsonb
    AND length(btrim(COALESCE(description->>'en', ''))) > 0
    AND length(description::text) <= 6000
  ),
  -- 'YYYY-QN'. Shown as "Target QN YYYY" on cards that are not shipped.
  target_quarter TEXT CHECK (
    target_quarter IS NULL OR target_quarter ~ '^[0-9]{4}-Q[1-4]$'
  ),
  -- 'YYYY-MM'. Shown as "Shipped <month> YYYY" on shipped cards.
  shipped_month TEXT CHECK (
    shipped_month IS NULL
    OR shipped_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ),
  -- Hidden cards are drafts: visible in the console, not on the site. Lets an
  -- admin fill in translations before a card goes public.
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

-- Read-only for clients. Writes go through the SECURITY DEFINER functions
-- below, which re-check is_admin() and write the audit entry, so there are no
-- INSERT / UPDATE / DELETE grants or policies at all.
REVOKE ALL ON TABLE public.roadmap_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.roadmap_items TO anon, authenticated;

-- The homepage reads with the anon key (cached, cookie-less), so it sees only
-- published cards. Dropped first so the whole file is safe to re-run.
DROP POLICY IF EXISTS "roadmap_items public read" ON public.roadmap_items;
DROP POLICY IF EXISTS "roadmap_items admin read" ON public.roadmap_items;

CREATE POLICY "roadmap_items public read"
  ON public.roadmap_items FOR SELECT
  TO anon, authenticated
  USING (visible);

-- The console also needs the hidden drafts. Through is_admin(), so it inherits
-- the AAL2 requirement like every other admin surface.
CREATE POLICY "roadmap_items admin read"
  ON public.roadmap_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- 1. admin_save_roadmap_item() - create or edit one card
-- =============================================================================
-- One function for both so the validation exists once. p_is_new says which:
-- creating an id that exists returns id_taken rather than overwriting it, and
-- editing one that does not returns not_found rather than creating it.
--
-- Copy is normalised on the way in: unknown locale keys dropped, values
-- trimmed, blank values removed (blank means "fall back to English").
--
-- A card that changes column goes to the bottom of its new one.

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
  IF NOT v_marketplaces <@ ARRAY['depop', 'vinted']::TEXT[] THEN
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

-- =============================================================================
-- 2. admin_delete_roadmap_item() - remove one card
-- =============================================================================
-- The audit entry carries the whole row, so a delete is reversible from the
-- log. Hiding a card (visible = false) is the softer alternative and is what
-- the console suggests first.

CREATE OR REPLACE FUNCTION public.admin_delete_roadmap_item(p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.roadmap_items%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_previous FROM public.roadmap_items WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  DELETE FROM public.roadmap_items WHERE id = p_id;

  PERFORM public.log_admin_action(
    'roadmap.item_delete',
    'roadmap_items',
    p_id,
    jsonb_build_object('old', to_jsonb(v_previous))
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_roadmap_item(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_roadmap_item(TEXT) TO authenticated;

-- =============================================================================
-- 3. admin_reorder_roadmap_items() - set the order of one column
-- =============================================================================
-- Takes the column's complete id list in the new order rather than a single
-- "move up" step, so the result never depends on what sort_order values
-- happened to be stored. The list must be exactly the column's current
-- membership: a card added, removed or moved by someone else since the page
-- loaded returns stale_order instead of silently dropping it from the order.

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
  WHERE status = p_status;

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

-- =============================================================================
-- 4. Seed: the roadmap as it stood in lib/roadmap/data.ts + messages/*.json
-- =============================================================================
-- With one change: eBay integration moves from Exploring to Building.
-- ON CONFLICT DO NOTHING so re-running this file never overwrites edits made
-- in the console since.

INSERT INTO public.roadmap_items (
  id, status, sort_order, tag, marketplaces, target_quarter, shipped_month,
  title, description
)
VALUES
  (
    'poshmark-integration', 'exploring', 1, 'marketplaces', '{}'::TEXT[], NULL, NULL,
    '{"en":"Poshmark integration","fr":"Intégration Poshmark","es":"Integración con Poshmark","de":"Poshmark-Integration","ar":"تكامل مع Poshmark","zh":"Poshmark 集成"}'::jsonb,
    '{"en":"Bring Poshmark into the crosslisting flow alongside Depop and Vinted.","fr":"Ajoutez Poshmark au flux de crosslisting aux côtés de Depop et Vinted.","es":"Incorpora Poshmark al flujo de crosslisting junto a Depop y Vinted.","de":"Hole Poshmark neben Depop und Vinted in den Crosslisting-Ablauf.","ar":"أضف Poshmark إلى مسار النشر المتعدد إلى جانب Depop وVinted.","zh":"将 Poshmark 纳入与 Depop 和 Vinted 并行的跨平台发布流程。"}'::jsonb
  ),
  (
    'scheduled-relisting', 'exploring', 2, 'automation', '{}'::TEXT[], NULL, NULL,
    '{"en":"Scheduled relisting","fr":"Republication planifiée","es":"Republicación programada","de":"Geplantes Reposten","ar":"إعادة نشر مجدولة","zh":"定时重新上架"}'::jsonb,
    '{"en":"Queue relists to run on a schedule you set, not manually.","fr":"Mettez les republications en file d''attente selon un planning, pas manuellement.","es":"Pon en cola republicaciones según un horario, no manualmente.","de":"Reposts nach einem Zeitplan in die Warteschlange stellen, nicht manuell.","ar":"ضع عمليات إعادة النشر في طابور لتعمل وفق جدول تحدده، بدلاً من تشغيلها يدوياً.","zh":"把重新上架排进你设定的时间表，不用手动操作。"}'::jsonb
  ),
  (
    'ai-description-polish', 'exploring', 3, 'ai', '{}'::TEXT[], NULL, NULL,
    '{"en":"AI description polish","fr":"Retouche IA des descriptions","es":"Pulido de descripciones con IA","de":"KI-Feinschliff für Beschreibungen","ar":"تحسين الوصف بالذكاء الاصطناعي","zh":"AI 描述润色"}'::jsonb,
    '{"en":"One-click rewrite for titles and descriptions that look hand-written, not templated.","fr":"Réécriture en un clic pour des titres et descriptions qui semblent rédigés à la main, pas générés.","es":"Reescritura en un clic para títulos y descripciones que parecen escritos a mano, no plantilla.","de":"Ein-Klick-Neufassung für Titel und Beschreibungen, die handgeschrieben wirken, nicht aus Vorlagen.","ar":"إعادة صياغة بنقرة واحدة للعناوين والأوصاف لتبدو مكتوبة بخط اليد لا مأخوذة من قالب جاهز.","zh":"一键改写标题和描述，读起来像手写的，而不是套模板的。"}'::jsonb
  ),
  (
    'analytics-dashboard', 'building', 1, 'insights', '{}'::TEXT[], '2026-Q4', NULL,
    '{"en":"Analytics dashboard","fr":"Tableau de bord analytique","es":"Panel de analíticas","de":"Analytics-Dashboard","ar":"لوحة التحليلات","zh":"数据看板"}'::jsonb,
    '{"en":"Sell-through rate, views per listing, and cross-marketplace sales trends.","fr":"Taux de vente, vues par annonce et tendances de ventes entre marketplaces.","es":"Tasa de venta, vistas por anuncio y tendencias de ventas entre marketplaces.","de":"Verkaufsrate, Ansichten pro Inserat und marktplatzübergreifende Verkaufstrends.","ar":"معدل البيع، ومشاهدات كل إعلان، واتجاهات المبيعات عبر المنصات.","zh":"售出率、每个商品的浏览量，以及跨平台的销售趋势。"}'::jsonb
  ),
  (
    'ebay-integration', 'building', 2, 'marketplaces', '{}'::TEXT[], NULL, NULL,
    '{"en":"eBay integration","fr":"Intégration eBay","es":"Integración con eBay","de":"eBay-Integration","ar":"تكامل مع eBay","zh":"eBay 集成"}'::jsonb,
    '{"en":"Crosslist to eBay with auto-mapped categories, item specifics, and conditions.","fr":"Publiez sur eBay avec des catégories, caractéristiques et états mappés automatiquement.","es":"Publica en eBay con categorías, características y estados mapeados automáticamente.","de":"Crossliste auf eBay mit automatisch zugeordneten Kategorien, Artikelmerkmalen und Zuständen.","ar":"انشر إعلاناتك على eBay مع مطابقة تلقائية للفئات والمواصفات والحالات.","zh":"跨平台发布到 eBay，自动映射类目、商品属性和成色。"}'::jsonb
  ),
  (
    'depop-vinted-crosslist', 'shipped', 1, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-04',
    '{"en":"Depop and Vinted crosslisting","fr":"Crosslisting Depop et Vinted","es":"Crosslisting de Depop y Vinted","de":"Depop- und Vinted-Crosslisting","ar":"النشر المتقاطع بين Depop و Vinted","zh":"Depop 和 Vinted 跨平台上架"}'::jsonb,
    '{"en":"Bi-directional crosslisting with auto-mapped categories, sizes, and conditions.","fr":"Crosslisting bidirectionnel avec catégories, tailles et états mappés automatiquement.","es":"Crosslisting bidireccional con categorías, tallas y condiciones mapeadas automáticamente.","de":"Bidirektionales Crosslisting mit automatisch zugeordneten Kategorien, Größen und Zuständen.","ar":"نشر متقاطع في الاتجاهين مع مطابقة تلقائية للفئات والمقاسات والحالات.","zh":"双向跨平台上架，自动匹配分类、尺码和成色。"}'::jsonb
  ),
  (
    'shop-designer', 'shipped', 2, NULL, ARRAY['depop']::TEXT[], NULL, '2026-04',
    '{"en":"Depop Shop Designer","fr":"Depop Shop Designer","es":"Depop Shop Designer","de":"Depop Shop Designer","ar":"مصمم متجر Depop","zh":"Depop 店铺设计器"}'::jsonb,
    '{"en":"Drag-and-drop layout tool for the Depop shop profile.","fr":"Outil de mise en page glisser-déposer pour le profil de la boutique Depop.","es":"Herramienta de diseño por arrastrar y soltar para el perfil de la tienda Depop.","de":"Drag-and-Drop-Layout-Tool für das Depop-Shop-Profil.","ar":"أداة تخطيط بالسحب والإفلات لملف متجر Depop.","zh":"Depop 店铺主页的拖放布局工具。"}'::jsonb
  ),
  (
    'auto-offers', 'shipped', 3, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-04',
    '{"en":"Auto-accept offers","fr":"Acceptation automatique des offres","es":"Aceptación automática de ofertas","de":"Automatische Angebotsannahme","ar":"القبول التلقائي للعروض","zh":"自动接受报价"}'::jsonb,
    '{"en":"Accept incoming offers above a percentage of your asking price automatically, on both marketplaces.","fr":"Acceptez automatiquement les offres au-dessus d''un pourcentage de votre prix, sur les deux marketplaces.","es":"Acepta automáticamente las ofertas por encima de un porcentaje de tu precio, en ambas marketplaces.","de":"Nimm eingehende Angebote über einem Prozentsatz deines Preises automatisch an, auf beiden Marktplätzen.","ar":"اقبل تلقائياً العروض الواردة التي تتجاوز نسبة من سعرك، على المنصتين.","zh":"在两个平台上自动接受高于标价一定比例的报价。"}'::jsonb
  ),
  (
    'follow-bot', 'shipped', 4, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-04',
    '{"en":"Follow and unfollow bot","fr":"Bot de suivi et de désabonnement","es":"Bot de seguir y dejar de seguir","de":"Folgen- und Entfolgen-Bot","ar":"بوت المتابعة وإلغاء المتابعة","zh":"关注与取消关注机器人"}'::jsonb,
    '{"en":"Target followers, following, buyers, review-givers, or likers with human-looking pacing.","fr":"Ciblez abonnés, abonnements, acheteurs, évaluateurs ou likeurs avec un rythme d''apparence humaine.","es":"Apunta a seguidores, seguidos, compradores, reseñadores o quienes han dado like con un ritmo de apariencia humana.","de":"Ziele auf Follower, Abonnements, Käufer, Bewerter oder Likende mit menschlich wirkendem Tempo.","ar":"استهدف المتابِعين أو المتابَعين أو المشترين أو أصحاب التقييمات أو المعجبين بوتيرة تبدو بشرية.","zh":"以粉丝、关注的人、买家、评价者或点赞者为目标，节奏拟人化。"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
