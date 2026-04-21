import { RoadmapColumn } from '@/components/roadmap/RoadmapColumn';
import {
  ROADMAP_COLUMNS,
  itemsByStatus,
} from '@/lib/roadmap/data';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export const metadata = {
  title: 'Roadmap - SaleLinx',
  description:
    'What SaleLinx is exploring, building, and has shipped. Public view of where the product is going.',
};

export default function RoadmapPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6">
      <section className="pt-20 pb-10 sm:pt-24">
        <span className={`${MONO} text-zinc-500`}>Roadmap</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Where SaleLinx is going.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          A public view of what&rsquo;s being scoped, built, and already
          shipped. Dates are targets, not commitments.
        </p>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
          {ROADMAP_COLUMNS.map((column) => (
            <RoadmapColumn
              key={column.status}
              column={column}
              items={itemsByStatus(column.status)}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
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
    </main>
  );
}
