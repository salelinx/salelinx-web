import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { Icon } from '@/components/Icon';
import { CATEGORIES, getCategory } from '@/lib/docs/categories';
import { listByCategory } from '@/lib/docs/getArticle';
import type { CategorySlug } from '@/lib/docs/types';
import type { Locale } from '@/lib/i18n/locales';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  const t = await getTranslations({ locale, namespace: 'Docs' });
  const cat = getCategory(category);
  if (!cat) return { title: t('metaTitle') };
  const title = t(`category.${cat.slug}.title`);
  const blurb = t(`category.${cat.slug}.blurb`);
  return {
    title: `${title} - SaleLinx docs`,
    description: blurb,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const t = await getTranslations('Docs');
  const articles = listByCategory(locale as Locale, cat.slug as CategorySlug);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
        <DocsSidebar activeCategory={cat.slug} />
        <div className="min-w-0 flex-1">
          <Breadcrumbs
            trail={[
              { label: t('breadcrumbDocs'), href: '/docs' },
              { label: t(`category.${cat.slug}.title`) },
            ]}
          />
          <header className="mt-8 flex items-start gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
              <Icon name={cat.icon} className="h-6 w-6" />
            </span>
            <div>
              <span className={`${MONO} text-zinc-500`}>{t('categoryPageEyebrow')}</span>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t(`category.${cat.slug}.title`)}
              </h1>
              <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
                {t(`category.${cat.slug}.blurb`)}
              </p>
            </div>
          </header>

          <ul className="mt-10 divide-y divide-black/10 dark:divide-white/10">
            {articles.map((a) => (
              <li key={a.metadata.slug}>
                <Link
                  href={`/docs/${a.metadata.category}/${a.metadata.slug}`}
                  className="group flex items-start justify-between gap-6 py-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-medium tracking-tight group-hover:underline">
                        {a.metadata.title}
                      </h2>
                      {a.metadata.status === 'stub' ? (
                        <span className={`${MONO} rounded border border-black/10 px-1.5 py-0.5 text-zinc-500 dark:border-white/15`}>
                          {t('articleStub')}
                        </span>
                      ) : null}
                    </div>
                    {a.metadata.description ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {a.metadata.description}
                      </p>
                    ) : null}
                  </div>
                  <Icon
                    name="arrow-right"
                    className="mt-2 h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-black dark:group-hover:text-white"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
