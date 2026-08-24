import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/Icon';
import type { DocCategory } from '@/lib/docs/types';

export async function CategoryCard({
  category,
  articleCount,
}: {
  category: DocCategory;
  articleCount?: number;
}) {
  const t = await getTranslations('Docs');
  return (
    <Link
      href={`/docs/${category.slug}`}
      className="group flex h-full flex-col rounded-xl border border-black/10 bg-white p-6 transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/30"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
          <Icon name={category.icon} />
        </span>
        {typeof articleCount === 'number' ? (
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
            {t(articleCount === 1 ? 'articleCountOne' : 'articleCountOther', {
              count: articleCount,
            })}
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">
        {t(`category.${category.slug}.title`)}
      </h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t(`category.${category.slug}.blurb`)}
      </p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm text-zinc-700 group-hover:text-black dark:text-zinc-300 dark:group-hover:text-white">
        {t('categoryCardBrowse')}
        <Icon name="arrow-right" className="h-4 w-4" />
      </span>
    </Link>
  );
}
