import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import {
  MARKETPLACE_LABELS,
  STATE_META,
  getMarketplaceStatus,
} from '@/lib/docs/status';
import { getPublicFeatureStatus } from '@/lib/docs/feature-status';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Docs.status' });
  return pageMetadata({
    locale,
    path: '/docs/status',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function StatusPage() {
  const t = await getTranslations('Docs');
  // Independent reads: the hand-maintained marketplace state and the
  // telemetry-derived feature state do not depend on each other.
  const [statuses, features] = await Promise.all([
    getMarketplaceStatus(),
    getPublicFeatureStatus(),
  ]);

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

      {/* Feature status, derived from anonymous aggregated telemetry. Grouped
          by marketplace because that is how breakages actually land: a Vinted
          change takes out Vinted crosslisting while Depop keeps working. */}
      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">
          {t('status.featuresHeading')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {t('status.featuresBody')}
        </p>

        {(['vinted', 'depop'] as const).map((marketplace) => {
          const group = features.filter((f) => f.marketplace === marketplace);
          if (group.length === 0) return null;

          return (
            <div key={marketplace} className="mt-8">
              <h3 className={`${MONO} text-zinc-500`}>
                {MARKETPLACE_LABELS[marketplace]}
              </h3>
              <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {group.map((f) => {
                  const meta = STATE_META[f.state];
                  return (
                    <li
                      key={f.key}
                      className="border-b border-black/5 py-2.5 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2.5 text-sm">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
                          />
                          {f.label}
                        </span>
                        <span
                          className={`${MONO} shrink-0 rounded-full border px-2 py-0.5 ${meta.badge}`}
                        >
                          {t(`status.state.${f.state}`)}
                        </span>
                      </div>
                      {/* Only set on a manual override, and the most useful
                          thing on the page when it is: it says what we know
                          that the numbers cannot. */}
                      {f.note ? (
                        <p className="mt-1.5 pl-[1.125rem] text-sm text-zinc-600 dark:text-zinc-400">
                          {f.note}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* The section most visitors actually need. Everything above measures
          problems affecting many sellers at once; the outcomes a single stuck
          user hits (CAPTCHA, expired login, no open tab) are deliberately
          excluded from those signals, so without this the page would tell them
          "operational" and nothing else. */}
      <section className="mt-14 rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-lg font-medium tracking-tight">
          {t('status.selfHelpHeading')}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t('status.selfHelpBody')}
        </p>
        <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-400">
              -
            </span>
            {t('status.selfHelpCaptcha')}
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-400">
              -
            </span>
            {t('status.selfHelpLogin')}
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-400">
              -
            </span>
            {t('status.selfHelpTab')}
          </li>
        </ul>
        <p className="mt-4 text-sm">
          <Link
            href="/help/support"
            className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {t('status.selfHelpContact')}
          </Link>
        </p>
      </section>

      <p className="mt-12 text-sm text-zinc-500">{t('status.footnote')}</p>
      {/* Stated plainly: this is our inference from our own users' traffic, not
          an official feed. Publishing a claim about someone else's
          infrastructure without saying so would be dishonest. */}
      <p className="mt-3 text-sm text-zinc-500">{t('status.inferredNote')}</p>
    </main>
  );
}
