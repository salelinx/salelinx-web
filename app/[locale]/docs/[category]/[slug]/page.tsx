import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { PrevNextPager } from '@/components/docs/PrevNextPager';
import { getCategory } from '@/lib/docs/categories';
import {
  getArticle,
  getPrevNext,
  listAllArticles,
} from '@/lib/docs/getArticle';
import type { CategorySlug } from '@/lib/docs/types';
import type { Locale } from '@/lib/i18n/locales';
import { routing } from '@/i18n/routing';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function generateStaticParams() {
  // Articles share slugs across locales (metadata is identical shape),
  // so one locale's list is enough to enumerate category/slug pairs.
  return listAllArticles(routing.defaultLocale).map((m) => ({
    category: m.metadata.category,
    slug: m.metadata.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;
  const article = getArticle(locale as Locale, category as CategorySlug, slug);
  if (!article) {
    const t = await getTranslations({ locale, namespace: 'Docs' });
    return { title: t('metaTitle') };
  }
  return pageMetadata({
    locale,
    path: `/docs/${category}/${slug}`,
    title: article.metadata.title,
    description: article.metadata.description,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;
  const cat = getCategory(category);
  const article = getArticle(locale as Locale, category as CategorySlug, slug);
  if (!cat || !article) notFound();

  const t = await getTranslations('Docs');
  const MDX = article.default;
  const { prev, next } = getPrevNext(locale as Locale, article.metadata);
  const categoryTitle = t(`category.${cat.slug}.title`);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
        <DocsSidebar
          activeCategory={cat.slug}
          activeSlug={article.metadata.slug}
        />
        <article className="min-w-0 flex-1 lg:max-w-3xl">
          <Breadcrumbs
            trail={[
              { label: t('breadcrumbDocs'), href: '/docs' },
              { label: categoryTitle, href: `/docs/${cat.slug}` },
              { label: article.metadata.title },
            ]}
          />
          <div className="mt-6 flex items-center gap-3">
            <span className={`${MONO} text-zinc-500`}>{categoryTitle}</span>
            <span className={`${MONO} text-zinc-400`}>
              {t('articleUpdated', { date: article.metadata.updated })}
            </span>
          </div>
          <div className="mt-2">
            <MDX />
          </div>
          <PrevNextPager prev={prev} next={next} />
        </article>
      </div>
    </main>
  );
}
