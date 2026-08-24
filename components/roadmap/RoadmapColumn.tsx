import { getTranslations } from 'next-intl/server';
import { RoadmapCard } from './RoadmapCard';
import type { RoadmapColumn as Column, RoadmapItem } from '@/lib/roadmap/data';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

const DOT: Record<Column['status'], string> = {
  exploring: 'bg-zinc-400 dark:bg-zinc-600',
  building: 'bg-amber-500',
  shipped: 'bg-emerald-500',
};

export async function RoadmapColumn({
  column,
  items,
}: {
  column: Column;
  items: RoadmapItem[];
}) {
  const t = await getTranslations('Roadmap');
  return (
    <section className="flex flex-col">
      <header className="pb-6">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>
          {t(`columns.${column.status}.eyebrow`)}
        </span>
        <div className="mt-3 flex items-center gap-2.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${DOT[column.status]}`}
          />
          <h2 className="text-2xl font-semibold tracking-tight">
            {t(`columns.${column.status}.title`)}
          </h2>
          <span className={`${MONO} ml-1 text-zinc-600 dark:text-zinc-400`}>{items.length}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t(`columns.${column.status}.blurb`)}
        </p>
      </header>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <RoadmapCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-black/10 p-8 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
          {t('empty')}
        </div>
      )}
    </section>
  );
}
