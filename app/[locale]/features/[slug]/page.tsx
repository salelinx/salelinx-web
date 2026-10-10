import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { LANDING_PAGES, getLandingPage } from '@/lib/landing/pages';
import { SITE_URL, absoluteUrl, pageMetadata } from '@/lib/site';

export function generateStaticParams() {
  return LANDING_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = getLandingPage(slug);
  if (!page) return {};
  return pageMetadata({
    locale,
    path: `/features/${slug}`,
    title: page.metaTitle,
    description: page.metaDescription,
    contentLocales: ['en'],
  });
}

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = getLandingPage(slug);
  if (!page) notFound();

  const url = absoluteUrl(routing.defaultLocale, `/features/${slug}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        '@id': `${url}#howto`,
        name: page.title,
        description: page.metaDescription,
        step: page.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Features', item: `${SITE_URL}/features` },
          { '@type': 'ListItem', position: 2, name: page.navLabel },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="pt-20 pb-10 sm:pt-28">
        <Link href="/features" className={`${MONO} text-zinc-600 dark:text-zinc-400`}>
          Features
        </Link>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {page.title}
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">{page.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Start your free 14-day trial
          </Link>
          <Link
            href="/features#pricing"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            See pricing
          </Link>
        </div>
      </section>

      <section className="border-t border-black/10 py-12 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-zinc-700 dark:text-zinc-300">
          {page.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="border-t border-black/10 py-12 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">Why sellers use it</h2>
        <div className="mt-6 space-y-6">
          {page.points.map(({ title, body }) => (
            <div key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-12 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
        <div className="mt-6 space-y-6">
          {page.faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{a}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm">
          Full walkthrough:{' '}
          <Link href={page.doc.path} className="underline underline-offset-4">
            {page.doc.label}
          </Link>
        </p>
      </section>

      <section className="border-t border-black/10 py-12 dark:border-white/10">
        <h2 className="text-lg font-semibold">More SaleLinx tools</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {LANDING_PAGES.filter((p) => p.slug !== slug).map((p) => (
            <li key={p.slug}>
              <Link
                href={`/features/${p.slug}`}
                className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                {p.navLabel}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
