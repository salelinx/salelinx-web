import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/Reveal';
import { RoadmapColumn } from '@/components/roadmap/RoadmapColumn';
import { getCachedRoadmapItems } from '@/lib/roadmap/data';
import { ROADMAP_STATUSES, itemsByStatus } from '@/lib/roadmap/types';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

// The public roadmap. `standalone` is the /roadmap page (h1, no eyebrow);
// the default is the last homepage section, under the FAQ. Same split as
// PricingSection. Cards come from roadmap_items and are edited in
// /admin/roadmap; the header, column and tag labels stay in messages/*.json
// under Roadmap.
export async function RoadmapSection({ standalone = false }: { standalone?: boolean } = {}) {
  const [t, items] = await Promise.all([
    getTranslations('Roadmap'),
    getCachedRoadmapItems(),
  ]);

  // Read failed. The homepage leaves the section out rather than show three
  // empty columns, which would read as "nothing planned"; the /roadmap page
  // keeps its heading and drops only the board.
  if (!items && !standalone) return null;

  return (
    <section
      id="roadmap"
      className={
        standalone
          ? 'pt-14 sm:pt-20'
          : 'scroll-mt-20 border-t border-black/10 pt-14 sm:pt-20 dark:border-white/10'
      }
    >
      {standalone ? (
        <div className="pb-12">
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            {t('sectionHeader.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {t('sectionHeader.body')}
          </p>
        </div>
      ) : (
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
      )}

      {items && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
          {ROADMAP_STATUSES.map((status) => (
            <RoadmapColumn
              key={status}
              status={status}
              items={itemsByStatus(items, status)}
            />
          ))}
        </div>
      )}

      {/* Fixed height in 80px steps: the grid rows count up from the footer, so this rule lands on one. */}
      <div className="mt-16 h-80 border-t border-black/10 pt-10 sm:h-60 dark:border-white/10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-12">
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
      </div>
    </section>
  );
}
