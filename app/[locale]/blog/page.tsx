import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PostCard } from '@/components/blog/PostCard';
import { blogJsonLd } from '@/lib/blog/jsonld';
import { BLOG_CATEGORIES, BLOG_CONTENT_LOCALES, listPosts } from '@/lib/blog/posts';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/blog',
    title: 'Depop and Vinted selling tips for UK resellers',
    description:
      'Guides for UK Depop and Vinted sellers: when to list, how to get more views, what the fees really are and what HMRC expects. From the team behind SaleLinx.',
    contentLocales: BLOG_CONTENT_LOCALES,
  });
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = listPosts().map((p) => p.metadata);

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd(posts)) }}
      />
      <section className="pt-20 pb-12 sm:pt-24">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>Blog</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Selling tips for Depop and Vinted
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Practical answers for UK resellers: when to list, how to get seen, what the fees
          really are and when the taxman needs to know.
        </p>
      </section>

      {BLOG_CATEGORIES.map((cat) => {
        const inCategory = posts.filter((p) => p.category === cat.slug);
        if (inCategory.length === 0) return null;
        return (
          <section
            key={cat.slug}
            aria-labelledby={`blog-${cat.slug}`}
            className="border-t border-black/10 py-12 dark:border-white/10"
          >
            <h2 id={`blog-${cat.slug}`} className="text-2xl font-semibold tracking-tight">
              {cat.title}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">{cat.blurb}</p>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inCategory.map((post) => (
                <li key={post.slug}>
                  <PostCard post={post} headingLevel="h3" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
