import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import {
  MARKETPLACE_LABELS,
  STATE_META,
  getMarketplaceStatus,
} from '@/lib/docs/status';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Docs.status' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function StatusPage() {
  const t = await getTranslations('Docs');
  const statuses = await getMarketplaceStatus();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <Breadcrumbs
        trail={[
          { label: t('breadcrumbDocs'), href: '/docs' },
          { label: t('status.breadcrumb') },
        ]}
      />
      <header className="mt-8">
        <span className={`${MONO} text-zinc-500`}>{t('status.eyebrow')}</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('status.title')}
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          {t('status.body')}
        </p>
      </header>

      <ul className="mt-10 divide-y divide-black/10 dark:divide-white/10">
        {statuses.map((s) => {
          const meta = STATE_META[s.state];
          return (
            <li
              key={s.marketplace}
              id={s.marketplace}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-medium tracking-tight">
                      {MARKETPLACE_LABELS[s.marketplace]}
                    </h2>
                    <span
                      className={`${MONO} rounded-full border px-2 py-0.5 ${meta.badge}`}
                    >
                      {t(`status.state.${s.state}`)}
                    </span>
                  </div>
                  {s.note ? (
                    <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                      {s.note}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-500 sm:text-right">
                {t('status.updatedPrefix', { date: s.updatedAt })}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-12 text-sm text-zinc-500">
        {t('status.footnote')}
      </p>
    </main>
  );
}
