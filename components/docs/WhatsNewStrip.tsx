import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/Icon';
import { formatChangelogDate, getRecentChangelog } from '@/lib/docs/changelog';
import type { Locale } from '@/lib/i18n/locales';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function WhatsNewStrip() {
  const [t, localeStr] = await Promise.all([
    getTranslations('Docs.whatsNew'),
    getLocale(),
  ]);
  const locale = localeStr as Locale;
  const entries = getRecentChangelog(locale, 3);
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('eyebrow')}</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('title')}
          </h2>
        </div>
        <Link
          href="/docs/changelog"
          className="hidden items-center gap-1.5 text-sm text-zinc-700 hover:text-black sm:inline-flex dark:text-zinc-300 dark:hover:text-white"
        >
          {t('fullChangelog')}
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {entries.map((entry) => (
          <li key={entry.date}>
            <Link
              href="/docs/changelog"
              className="group flex items-start justify-between gap-6 py-5"
            >
              <div className="min-w-0">
                <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>
                  {formatChangelogDate(entry.date, locale)}
                </span>
                <h3 className="mt-2 text-base font-medium tracking-tight group-hover:underline">
                  {entry.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.summary}
                </p>
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
  );
}
