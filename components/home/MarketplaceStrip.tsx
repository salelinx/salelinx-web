import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { BrandWordmark, type Brand } from '@/components/BrandWordmark';
import {
  MARKETPLACE_LABELS,
  STATE_META,
  getMarketplaceStatus,
} from '@/lib/docs/status';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

/**
 * Integration strip under the hero: the marketplaces SaleLinx works with
 * today, each with its live status pulled from the same source as the
 * status page, plus a pointer to the roadmap for what is next. Only real
 * integrations appear here; nothing aspirational.
 */
export async function MarketplaceStrip() {
  const [t, tStatus, statuses] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Docs.status'),
    getMarketplaceStatus(),
  ]);

  return (
    <section
      aria-label={t('marketplaces.worksWith')}
      className="mx-auto w-full max-w-5xl px-6 pb-20"
    >
      <Reveal>
        <div className="flex flex-col items-center gap-5">
          <span className={`${MONO} text-zinc-500`}>
            {t('marketplaces.worksWith')}
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {statuses.map((s) => {
              const meta = STATE_META[s.state];
              return (
                <li key={s.marketplace}>
                  <Link
                    href="/docs/status"
                    aria-label={`${MARKETPLACE_LABELS[s.marketplace]}: ${tStatus(`state.${s.state}`)}`}
                    className="group inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/70 px-5 py-2.5 backdrop-blur transition hover:border-black/25 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/25"
                  >
                    <BrandWordmark
                      brand={s.marketplace as Brand}
                      variant="wordmark"
                      height="1.05em"
                    />
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`}
                      />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tStatus(`state.${s.state}`)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/features#roadmap"
            className="text-sm text-zinc-500 underline-offset-4 transition hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {t('marketplaces.roadmap')}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
