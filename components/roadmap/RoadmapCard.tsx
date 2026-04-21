import { Icon } from '@/components/Icon';
import { MARKETPLACE_LABELS } from '@/lib/docs/status';
import type { RoadmapItem } from '@/lib/roadmap/data';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function RoadmapCard({ item }: { item: RoadmapItem }) {
  const isShipped = item.status === 'shipped';
  return (
    <li className="group rounded-2xl border border-black/10 bg-white p-5 transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/30">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.marketplaces?.map((m) => (
          <span
            key={m}
            className={`${MONO} inline-flex rounded-full border border-black/10 px-2 py-0.5 text-zinc-600 dark:border-white/15 dark:text-zinc-400`}
          >
            {MARKETPLACE_LABELS[m]}
          </span>
        ))}
        {item.tag ? (
          <span
            className={`${MONO} inline-flex rounded-full border border-black/10 px-2 py-0.5 text-zinc-600 dark:border-white/15 dark:text-zinc-400`}
          >
            {item.tag}
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 flex items-start gap-2 text-base font-semibold tracking-tight">
        {isShipped ? (
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          >
            <Icon name="arrow-right" className="h-3 w-3" />
          </span>
        ) : null}
        <span
          className={
            isShipped ? 'text-zinc-700 dark:text-zinc-300' : undefined
          }
        >
          {item.title}
        </span>
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {item.description}
      </p>

      <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/5">
        <span className={`${MONO} text-zinc-500`}>{item.meta}</span>
      </div>
    </li>
  );
}
