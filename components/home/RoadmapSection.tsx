import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/Reveal';
import { RoadmapColumn } from '@/components/roadmap/RoadmapColumn';
import { getCachedRoadmapItems } from '@/lib/roadmap/data';
import { ROADMAP_STATUSES, itemsByStatus } from '@/lib/roadmap/types';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

// Last section of the homepage, under the FAQ. Cards come from roadmap_items
// and are edited in /admin/roadmap; the header, column and tag labels stay in
// messages/*.json under Roadmap.
export async function RoadmapSection() {
  const [t, items] = await Promise.all([
    getTranslations('Roadmap'),
    getCachedRoadmapItems(),
  ]);

  // Read failed: leave the section out rather than show three empty columns,
  // which would read as "nothing planned".
  if (!items) return null;

  return (
    <section
      id="roadmap"
      className="scroll-mt-20 border-t border-black/10 pt-14 pb-24 sm:pt-20 sm:pb-32 dark:border-white/10"
    >
      {/* Larger bottom than the other sections: this is the end of the page. */}
      <Reveal as="div" className="pb-12 text-center">
        <span className={`${MONO} text-zinc-500 dark:text-zinc-400`}>
          {t('sectionHeader.eyebrow')}
        </span>
        <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t('sectionHeader.title')}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-zinc-600 dark:text-zinc-400">
          {t('sectionHeader.body')}
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
        {ROADMAP_STATUSES.map((status) => (
          <RoadmapColumn
            key={status}
            status={status}
            items={itemsByStatus(items, status)}
          />
        ))}
      </div>

      <div className="mt-16 flex flex-col items-start gap-4 border-t border-black/10 pt-10 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <div>
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('request.eyebrow')}</span>
          <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
            {t('request.body')}
          </p>
        </div>
        <a
          href="mailto:hello@salelinx.com"
          className="shrink-0 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {t('request.cta')}
        </a>
      </div>
    </section>
  );
}
