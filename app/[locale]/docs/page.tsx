import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocsSearch } from '@/components/docs/DocsSearch';
import { TaskPill } from '@/components/docs/TaskPill';
import { CategoryCard } from '@/components/docs/CategoryCard';
import { StatusCard } from '@/components/docs/StatusCard';
import { MarketplaceLogoRow } from '@/components/docs/MarketplaceLogoRow';
import { WhatsNewStrip } from '@/components/docs/WhatsNewStrip';
import { DocsFAQLink } from '@/components/docs/DocsFAQLink';
import { CATEGORIES } from '@/lib/docs/categories';
import { getArticleCountByCategory } from '@/lib/docs/getArticle';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/i18n/locales';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

const TASK_PILLS: Array<{
  key: 'install' | 'connect' | 'crosslist' | 'manage';
  href: string;
}> = [
  { key: 'install', href: '/docs/getting-started/install-the-extension' },
  { key: 'connect', href: '/docs/getting-started/connect-your-first-marketplace' },
  { key: 'crosslist', href: '/docs/inventory/crosslist' },
  { key: 'manage', href: '/docs/inventory/listings' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Docs' });
  return pageMetadata({
    locale,
    path: '/docs',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function DocsHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Docs');
  const counts = getArticleCountByCategory(locale as Locale);

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <section className="pt-20 pb-12 sm:pt-24">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('eyebrow')}</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          {t('heroTitle')}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          {t.rich('heroBody', {
            faq: (chunks) => (
              <Link href="/faq" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>

        <div className="mt-10 max-w-3xl">
          <DocsSearch />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {TASK_PILLS.map((pill) => (
            <TaskPill key={pill.href} label={t(`task.${pill.key}`)} href={pill.href} />
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('browseByTopic')}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.slug}
              category={category}
              articleCount={counts[category.slug]}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <div className="mb-6">
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('byMarketplaceEyebrow')}</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('byMarketplaceTitle')}
          </h2>
        </div>
        <MarketplaceLogoRow />
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <StatusCard />
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <WhatsNewStrip />
      </section>

      <section className="border-t border-black/10 py-8 dark:border-white/10">
        <DocsFAQLink />
      </section>
    </main>
  );
}
