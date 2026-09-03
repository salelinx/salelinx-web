import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/site';
import { UninstallSurvey } from '@/components/UninstallSurvey';

// Landing page for chrome.runtime.setUninstallURL - Chrome opens it the
// moment someone removes the extension. Kept out of the sitemap (app/
// sitemap.ts is opt-in) and noindexed below: nobody should find their way
// here except through an uninstall.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Uninstall' });
  return {
    ...pageMetadata({
      locale,
      path: '/uninstall',
      title: t('metaTitle'),
      description: t('metaDescription'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function UninstallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Uninstall');

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </p>
      </div>

      <UninstallSurvey />

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('privacyNote')}{' '}
        <Link
          href="/legal/privacy"
          className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          {t('privacyLink')}
        </Link>
      </p>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('reinstallHint')}{' '}
        <Link
          href="/help"
          className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          {t('helpLink')}
        </Link>
      </p>
    </main>
  );
}
