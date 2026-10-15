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
            لا. تحصل على تجربة مجانية لمدة 14 يوماً من خطة Starter، بالميزات
            نفسها لكن بحصص استخدام أقل (اطلع على{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              الأسعار
            </Link>
            ). البطاقة مطلوبة لبدئها، لكن لا يُخصم أي مبلغ خلال فترة التجربة
            ويمكنك الإلغاء في أي وقت من صفحة حسابك. هناك تجربة واحدة لكل حساب
            SaleLinx ولكل متجر على Depop أو Vinted. إن لم تُلغِ، يبدأ اشتراك
            Starter تلقائياً عند انتهاء التجربة.
          </p>
        ),
        keywords: ['مجاني', 'تجربة', 'الأسعار', 'مستوى', 'starter', 'بطاقة'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'الحساب والفوترة',
    blurb: 'الخطط والفواتير وعمليات الإلغاء ومكافآت الإحالة.',
    items: [
      {
        id: 'how-to-upgrade',
        q: 'كيف أرقّي خطتي؟',
        a: (
          <p>
            إن كانت لديك خطة مدفوعة، افتح{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>{' '}
            واضغط <strong>إدارة الاشتراك</strong>، ثم اختر الخطة الجديدة في
            بوابة الفوترة لدى Stripe. أما خلال التجربة المجانية، فاختر خطة من{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              صفحة الأسعار
            </Link>{' '}
            أو اضغط <strong>ابدأ خطة Starter الآن</strong> في صفحة حسابك. هذا
            يُنهي التجربة ويخصم من بطاقتك فوراً، وتسري الحصص الجديدة مباشرة.
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
            واضغط <strong>إدارة الاشتراك</strong>. تُفتح بوابة الفوترة لدى
            Stripe حيث يمكنك الإلغاء. يبقى وصولك متاحاً حتى نهاية الفترة التي
            دفعت مقابلها، ويمكنك التراجع عن الإلغاء من المكان نفسه قبل ذلك.
            وإذا ألغيت خلال التجربة المجانية فلن يُخصم منك شيء.
          </p>
        ),
        keywords: ['إلغاء', 'إلغاء الاشتراك', 'إيقاف الفوترة'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'هل يمكنني تغيير الخطة في منتصف فترة الفوترة؟',
        a: (
          <p>
            نعم. خلال التجربة المجانية، يؤدي اختيار خطة من{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              صفحة الأسعار
            </Link>{' '}
            إلى إنهاء التجربة مبكراً: يُخصم ثمن تلك الخطة من بطاقتك فوراً
            وتسري حصصها مباشرة. أما مع خطة مدفوعة، فكل تغيير يتم في بوابة
            الفوترة لدى Stripe: اضغط <strong>إدارة الاشتراك</strong> في{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>{' '}
            واختر الخطة. والانتقال إلى خطة أدنى يتم دائماً عبر{' '}
            <strong>إدارة الاشتراك</strong>.
          </p>
        ),
        keywords: ['تناسب', 'تبديل', 'تخفيض الخطة', 'تجربة'],
      },
      {
        id: 'where-are-invoices',
        q: 'من أين أحصل على فواتيري؟',
        a: (
          <p>
            افتح{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>{' '}
            واضغط <strong>إدارة الاشتراك</strong>. تُفتح بوابة الفوترة لدى
            Stripe على سجل فواتيرك، ويمكنك تنزيل كل فاتورة منها.
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
            مكررة فعلاً. تحقق أولاً من فواتيرك: زر{' '}
            <strong>إدارة الاشتراك</strong> في صفحة حسابك يفتحها في بوابة
            الفوترة لدى Stripe. إذا رأيت عمليتي دفع ناجحتين، راسلنا على{' '}
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
      {
        id: 'refer-and-earn',
        q: 'كيف يعمل برنامج الإحالة Refer & Earn؟',
        a: (
          <p>
            انسخ رابطك من تبويب <strong>Refer &amp; Earn</strong> في لوحة
            SaleLinx، أو من قسم <strong>أحِل صديقاً</strong> في{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>
            . يحصل الأصدقاء الذين يسجّلون عبره على خصم على شهرهم الأول. وبعد أن
            يدفع صديقك، تكسب وقتاً مجانياً على خطتك: أسبوعاً واحداً إن اختار
            Starter، وأسبوعين مع Pro، وشهراً كاملاً مع Business. يصلك ذلك
            رصيداً على فاتورتك التالية من SaleLinx بعد نحو أسبوع من أول دفعة
            له، بشرط أن تكون لديك خطة خاصة بك. القواعد الكاملة في{' '}
            <Link
              href="/legal/referral-terms"
              className="underline underline-offset-4"
            >
              شروط برنامج الإحالة
            </Link>
            .
          </p>
        ),
        keywords: ['إحالة', 'دعوة', 'صديق', 'مكافأة', 'رصيد', 'خصم', 'refer'],
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
            <p>
              تُفتح اللوحة من زر SaleLinx في الزاوية السفلية اليمنى من كل صفحة
              على Depop و Vinted: اضغط عليه، أو اضغط Alt+S (الاختصار
              الافتراضي) في تبويب Depop أو Vinted. أما أيقونة SaleLinx في شريط
              أدوات Chrome فتفتح نافذة صغيرة لتسجيل الدخول فقط. إن لم ترَ الزر:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                حدّث تبويب Depop أو Vinted. التبويبات التي كانت مفتوحة عند
                تثبيت SaleLinx أو تحديثه تحتاج إلى تحديث.
              </li>
              <li>
                تأكد من أن SaleLinx مفعّلة: افتح chrome://extensions وتحقق من
                مفتاح تشغيلها.
              </li>
              <li>
                ما زالت لا تظهر؟{' '}
                <Link
                  href="/help/support"
                  className="underline underline-offset-4"
                >
                  تواصل مع الدعم
                </Link>
                .
              </li>
            </ol>
          </div>
        ),
        keywords: ['لوحة', 'مفقودة', 'لا تظهر', 'زر', 'depop', 'vinted'],
      },
      {
        id: 'update-available',
        q: 'يقول SaleLinx إن هناك تحديثاً متاحاً أو إنني متأخر بعدة إصدارات',
        a: (
          <p>
            يحدّث Chrome إضافة SaleLinx تلقائياً. عندما يكتمل تنزيل إصدار جديد،
            تعرض اللوحة شريطاً يُعلمك بذلك: اضغط{' '}
            <strong>Reload to update</strong> فتُحدَّث الصفحة على الإصدار
            الجديد. وإذا قالت اللوحة إنك متأخر بإصدار أو أكثر، فهذا يعني أن
            Chrome لم يجلب التحديث بعد. اضغط{' '}
            <strong>Open extensions page</strong> (أو افتح
            chrome://extensions)، وفعّل <strong>وضع المطوّر</strong> (Developer
            mode) في أعلى الصفحة، ثم اضغط <strong>تحديث</strong> (Update)،
            وبعدها حدّث تبويبات Depop و Vinted.
          </p>
        ),
        keywords: ['تحديث', 'إصدار', 'متأخر', 'قديم', 'إعادة تحميل'],
      },
      {
        id: 'in-use-another-device',
        q: 'يقول SaleLinx إنه قيد الاستخدام على جهاز آخر',
        a: (
          <p>
            يمكنك تسجيل الدخول على عدة أجهزة، لكن جهازاً واحداً فقط يمكنه
            استخدام SaleLinx في الوقت نفسه. إذا عرضت اللوحة{' '}
            <strong>In use on another device</strong>، فاضغط{' '}
            <strong>Use here instead</strong> لتتابع على هذا الجهاز، وسيُسجَّل
            خروج الجهاز الآخر من SaleLinx. وإذا كنت قد أغلقت للتو تبويبات Depop
            و Vinted على الجهاز الآخر، فسيتحرر المكان تلقائياً خلال نحو 10
            دقائق. وإن لم تتعرّف على الجهاز الآخر، فاستعد الاستخدام ثم غيّر
            كلمة المرور من{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>
            .
          </p>
        ),
        keywords: ['جهاز', 'جهاز آخر', 'حاسوب', 'مشاركة', 'use here'],
      },
      {
        id: 'salelinx-temporarily-down',
        q: 'يقول SaleLinx إنه متوقف مؤقتاً',
        a: (
          <p>
            لا تستطيع اللوحة الوصول إلى خوادمنا في الوقت الحالي. لا يتأثر Depop
            ولا Vinted، فيمكنك مواصلة استخدام الموقعين كالمعتاد، وتبقى إعلاناتك
            عليهما كما هي. تختفي الرسالة من تلقاء نفسها فور عودة SaleLinx،
            فلا حاجة إلى إعادة التثبيت أو تسجيل الخروج أو إعادة تعيين كلمة
            المرور، حتى لو ظهرت الرسالة نفسها في شاشة تسجيل الدخول. ابتداءً من
            الإصدار 1.1.12 تغطي الرسالة اللوحة كلها ومعها زر{' '}
            <strong>Close SaleLinx</strong>، أما الإصدارات السابقة فتعرضها
            شريطاً في أعلى اللوحة.
          </p>
        ),
        keywords: ['متوقف', 'عطل', 'غير متاح', 'لا يعمل', 'غير متصل'],
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
            . إذا سجّلت عبر Google، فلا توجد كلمة مرور لإعادة تعيينها: استخدم زر{' '}
            <strong>المتابعة باستخدام Google</strong> في صفحة تسجيل الدخول بدلاً
            من ذلك. حسابك على الموقع وحسابك في الإضافة هما الحساب نفسه، فأي
            طريقة تسجّل بها الدخول تعمل في الاثنين.
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
        id: 'open-a-marketplace-tab',
        q: 'يطلب مني SaleLinx فتح تبويب Depop أو Vinted',
        a: (
          <p>
            يعمل SaleLinx عبر جلساتك المسجّلة على Depop و Vinted، لذا تحتاج كل
            ميزة إلى تبويب مفتوح للمنصة الخاصة بها في أي مكان داخل Chrome. أي
            نافذة تفي بالغرض، ولا يلزم أن يكون التبويب الذي تنظر إليه. اضغط{' '}
            <strong>Open Depop</strong> أو <strong>Open Vinted</strong> في
            الرسالة، أو افتح الموقع بنفسك، علماً بأن النشر المتقاطع يحتاج إلى
            الاثنين. وإذا كان التبويب مفتوحاً لكن SaleLinx يطلب إعادة تحميله
            (مثلاً بعد أن أوقفه Chrome مؤقتاً لتوفير الذاكرة)، فاضغط{' '}
            <strong>Reload Depop tab</strong> أو{' '}
            <strong>Reload Vinted tab</strong>. ابتداءً من الإصدار 1.1.12،
            يعرض تبويب <strong>My Listings</strong> أيضاً فتح التبويب الناقص عند
            التحديث، أما الإصدارات السابقة فكانت تطلب إعادة تحميل التبويب حتى
            لو لم يكن أي تبويب مفتوحاً.
          </p>
        ),
        keywords: ['تبويب', 'فتح', 'إعادة تحميل', 'depop', 'vinted'],
      },
      {
        id: 'wrong-marketplace-account',
        q: 'يقول SaleLinx إنني مسجّل الدخول على Depop أو Vinted بحساب مختلف',
        a: (
          <p>
            يعمل SaleLinx فقط مع حسابات Depop و Vinted المرتبطة به، ويوقف ميزات
            تلك المنصة مؤقتاً ما دام الموقع مسجّلاً بحساب آخر. للحل، سجّل
            الخروج من Depop أو Vinted، ثم سجّل الدخول بالحساب المرتبط وأعد
            تحميل التبويب. وإن أردت أن يستخدم SaleLinx الحساب الآخر بدلاً من
            ذلك، فافتح <strong>Settings</strong> في اللوحة، واضغط{' '}
            <strong>Unlink</strong> ضمن <strong>Marketplace accounts</strong>،
            ثم اضغط <strong>Link</strong> للحساب الذي سجّلت الدخول به. التفاصيل
            في{' '}
            <Link
              href="/docs/getting-started/connect-your-first-marketplace"
              className="underline underline-offset-4"
            >
              ربط أول منصة لك
            </Link>
            .
          </p>
        ),
        keywords: ['حساب مختلف', 'حساب خاطئ', 'إعادة الربط', 'فك الربط'],
      },
      {
        id: 'account-already-linked',
        q: 'يقول SaleLinx إن حسابي على Depop أو Vinted مرتبط بالفعل أو استخدم تجربة مجانية',
        a: (
          <p>
            لا يمكن ربط حساب Depop أو Vinted إلا بحساب SaleLinx واحد في كل مرة.
            إن كان مرتبطاً بحساب SaleLinx آخر لك، فسجّل الدخول إليه واضغط{' '}
            <strong>Unlink</strong> في <strong>Settings</strong>، ثم عُد إلى
            هذا الحساب واربطه. ولكل متجر أيضاً تجربة مجانية واحدة فقط: إن كان
            قد استخدمها على حساب SaleLinx آخر، فيمكنك ربطه هنا بعد بدء خطة
            مدفوعة من{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              صفحة الأسعار
            </Link>
            . وإن لم تعد قادراً على دخول الحساب الآخر،{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              تواصل مع الدعم
            </Link>
            .
          </p>
        ),
        keywords: ['مرتبط بالفعل', 'ربط', 'تجربة', 'حساب آخر', 'تعذّر الربط'],
      },
      {
        id: 'listings-not-syncing',
        q: 'إعلاناتي لا تظهر أو ليست محدّثة',
        a: (
          <p>
            يقرأ SaleLinx إعلاناتك من Depop و Vinted ما دام هناك تبويب مفتوح
            لتلك المنصة ومسجّل الدخول بحسابك المرتبط. في{' '}
            <strong>My Listings</strong> تُظهر الحالة بجانب Depop و Vinted في
            الأعلى متى تمت آخر مزامنة لكل منهما: اضغط{' '}
            <strong>Refresh All</strong>، أو زر التحديث بجانب إحدى المنصتين،
            للمزامنة الآن. وإن طُلب منك فتح تبويب أو إعادة تحميله، أو ظهر أن
            جلستك انتهت، فافعل ذلك على موقع المنصة ثم حدّث مرة أخرى. التفاصيل
            في{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              دليل My Listings
            </Link>
            .
          </p>
        ),
        keywords: ['مزامنة', 'مفقود', 'my listings', 'تحديث', 'قديمة'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'النشر المتقاطع عالق أو لا يبدأ',
        a: (
          <div className="space-y-2">
            <p>تحقق من هذه النقاط بالترتيب:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                حساباك على Depop و Vinted مرتبطان كلاهما، وهناك تبويب Depop
                وتبويب Vinted مفتوحان ومسجّلا الدخول بهذين الحسابين. ستخبرك
                اللوحة بما ينقص.
              </li>
              <li>
                انظر إلى <Link href="/docs/getting-started/queue" className="underline underline-offset-4">قائمة الانتظار</Link> أسفل الشريط الجانبي للوحة. ينفّذ
                SaleLinx مهمة واحدة في كل مرة، لذا يبقى النشر المتقاطع في حالة{' '}
                <strong>Queued</strong> حتى تنتهي المهمة التي قبله. وإن ظهر{' '}
                <strong>Paused</strong> فاضغط <strong>Resume</strong>.
              </li>
              <li>
                <strong>Rate limited</strong> تعني أن Depop أو Vinted يحدّ من
                الطلبات. ينتظر SaleLinx ويتابع من تلقاء نفسه عند انتهاء العد
                التنازلي.
              </li>
              <li>
                إذا استنفدت حصتك الشهرية من النشر المتقاطع، يخبرك SaleLinx أنك
                بلغت الحد. تتجدد الحصة في بداية كل شهر (بتوقيت UTC)، واطلع على{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  الأسعار
                </Link>{' '}
                للخطط الأكبر.
              </li>
            </ol>
            <p>
              وإذا تكرر الفشل على منصة بعينها، فتحقق من{' '}
              <Link
                href="/docs/status"
                className="underline underline-offset-4"
              >
                صفحة حالة المنصات
              </Link>
              .
            </p>
          </div>
        ),
        keywords: ['عالق', 'متوقف', 'معلّق', 'بطيء', 'قائمة الانتظار', 'نشر متقاطع'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'فشل النشر المتقاطع لأحد الإعلانات',
        a: (
          <p>
            تعرض قائمة الانتظار أسفل الشريط الجانبي للوحة عدد الإعلانات التي
            فشلت. معظم حالات الفشل سببها تسجيل الخروج من المنصة التي تنسخ
            إليها، أو بيانات لم تقبلها تلك المنصة. سجّل الدخول إليها بحسابك
            المرتبط، ثم حدّد الإعلان في <strong>My Listings</strong> واضغط{' '}
            <strong>Crosslist</strong> مرة أخرى. ابتداءً من الإصدار 1.1.12، لا
            تُحتسب الإعلانات التي فشلت من حصتك الشهرية للنشر المتقاطع. وإذا
            كانت منصة كاملة تواجه مشكلات، فتحقق من{' '}
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
        id: 'presets-not-syncing',
        q: 'إعداداتي المحفوظة لا تظهر على حاسوبي الآخر',
        a: (
          <p>
            تتزامن الإعدادات المحفوظة عبر حساب SaleLinx مع أي خطة أو فترة تجريبية
            نشطة. تأكد أولاً أن الجهازين مسجّلا الدخول بالحساب نفسه وأن خطتك
            نشطة. أما الإعداد المحدد فهو خاص بكل جهاز، فاختره مجدداً على الجهاز
            الثاني. تسجيل الخروج يمسح الإعدادات المحفوظة من ذلك المتصفح، وتعود
            عند تسجيل الدخول التالي. التفاصيل في{' '}
            <Link
              href="/docs/getting-started/account-and-subscription"
              className="underline underline-offset-4"
            >
              الحساب والاشتراك
            </Link>
            .
          </p>
        ),
        keywords: ['إعدادات محفوظة', 'إعداد محفوظ', 'مزامنة', 'جهاز'],
      },
      {
        id: 'contact-support',
        q: 'كيف أتواصل مع الدعم؟',
        a: (
          <p>
            افتح تبويب <strong>Support</strong> في لوحة SaleLinx، واختر{' '}
            <strong>Type</strong>، وصِف المشكلة ثم اضغط{' '}
            <strong>Submit</strong>. تتضمن التذاكر المرسلة من اللوحة إصدار
            الإضافة وخطتك، وهذا يساعدنا على إيجاد السبب. ويمكنك أيضاً مراسلتنا
            من{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              صفحة التواصل
            </Link>{' '}
            أو عبر البريد على{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            . نرسل إليك بريداً عندما نرد، ويمكنك متابعة المحادثة والرد عليها
            في <strong>My tickets</strong> داخل تبويب Support، أو في{' '}
            <strong>تذاكرك</strong> على{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>
            .
          </p>
        ),
        keywords: ['دعم', 'تواصل', 'مساعدة', 'تذكرة', 'بريد', 'خلل'],
      },
    ],
  },
  {
    slug: 'ebay',
    title: 'eBay',
    blurb: 'ربط eBay، والنشر المتقاطع إليه، وتكلفته.',
    items: [
      {
        id: 'ebay-connect',
        q: 'كيف أربط حسابي على eBay؟',
        a: <p>افتح لوحة SaleLinx، وانتقل إلى <em>Settings</em>، واضغط <em>Link</em> في صف eBay. سجّل الدخول في صفحة eBay نفسها ووافق على السماح لـ SaleLinx بإدارة إعلاناتك. لا يرى SaleLinx كلمة مرور eBay أبداً، ويمكنك إلغاء الربط في أي وقت.</p>,
        keywords: ['ebay', 'ربط', 'حساب'],
      },
      {
        id: 'ebay-fees',
        q: 'هل للنشر المتقاطع إلى eBay تكلفة؟',
        a: <p>يفرض eBay رسوم الإعلان المعتادة، كما لو نشرت الإعلان يدوياً. يعرض SaleLinx رسوم eBay لكل عنصر قبل نشر أي شيء، لتتمكن من التراجع أو إزالة عناصر. تُنشر إعلانات eBay مباشرة، لأن eBay لا يدعم المسودات.</p>,
        keywords: ['ebay', 'رسوم', 'تكلفة'],
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
            لا. يعمل SaleLinx عبر جلسات Depop و Vinted المسجّلة أصلاً في
            متصفحك، فلا تعطينا أبداً كلمة مرور أي منصة. ولربط متجر بحسابك في
            SaleLinx نخزّن فقط اسم المستخدم ومعرّف الحساب الخاصين به. أما eBay فيُربط عبر صفحة تسجيل الدخول الخاصة بـ eBay، ولا يرى SaleLinx كلمة مرور eBay أبداً. ونحتفظ أيضاً برمز الوصول الذي يمنحه eBay، كي يتمكن SaleLinx من إدارة إعلاناتك.
          </p>
        ),
        keywords: ['كلمة المرور', 'بيانات الاعتماد', 'الأمان'],
      },
      {
        id: 'where-is-my-data',
        q: 'أين تُخزَّن بياناتي؟',
        a: (
          <p>
            يُخزَّن حسابك في SaleLinx وخطتك وإعداداتك وأسماء مستخدمي متاجرك
            المرتبطة لدى مزوّد قاعدة البيانات لدينا Supabase، وتتولى Stripe
            المدفوعات. لا نخزّن تفاصيل الإعلانات وصورها إلا للإعلانات التي
            تحفظها في السحابة، أما بقية ما يقرأه SaleLinx من Depop و Vinted فلا
            يُخزَّن على خوادمنا. تنتقل البيانات عبر HTTPS، وتشفّرها Supabase
            أثناء التخزين، وتربط قواعد الوصول كل إعلان وكل صورة بحسابك. أما
            أماكن معالجة مزودينا للبيانات فموضحة في{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              سياسة الخصوصية
            </Link>
            .
          </p>
        ),
        keywords: ['بيانات', 'تخزين', 'supabase', 'سحابة', 'منطقة', 'تشفير'],
      },
      {
        id: 'delete-my-data',
        q: 'كيف أحذف بياناتي؟',
        a: (
          <p>
            افتح{' '}
            <Link href="/account" className="underline underline-offset-4">
              صفحة حسابك
            </Link>
            ، وانزل إلى أسفلها واضغط <strong>حذف الحساب</strong>. أدخل كلمة
            المرور (لا حاجة إليها إن كنت تسجّل الدخول عبر Google) وسنرسل إليك
            رابط تأكيد بالبريد: افتحه خلال 60 دقيقة وأنت مسجّل الدخول، ثم أكّد
            مرة أخيرة. عندها يُحذف حسابك وإعلاناتك وصورك وحسابات المنصات
            المرتبطة وسجل الاستخدام وتذاكر الدعم فوراً، ويُلغى أي اشتراك دون
            استرداد للمدة المتبقية. ويمكنك أيضاً مراسلتنا على{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            من العنوان المسجل في حسابك وسنُتم الحذف خلال 30 يوماً.
          </p>
        ),
        keywords: ['حذف', 'اللائحة العامة لحماية البيانات', 'إزالة', 'حساب', 'محو'],
      },
    ],
  },
];
