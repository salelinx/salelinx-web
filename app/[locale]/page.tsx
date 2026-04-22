import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-20 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        {t('heroTitle')}
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        {t('heroSubtitle')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pricing"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {t('ctaSeePricing')}
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {t('ctaGetStarted')}
        </Link>
        <Link
          href="/auth/login"
          className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
        >
          {t('ctaSignIn')}
        </Link>
      </div>
    </main>
  );
}
