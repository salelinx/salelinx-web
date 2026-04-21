import { RoadmapColumn } from '@/components/roadmap/RoadmapColumn';
import { ROADMAP_COLUMNS, itemsByStatus } from '@/lib/roadmap/data';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function RoadmapSection() {
  return (
    <section id="roadmap" className="scroll-mt-20 border-t border-black/10 py-20 dark:border-white/10">
      <div className="pb-12">
        <span className={`${MONO} text-zinc-500`}>Section 03 / Roadmap</span>
        <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Where SaleLinx is going.
        </h2>
        <p className="mt-5 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          A public view of what&rsquo;s being scoped, built, and already
          shipped. Dates are targets, not commitments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
        {ROADMAP_COLUMNS.map((column) => (
          <RoadmapColumn
            key={column.status}
            column={column}
            items={itemsByStatus(column.status)}
          />
        ))}
      </div>

      <div className="mt-16 flex flex-col items-start gap-4 border-t border-black/10 pt-10 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <div>
          <span className={`${MONO} text-zinc-500`}>Have a request?</span>
          <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
            Missing a marketplace or feature? Tell us what you need and
            we&rsquo;ll weigh it in the next planning round.
          </p>
        </div>
        <a
          href="mailto:hello@salelinx.com"
          className="shrink-0 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Email hello@salelinx.com
        </a>
      </div>
    </section>
  );
}
