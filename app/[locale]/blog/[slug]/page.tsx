import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import { PostCard } from '@/components/blog/PostCard';
import { PostCta } from '@/components/blog/PostCta';
import { parseFaq } from '@/lib/blog/faq';
import { postJsonLd } from '@/lib/blog/jsonld';
import {
  AUTHORS,
  BLOG_CONTENT_LOCALES,
  categoryTitle,
  formatPostDate,
  getPost,
  listPosts,
  relatedPosts,
} from '@/lib/blog/posts';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function generateStaticParams() {
  return listPosts().map((p) => ({ slug: p.metadata.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const base = pageMetadata({
    locale,
    path: `/blog/${slug}`,
    title: post.metadata.title,
    description: post.metadata.description,
    contentLocales: BLOG_CONTENT_LOCALES,
    // opengraph-image.tsx in this segment generates the per-post image.
    segmentOgImage: true,
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: post.metadata.published,
      modifiedTime: post.metadata.updated,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = getPost(slug);
  if (!post) notFound();

  const meta = post.metadata;
  const MDX = post.default;
  const related = relatedPosts(meta, 2);
  const faq = parseFaq(
    readFileSync(path.join(process.cwd(), 'content/blog/en', `${slug}.mdx`), 'utf8'),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pt-12 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(postJsonLd(meta, faq)) }}
      />
      <Breadcrumbs trail={[{ label: 'Guides', href: '/blog' }, { label: meta.title }]} />

      <article>
        <header className="mt-8">
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>
            {categoryTitle(meta.category)} &middot; {meta.readingMinutes} min read
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            {meta.title}
          </h1>
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
            By {AUTHORS[meta.author]} &middot;{' '}
            <time dateTime={meta.published}>{formatPostDate(meta.published)}</time> &middot; Facts
            checked <time dateTime={meta.updated}>{formatPostDate(meta.updated)}</time>
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            We make SaleLinx, the crosslisting extension, so read our product mentions with that in
            mind.
          </p>
        </header>

        <div className="mt-8">
          <MDX />
        </div>
      </article>

      <PostCta />

      {related.length > 0 ? (
        <section aria-labelledby="related-posts" className="mt-16">
          <h2 id="related-posts" className="text-lg font-semibold">
            Keep reading
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.slug}>
                <PostCard post={p} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
