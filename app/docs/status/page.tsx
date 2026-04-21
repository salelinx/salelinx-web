import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import {
  MARKETPLACE_LABELS,
  STATE_META,
  getMarketplaceStatus,
} from '@/lib/docs/status';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export const metadata = {
  title: 'Marketplace status - SaleLinx docs',
  description:
    'Live view of which marketplaces SaleLinx is currently crosslisting to.',
};

export default async function StatusPage() {
  const statuses = await getMarketplaceStatus();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <Breadcrumbs
        trail={[
          { label: 'Docs', href: '/docs' },
          { label: 'Marketplace status' },
        ]}
      />
      <header className="mt-8">
        <span className={`${MONO} text-zinc-500`}>Status</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Marketplace status
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Which marketplaces SaleLinx is currently able to crosslist to. If
          you&rsquo;re seeing errors and a marketplace is flagged here, the
          team is already on it.
        </p>
      </header>

      <ul className="mt-10 divide-y divide-black/10 dark:divide-white/10">
        {statuses.map((s) => {
          const meta = STATE_META[s.state];
          return (
            <li
              key={s.marketplace}
              id={s.marketplace}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-medium tracking-tight">
                      {MARKETPLACE_LABELS[s.marketplace]}
                    </h2>
                    <span
                      className={`${MONO} rounded-full border px-2 py-0.5 ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {s.note ? (
                    <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                      {s.note}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-500 sm:text-right">
                Updated {s.updatedAt}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-12 text-sm text-zinc-500">
        Status is checked by the SaleLinx team and updated when the
        extension&rsquo;s posting behaviour is known to be impacted by a
        marketplace change.
      </p>
    </main>
  );
}
