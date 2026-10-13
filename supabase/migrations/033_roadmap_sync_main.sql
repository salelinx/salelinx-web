-- Brings roadmap_items in line with the roadmap that PR #200 put on main.
--
-- 032 seeded the table from the roadmap as it stood before PR #200 ("Roadmap
-- brought up to date from the changelog and active branches", "Roadmap:
-- headline features only"), which landed the same day while 032 was in
-- review and still kept its cards in lib/roadmap/data.ts + messages/*.json.
-- This replays that content into the table: its eleven cards are upserted
-- (copy in all six locales, order, dates) and the two it dropped
-- (shop-designer, auto-offers) are deleted.
--
-- Only cards nobody has edited in /admin/roadmap are touched. A row the
-- console has saved has updated_at later than created_at (admin_save_roadmap_item
-- sets updated_at = NOW()), and an admin edit is newer information than this
-- file, so it wins. The same guard makes the file safe to re-run.

INSERT INTO public.roadmap_items (
  id, status, sort_order, tag, marketplaces, target_quarter, shipped_month,
  title, description
)
VALUES
  (
    'ebay-integration', 'building', 1, 'marketplaces', '{}'::TEXT[], '2026-Q4', NULL,
    '{"en":"eBay crosslisting","fr":"Crosslisting eBay","es":"Crosslisting con eBay","de":"eBay-Crosslisting","ar":"النشر المتقاطع على eBay","zh":"eBay 跨平台上架"}'::jsonb,
    '{"en":"Link your eBay account, manage your eBay listings in My Listings, and crosslist between eBay, Depop and Vinted in any direction.","fr":"Liez votre compte eBay, gérez vos annonces eBay dans Mes annonces et crosslistez entre eBay, Depop et Vinted dans tous les sens.","es":"Vincula tu cuenta de eBay, gestiona tus anuncios de eBay en Mis anuncios y crosslista entre eBay, Depop y Vinted en cualquier dirección.","de":"Verknüpfe dein eBay-Konto, verwalte deine eBay-Inserate in Meine Inserate und crossliste zwischen eBay, Depop und Vinted in jede Richtung.","ar":"اربط حسابك على eBay، وأدر إعلاناتك على eBay من إعلاناتي، وانشر بشكل متقاطع بين eBay و Depop و Vinted في أي اتجاه.","zh":"关联你的 eBay 账号，在“我的商品”中管理 eBay 商品，并在 eBay、Depop 和 Vinted 之间任意方向跨平台上架。"}'::jsonb
  ),
  (
    'ebay-only-sellers', 'building', 2, 'marketplaces', '{}'::TEXT[], '2026-Q4', NULL,
    '{"en":"SaleLinx for eBay sellers","fr":"SaleLinx pour les vendeurs eBay","es":"SaleLinx para vendedores de eBay","de":"SaleLinx für eBay-Verkäufer","ar":"SaleLinx لبائعي eBay","zh":"面向 eBay 卖家的 SaleLinx"}'::jsonb,
    '{"en":"Open the panel on eBay and use SaleLinx even if you do not sell on Depop or Vinted.","fr":"Ouvrez le panneau sur eBay et utilisez SaleLinx même si vous ne vendez ni sur Depop ni sur Vinted.","es":"Abre el panel en eBay y usa SaleLinx aunque no vendas en Depop ni en Vinted.","de":"Öffne das Panel auf eBay und nutze SaleLinx, auch wenn du nicht auf Depop oder Vinted verkaufst.","ar":"افتح اللوحة على eBay واستخدم SaleLinx حتى لو كنت لا تبيع على Depop أو Vinted.","zh":"在 eBay 上打开面板即可使用 SaleLinx，即使你不在 Depop 或 Vinted 上卖货。"}'::jsonb
  ),
  (
    'poshmark-integration', 'exploring', 1, 'marketplaces', '{}'::TEXT[], NULL, NULL,
    '{"en":"Poshmark integration","fr":"Intégration Poshmark","es":"Integración con Poshmark","de":"Poshmark-Integration","ar":"تكامل مع Poshmark","zh":"Poshmark 集成"}'::jsonb,
    '{"en":"Bring Poshmark into the crosslisting flow alongside Depop and Vinted.","fr":"Ajoutez Poshmark au flux de crosslisting aux côtés de Depop et Vinted.","es":"Incorpora Poshmark al flujo de crosslisting junto a Depop y Vinted.","de":"Hole Poshmark neben Depop und Vinted in den Crosslisting-Ablauf.","ar":"أضف Poshmark إلى مسار النشر المتعدد إلى جانب Depop وVinted.","zh":"将 Poshmark 纳入与 Depop 和 Vinted 并行的跨平台发布流程。"}'::jsonb
  ),
  (
    'scheduled-relisting', 'exploring', 2, 'automation', '{}'::TEXT[], NULL, NULL,
    '{"en":"Scheduled relisting","fr":"Republication planifiée","es":"Republicación programada","de":"Geplantes Reposten","ar":"إعادة نشر مجدولة","zh":"定时重新上架"}'::jsonb,
    '{"en":"Pick listings and a schedule, and Relist runs on its own instead of you starting each batch.","fr":"Choisissez des annonces et un planning, et Republier tourne tout seul, sans que vous ayez à lancer chaque lot.","es":"Elige anuncios y un horario, y Republicar se ejecuta solo, sin que tengas que lanzar cada lote.","de":"Wähle Inserate und einen Zeitplan, und Neu listen läuft von selbst, statt dass du jeden Stapel einzeln startest.","ar":"اختر الإعلانات وجدولاً زمنياً، وستعمل إعادة النشر تلقائياً بدلاً من أن تبدأ كل دفعة بنفسك.","zh":"选好商品和时间表，重新上架会自动运行，不用你每批手动启动。"}'::jsonb
  ),
  (
    'ai-description-polish', 'exploring', 3, 'ai', '{}'::TEXT[], NULL, NULL,
    '{"en":"AI description polish","fr":"Retouche IA des descriptions","es":"Pulido de descripciones con IA","de":"KI-Feinschliff für Beschreibungen","ar":"تحسين الوصف بالذكاء الاصطناعي","zh":"AI 描述润色"}'::jsonb,
    '{"en":"One-click rewrite for titles and descriptions that look hand-written, not templated.","fr":"Réécriture en un clic pour des titres et descriptions qui semblent rédigés à la main, pas générés.","es":"Reescritura en un clic para títulos y descripciones que parecen escritos a mano, no plantilla.","de":"Ein-Klick-Neufassung für Titel und Beschreibungen, die handgeschrieben wirken, nicht aus Vorlagen.","ar":"إعادة صياغة بنقرة واحدة للعناوين والأوصاف لتبدو مكتوبة بخط اليد لا مأخوذة من قالب جاهز.","zh":"一键改写标题和描述，读起来像手写的，而不是套模板的。"}'::jsonb
  ),
  (
    'analytics-dashboard', 'exploring', 4, 'insights', '{}'::TEXT[], NULL, NULL,
    '{"en":"Analytics dashboard","fr":"Tableau de bord analytique","es":"Panel de analíticas","de":"Analytics-Dashboard","ar":"لوحة التحليلات","zh":"数据看板"}'::jsonb,
    '{"en":"Sell-through rate, views per listing, and cross-marketplace sales trends.","fr":"Taux de vente, vues par annonce et tendances de ventes entre marketplaces.","es":"Tasa de venta, vistas por anuncio y tendencias de ventas entre marketplaces.","de":"Verkaufsrate, Ansichten pro Inserat und marktplatzübergreifende Verkaufstrends.","ar":"معدل البيع، ومشاهدات كل إعلان، واتجاهات المبيعات عبر المنصات.","zh":"售出率、每个商品的浏览量，以及跨平台的销售趋势。"}'::jsonb
  ),
  (
    'crosslist-review', 'shipped', 1, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-10',
    '{"en":"Review before you crosslist","fr":"Vérifiez avant de crosslister","es":"Revisa antes de crosslistar","de":"Prüfen vor dem Crosslisten","ar":"راجع قبل النشر المتقاطع","zh":"跨平台上架前先审核"}'::jsonb,
    '{"en":"Check and edit every item before it posts, with a full editor in the other marketplace''s own terms, and paste as many listing links as you like.","fr":"Contrôlez et modifiez chaque article avant sa publication, avec un éditeur complet dans les termes propres à l''autre plateforme, et collez autant de liens d''annonces que vous voulez.","es":"Comprueba y edita cada artículo antes de que se publique, con un editor completo en los términos propios del otro marketplace, y pega tantos enlaces de anuncios como quieras.","de":"Prüfe und bearbeite jeden Artikel, bevor er online geht, mit einem vollständigen Editor in den Begriffen des anderen Marktplatzes, und füge so viele Inserat-Links ein, wie du willst.","ar":"افحص كل منتج وعدّله قبل نشره، بمحرر كامل يستخدم مصطلحات المنصة الأخرى نفسها، والصق ما تشاء من روابط الإعلانات.","zh":"在发布前检查和编辑每件商品，编辑器完整采用目标平台自己的术语，商品链接想粘贴多少就粘贴多少。"}'::jsonb
  ),
  (
    'label-carriers', 'shipped', 2, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-08',
    '{"en":"Bulk shipping labels","fr":"Étiquettes d''expédition groupées","es":"Etiquetas de envío en lote","de":"Versandetiketten im Stapel","ar":"ملصقات الشحن بالجملة","zh":"批量快递面单"}'::jsonb,
    '{"en":"Merge a day of Depop and Vinted labels into one PDF, pick your carrier, and print or email them in one go.","fr":"Fusionnez une journée d''étiquettes Depop et Vinted en un seul PDF, choisissez votre transporteur, puis imprimez-les ou envoyez-les par e-mail d''un coup.","es":"Combina las etiquetas de Depop y Vinted de un día en un solo PDF, elige tu transportista e imprímelas o envíalas por correo de una vez.","de":"Führe die Depop- und Vinted-Etiketten eines Tages in einem PDF zusammen, wähle deinen Versanddienstleister und drucke oder maile sie in einem Rutsch.","ar":"ادمج ملصقات يوم كامل من Depop و Vinted في ملف PDF واحد، واختر شركة الشحن، ثم اطبعها أو أرسلها بالبريد الإلكتروني دفعة واحدة.","zh":"把一天的 Depop 和 Vinted 面单合并成一个 PDF，选择快递公司，一次性打印或发到邮箱。"}'::jsonb
  ),
  (
    'google-sign-in', 'shipped', 3, NULL, '{}'::TEXT[], NULL, '2026-08',
    '{"en":"Refer & Earn","fr":"Parrainez et gagnez","es":"Recomienda y gana","de":"Empfehlen und verdienen","ar":"ادعُ واربح","zh":"邀请得奖励"}'::jsonb,
    '{"en":"Invite other sellers from its own tab and earn credit off your plan when they subscribe. Plus sign-in with Google.","fr":"Invitez d''autres vendeurs depuis un onglet dédié et gagnez du crédit sur votre forfait quand ils s''abonnent. Et en prime, la connexion avec Google.","es":"Invita a otros vendedores desde su propia pestaña y gana crédito en tu plan cuando se suscriban. Además, inicio de sesión con Google.","de":"Lade andere Verkäufer über einen eigenen Tab ein und erhalte Guthaben auf deinen Plan, wenn sie ein Abo abschließen. Dazu die Anmeldung mit Google.","ar":"ادعُ بائعين آخرين من تبويب مخصص واحصل على رصيد يُخصم من خطتك عند اشتراكهم. بالإضافة إلى تسجيل الدخول عبر Google.","zh":"在专属标签页邀请其他卖家，他们订阅后你可获得抵扣方案费用的额度。另外支持 Google 登录。"}'::jsonb
  ),
  (
    'depop-vinted-crosslist', 'shipped', 4, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-04',
    '{"en":"Depop and Vinted crosslisting","fr":"Crosslisting Depop et Vinted","es":"Crosslisting de Depop y Vinted","de":"Depop- und Vinted-Crosslisting","ar":"النشر المتقاطع بين Depop و Vinted","zh":"Depop 和 Vinted 跨平台上架"}'::jsonb,
    '{"en":"Bi-directional crosslisting with auto-mapped categories, sizes, and conditions.","fr":"Crosslisting bidirectionnel avec catégories, tailles et états mappés automatiquement.","es":"Crosslisting bidireccional con categorías, tallas y condiciones mapeadas automáticamente.","de":"Bidirektionales Crosslisting mit automatisch zugeordneten Kategorien, Größen und Zuständen.","ar":"نشر متقاطع في الاتجاهين مع مطابقة تلقائية للفئات والمقاسات والحالات.","zh":"双向跨平台上架，自动匹配分类、尺码和成色。"}'::jsonb
  ),
  (
    'follow-bot', 'shipped', 5, NULL, ARRAY['depop', 'vinted']::TEXT[], NULL, '2026-04',
    '{"en":"Follow and unfollow bot","fr":"Bot de suivi et de désabonnement","es":"Bot de seguir y dejar de seguir","de":"Folgen- und Entfolgen-Bot","ar":"بوت المتابعة وإلغاء المتابعة","zh":"关注与取消关注机器人"}'::jsonb,
    '{"en":"Follow the followers or following of any account, and on Depop its buyers, reviewers or likers, with human-looking pacing.","fr":"Suivez les abonnés ou les abonnements de n''importe quel compte, et sur Depop ses acheteurs, évaluateurs ou likeurs, avec un rythme d''apparence humaine.","es":"Sigue a los seguidores o seguidos de cualquier cuenta, y en Depop a sus compradores, reseñadores o a quienes dieron like, con un ritmo de apariencia humana.","de":"Folge den Followern oder Abonnements eines beliebigen Kontos, auf Depop auch seinen Käufern, Bewertern oder Likern, mit menschlich wirkendem Tempo.","ar":"تابع متابِعي أي حساب أو من يتابعهم، وعلى Depop مشتريه أو أصحاب تقييماته أو المعجبين بإعلاناته، بوتيرة تبدو بشرية.","zh":"关注任意账号的粉丝或其关注的人，在 Depop 上还可以关注其买家、评价者或点赞者，节奏拟人化。"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
  SET status = EXCLUDED.status,
      sort_order = EXCLUDED.sort_order,
      tag = EXCLUDED.tag,
      marketplaces = EXCLUDED.marketplaces,
      target_quarter = EXCLUDED.target_quarter,
      shipped_month = EXCLUDED.shipped_month,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      -- Keep the row counting as unedited, so a re-run still applies.
      updated_at = roadmap_items.created_at
  WHERE roadmap_items.updated_at = roadmap_items.created_at;

DELETE FROM public.roadmap_items
WHERE id IN ('shop-designer', 'auto-offers')
  AND updated_at = created_at;
