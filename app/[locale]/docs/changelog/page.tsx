import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import { formatChangelogDate, listChangelog } from '@/lib/docs/changelog';
import type { Locale } from '@/lib/i18n/locales';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Docs.changelog' });
  return pageMetadata({
    locale,
    path: '/docs/changelog',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Docs');
  const entries = listChangelog(locale as Locale);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Breadcrumbs
        trail={[
          { label: t('breadcrumbDocs'), href: '/docs' },
          { label: t('changelog.breadcrumb') },
        ]}
      />
      <header className="mt-8">
        <span className={`${MONO} text-zinc-500`}>{t('changelog.eyebrow')}</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('changelog.title')}
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          {t('changelog.body')}
        </p>
      </header>

      <div className="mt-12 space-y-16">
        {entries.map(({ metadata, default: Body }) => (
          <section
            key={metadata.date}
            className="border-t border-black/10 pt-10 dark:border-white/10"
          >
            <span className={`${MONO} text-zinc-500`}>
              {formatChangelogDate(metadata.date, locale as Locale)}
            </span>
            <div className="mt-2">
              <Body />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
