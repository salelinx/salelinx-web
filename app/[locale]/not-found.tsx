import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NotFound');
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

// Renders inside the [locale] layout (Header/Footer, marketing theme) for any
// notFound() thrown in the locale tree. Unknown URLs reach it through the
// [...rest] catch-all route, so this covers arbitrary bad links too.
export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-20 text-center">
      <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {t('title')}
      </h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('body')}
      </p>

      <Link
        href="/"
        className="mt-8 block w-full rounded-lg bg-black px-4 py-3 text-center text-white dark:bg-white dark:text-black"
      >
        {t('goHome')}
      </Link>

      <div className="mt-6 text-sm">
        <Link href="/help" className="underline">
          {t('getHelp')}
        </Link>
      </div>
    </main>
  );
}
