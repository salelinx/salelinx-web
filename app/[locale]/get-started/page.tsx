import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/site';
import { GetStartedInstall } from '@/components/GetStartedInstall';

// Where website signups land. Extension signups never come here, they already
// have it installed.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'GetStarted' });
  return {
    ...pageMetadata({
      locale,
      path: '/get-started',
      title: t('metaTitle'),
      description: t('subtitle'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function GetStartedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('GetStarted');

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {t('title')}
      </h1>
      <GetStartedInstall buttonClassName="mt-8 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full bg-black px-7 py-3.5 text-base font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 [&_svg]:h-5 [&_svg]:w-5" />

      <Link
        href="/account"
        className="mt-6 text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {t('toAccount')}
      </Link>
    </main>
  );
}
