import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/Icon';
import type { ArticleMetadata } from '@/lib/docs/types';

export async function PrevNextPager({
  prev,
  next,
}: {
  prev?: ArticleMetadata;
  next?: ArticleMetadata;
}) {
  if (!prev && !next) return null;
  const t = await getTranslations('Docs.prevNext');
  const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

  return (
    <nav className="mt-16 grid grid-cols-1 gap-3 border-t border-black/10 pt-10 sm:grid-cols-2 dark:border-white/10">
      {prev ? (
        <Link
          href={`/docs/${prev.category}/${prev.slug}`}
          className="group flex flex-col rounded-xl border border-black/10 p-5 transition hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
        >
          <span className={`${MONO} text-zinc-500`}>{t('previous')}</span>
          <span className="mt-2 flex items-center gap-2 font-medium">
            <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/docs/${next.category}/${next.slug}`}
          className="group flex flex-col rounded-xl border border-black/10 p-5 text-right transition hover:border-black/30 sm:col-start-2 dark:border-white/10 dark:hover:border-white/30"
        >
          <span className={`${MONO} text-zinc-500`}>{t('next')}</span>
          <span className="mt-2 flex items-center justify-end gap-2 font-medium">
            {next.title}
            <Icon name="arrow-right" className="h-4 w-4" />
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
