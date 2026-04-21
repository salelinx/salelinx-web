import Link from 'next/link';
import { Icon } from '@/components/Icon';
import {
  MARKETPLACE_LABELS,
  STATE_META,
  getMarketplaceStatus,
} from '@/lib/docs/status';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function StatusCard() {
  const statuses = await getMarketplaceStatus();
  const worst = statuses.reduce<'ok' | 'degraded' | 'down'>((acc, s) => {
    if (acc === 'down' || s.state === 'down') return 'down';
    if (acc === 'degraded' || s.state === 'degraded') return 'degraded';
    return 'ok';
  }, 'ok');
  const meta = STATE_META[worst];
  const headline =
    worst === 'ok'
      ? 'All marketplaces operational'
      : worst === 'degraded'
        ? 'Some marketplaces degraded'
        : 'One or more marketplaces down';

  return (
    <Link
      href="/docs/status"
      className="group block rounded-xl border border-black/10 bg-white p-6 transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/30"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <span className={`${MONO} text-zinc-500`}>Marketplace status</span>
          <div className="mt-2 flex items-center gap-2.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            <h3 className="text-lg font-semibold tracking-tight">
              {headline}
            </h3>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Live view of which marketplaces SaleLinx is currently posting to.
          </p>
        </div>
        <Icon
          name="arrow-right"
          className="mt-1 h-5 w-5 shrink-0 text-zinc-400 transition group-hover:text-black dark:group-hover:text-white"
        />
      </div>
      <ul className="mt-5 flex flex-col gap-y-2 text-sm">
        {statuses.map((s) => {
          const sm = STATE_META[s.state];
          return (
            <li key={s.marketplace} className="flex items-center gap-2">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${sm.dot}`} />
              <span className="text-zinc-700 dark:text-zinc-300">
                {MARKETPLACE_LABELS[s.marketplace]}
              </span>
              <span className="ml-auto text-xs text-zinc-500">{sm.label}</span>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}
