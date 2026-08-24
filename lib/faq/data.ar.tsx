import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_AR: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'البداية',
    blurb: 'تثبيت SaleLinx، وتسجيل الدخول، والمتصفحات المدعومة.',
    items: [
      {
        id: 'how-do-i-install',
        q: 'كيف أثبّت إضافة SaleLinx؟',
        a: (
          <>
            <p>
              ثبّتها من{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              وثبّت الإضافة في شريط الأدوات. الشرح الكامل مع لقطات الشاشة في{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                تثبيت إضافة SaleLinx
              </Link>
              .
            </p>
            <InstallExtensionButton
              label="أضف إلى Chrome"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
        ),
        keywords: ['تثبيت', 'إعداد', 'chrome', 'إضافة'],
      },
      {
        id: 'which-browsers',
        q: 'ما المتصفحات التي يدعمها SaleLinx؟',
        a: (
          <p>
            أي متصفح مبني على Chromium: Google Chrome و Microsoft Edge و Brave و
            Arc و Opera. أما Safari و Firefox فغير مدعومين.
          </p>
        ),
        keywords: ['متصفح', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: 'هل يجب أن أدفع لتجربته؟',
        a: (
          <p>
            تحصل على تجربة مجانية لمدة 14 يوماً من خطة Starter، واحدة لكل حساب.
            البطاقة مطلوبة لبدئها، لكن لا يُخصم أي مبلغ خلال فترة التجربة
            ويمكنك الإلغاء في أي وقت من صفحة حسابك. إن لم تُلغِ، يبدأ اشتراك
            Starter تلقائياً عند انتهاء التجربة. اطلع على{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              الأسعار
            </Link>{' '}
            لمعرفة ما تشمله كل خطة.
          </p>
        ),
        keywords: ['مجاني', 'تجربة', 'الأسعار', 'مستوى', 'starter', 'بطاقة'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'الحساب والفوترة',
    blurb: 'الخطط والفواتير وطرق الدفع وعمليات الإلغاء.',
    items: [
      {
        id: 'how-to-upgrade',
        q: 'كيف أرقّي خطتي؟',
        a: (
          <p>
            سجّل الدخول على{' '}
            <Link href="/account" className="underline underline-offset-4">
              salelinx.com/account
            </Link>{' '}
            واختر خطة جديدة. يسري التغيير فوراً وتُحتسب لك التكلفة بالتناسب مع
            بقية فترة الفوترة.
          </p>
        ),
        keywords: ['ترقية', 'خطة', 'تغيير', 'مستوى'],
      },
      {
        id: 'how-to-cancel',
        q: 'كيف ألغي اشتراكي؟',
        a: (
          <p>
            افتح{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>{' '}
            واضغط <em>إدارة الفوترة</em>. ستنتقل إلى بوابة عملاء Stripe حيث
            يمكنك الإلغاء. يبقى وصولك متاحاً حتى نهاية الفترة الحالية.
          </p>
        ),
        keywords: ['إلغاء', 'إلغاء الاشتراك', 'إيقاف الفوترة'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'هل يمكنني تغيير الخطة في منتصف فترة الفوترة؟',
        a: (
          <p>
            نعم. تسري الترقيات فوراً مع احتساب التكلفة بالتناسب. أما التخفيضات
            فتسري في بداية فترة الفوترة التالية حتى لا تفقد ما دفعت مقابله
            بالفعل.
          </p>
        ),
        keywords: ['تناسب', 'تبديل', 'تخفيض الخطة'],
      },
      {
        id: 'where-are-invoices',
        q: 'من أين أحصل على فواتيري؟',
        a: (
          <p>
            من بوابة عملاء Stripe. افتح صفحة حسابك، واضغط{' '}
            <em>إدارة الفوترة</em>، ثم <em>سجل الفواتير</em>.
          </p>
        ),
        keywords: ['فاتورة', 'إيصال', 'ضريبة', 'ضريبة القيمة المضافة'],
      },
      {
        id: 'charged-twice',
        q: 'خُصم مني المبلغ مرتين، ماذا أفعل؟',
        a: (
          <p>
            في الغالب تكون عملية دفع فاشلة أُعيدت المحاولة فيها، لا عملية
            مكررة فعلاً. تحقق أولاً من سجل الفواتير في بوابة العملاء. إذا رأيت
            عمليتي دفع ناجحتين، راسلنا على{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            مع أرقام الفواتير وسنعيد لك المبلغ المكرر.
          </p>
        ),
        keywords: ['مكرر', 'استرداد', 'خصم زائد', 'خصم'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'حل المشكلات',
    blurb: 'حلول لأكثر الأمور شيوعاً التي قد تسير على غير ما يُرام.',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'لوحة SaleLinx لا تظهر على Depop أو Vinted',
        a: (
          <div className="space-y-2">
            <p>جرّب هذه الخطوات بالترتيب:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>حدّث تبويب المنصة.</li>
              <li>
                تأكد من أن الإضافة مثبّتة في شريط الأدوات ومفعّلة (أيقونة قطعة
                الأحجية في شريط أدوات Chrome).
              </li>
              <li>
                تأكد من أنك في صفحة منتج أو ملف شخصي. اللوحة لا تفتح في صفحات
                البحث أو الدفع.
              </li>
              <li>سجّل الخروج ثم الدخول من الإضافة.</li>
            </ol>
          </div>
        ),
        keywords: ['لوحة', 'مفقودة', 'لا تظهر', 'depop', 'vinted'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'فشل نشر أحد الإعلانات',
        a: (
          <p>
            معظم حالات الفشل سببها تسجيل الخروج من المنصة الهدف أو حقل مطلوب لم
            تتم مطابقته بشكل سليم. سجّل الخروج ثم الدخول على المنصة الهدف، ثم
            أعد المحاولة من لوحة التحكم. وإذا كانت منصة كاملة متوقفة، فتحقق من{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              صفحة حالة المنصات
            </Link>
            .
          </p>
        ),
        keywords: ['فشل', 'خطأ', 'نشر', 'نشر متقاطع', 'رفع'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'النشر المتقاطع متوقف عند &ldquo;جارٍ ملء النموذج...&rdquo;',
        a: (
          <p>
            لا تلمس التبويب الهدف أثناء ملء الإضافة له. إذا بقي متوقفاً أكثر من
            دقيقة، اضغط <em>إلغاء</em>
            في اللوحة وأعد المحاولة. وإذا تكرر ذلك على منصة بعينها، فالأرجح أنه
            تغيير في تخطيط النموذج لديهم، انظر{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              حالة المنصات
            </Link>
            .
          </p>
        ),
        keywords: ['متوقف', 'معلّق', 'مجمّد', 'بطيء', 'ملء'],
      },
      {
        id: 'cant-sign-in',
        q: 'تم تسجيل خروجي ولا أستطيع تسجيل الدخول من جديد',
        a: (
          <p>
            أعد تعيين كلمة المرور على{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>
            . إذا سجّلت عبر Google، فلا توجد كلمة مرور لإعادة تعيينها: استخدم زر
            المتابعة باستخدام Google في صفحة تسجيل الدخول بدلاً من ذلك. حسابك
            على الموقع وحسابك في الإضافة هما الحساب نفسه، فأي طريقة تسجّل بها
            الدخول تعمل في الاثنين.
          </p>
        ),
        keywords: [
          'كلمة المرور',
          'تسجيل الدخول',
          'الدخول',
          'إعادة تعيين',
          'تعذّر الدخول',
          'google',
        ],
      },
      {
        id: 'listings-not-syncing',
        q: 'إعلاناتي لا تتزامن مع لوحة التحكم',
        a: (
          <p>
            افتح لوحة التحكم واضغط زر <em>إعادة المزامنة</em> في أعلى الصفحة.
            وإذا كان إعلان معين مفقوداً، فافتحه على المنصة مرة واحدة مع إبقاء
            لوحة SaleLinx مفتوحة، فتضيفه اللوحة فور اكتشافه.
          </p>
        ),
        keywords: ['مزامنة', 'مفقود', 'لوحة التحكم', 'تحديث'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'الخصوصية والبيانات',
    blurb: 'ما نخزّنه، وأين يوجد، وكيف تحذفه.',
    items: [
      {
        id: 'store-marketplace-password',
        q: 'هل يخزّن SaleLinx كلمة مروري على المنصات؟',
        a: (
          <p>
            لا. يستخدم SaleLinx جلسة المتصفح الحالية لديك على كل منصة، فلا توجد
            كلمة مرور تُدخلها أو تُخزَّن أو تتسرب.
          </p>
        ),
        keywords: ['كلمة المرور', 'بيانات الاعتماد', 'الأمان'],
      },
      {
        id: 'where-is-my-data',
        q: 'أين تُخزَّن بياناتي؟',
        a: (
          <p>
            يُخزَّن حسابك في SaleLinx وفهرس إعلاناتك في Supabase (منطقة الاتحاد
            الأوروبي). وقد يعالج بعض مزودي الخدمة لدينا (مثل Stripe للمدفوعات)
            البيانات في المملكة المتحدة أو الاتحاد الأوروبي أو الولايات المتحدة
            مع ضمانات مناسبة، كما هو موضح في{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              سياسة الخصوصية
            </Link>
            . أما بيانات المنصة نفسها فتبقى على المنصة.
          </p>
        ),
        keywords: ['بيانات', 'تخزين', 'supabase', 'منطقة', 'الاتحاد الأوروبي'],
      },
      {
        id: 'delete-my-data',
        q: 'كيف أحذف بياناتي؟',
        a: (
          <p>
            أسرع طريقة هي الحذف الذاتي: افتح{' '}
            <Link href="/account" className="underline underline-offset-4">
              حسابك
            </Link>
            ، ثم انزل إلى منطقة الخطر، وأكّد عبر الرابط المرسل إلى بريدك. يسري
            الحذف فوراً. ويمكنك أيضاً مراسلتنا على{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            من العنوان المسجل في حسابك وسنُتم الحذف خلال 30 يوماً، وعادة قبل ذلك
            بكثير.
          </p>
        ),
        keywords: ['حذف', 'اللائحة العامة لحماية البيانات', 'إزالة', 'حساب', 'محو'],
      },
    ],
  },
];
