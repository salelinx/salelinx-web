import { notFound } from 'next/navigation';
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

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function generateStaticParams() {
  return listAllArticles().map((m) => ({
    category: m.metadata.category,
    slug: m.metadata.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const article = getArticle(category as CategorySlug, slug);
  if (!article) return { title: 'Docs - SaleLinx' };
  return {
    title: `${article.metadata.title} - SaleLinx docs`,
    description: article.metadata.description,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const cat = getCategory(category);
  const article = getArticle(category as CategorySlug, slug);
  if (!cat || !article) notFound();

  const MDX = article.default;
  const { prev, next } = getPrevNext(article.metadata);

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
              { label: 'Docs', href: '/docs' },
              { label: cat.title, href: `/docs/${cat.slug}` },
              { label: article.metadata.title },
            ]}
          />
          <div className="mt-6 flex items-center gap-3">
            <span className={`${MONO} text-zinc-500`}>{cat.title}</span>
            <span className={`${MONO} text-zinc-400`}>
              Updated {article.metadata.updated}
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
