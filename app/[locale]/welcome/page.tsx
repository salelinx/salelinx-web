import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/site';

// Getting-started page the extension opens on first install (onInstalled,
// reason === 'install'). The panel only exists inside Depop/Vinted tabs, so
// without this a fresh install is silence: nothing on screen changes and the
// user has no idea where the product lives. Same treatment as /uninstall:
// noindexed and out of the sitemap, reachable only through the install.

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Welcome' });
  return {
    ...pageMetadata({
      locale,
      path: '/welcome',
      title: t('metaTitle'),
      description: t('metaDescription'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Welcome');

  const steps = [
    { num: '1', title: t('step1Title'), text: t('step1Text') },
    { num: '2', title: t('step2Title'), text: t('step2Text') },
    { num: '3', title: t('step3Title'), text: t('step3Text') },
  ];

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <div>
        <p className={`${MONO} text-emerald-600 dark:text-emerald-400`}>
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
      </div>

      <ol className="flex flex-col gap-5">
        {steps.map((s) => (
          <li key={s.num} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
              {s.num}
            </span>
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {s.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="https://www.depop.com"
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          {t('openDepop')}
        </a>
        <a
          href="https://www.vinted.co.uk"
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
        >
          {t('openVinted')}
        </a>
        <Link
          href="/docs"
          className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {t('docsLink')}
        </Link>
      </div>
    </main>
  );
}
