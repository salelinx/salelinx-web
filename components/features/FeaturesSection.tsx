import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon, type IconName } from '@/components/Icon';

type Marketplace = 'depop' | 'vinted' | 'both';

type FeatureItem = {
  id: string;
  icon: IconName;
  on: Marketplace;
  href: string;
};

type ChapterId = 'listings' | 'crosslisting' | 'visibility' | 'sales';

type Chapter = {
  id: ChapterId;
  items: FeatureItem[];
};

const CHAPTERS: Chapter[] = [
  {
    id: 'listings',
    items: [
      { id: 'dashboard', icon: 'grid', on: 'both', href: '/docs/listings/manage-inventory' },
      { id: 'linkAccounts', icon: 'link', on: 'both', href: '/docs/getting-started/connect-your-first-marketplace' },
      { id: 'backup', icon: 'lock', on: 'both', href: '/docs/listings' },
      { id: 'sync', icon: 'sync', on: 'both', href: '/docs/getting-started' },
      { id: 'multilanguage', icon: 'globe', on: 'both', href: '/docs/getting-started' },
    ],
  },
  {
    id: 'crosslisting',
    items: [
      { id: 'bidirectional', icon: 'swap', on: 'both', href: '/docs/crosslisting/crosslist-your-first-item' },
      { id: 'autoMap', icon: 'tree', on: 'both', href: '/docs/crosslisting/crosslist-your-first-item' },
      { id: 'csvImport', icon: 'upload', on: 'both', href: '/docs/listings/manage-inventory' },
      { id: 'shopDesigner', icon: 'layout', on: 'depop', href: '/docs/crosslisting' },
    ],
  },
  {
    id: 'visibility',
    items: [
      { id: 'refresher', icon: 'refresh', on: 'depop', href: '/docs/listings' },
      { id: 'scheduler', icon: 'clock', on: 'depop', href: '/docs/listings' },
      { id: 'followBot', icon: 'users', on: 'both', href: '/docs' },
      { id: 'filters', icon: 'filter', on: 'both', href: '/docs' },
      { id: 'deadStock', icon: 'search', on: 'both', href: '/docs/listings/manage-inventory' },
      { id: 'activityLog', icon: 'list', on: 'both', href: '/docs' },
    ],
  },
  {
    id: 'sales',
    items: [
      { id: 'offersInbox', icon: 'tag', on: 'both', href: '/docs' },
      { id: 'autoOffers', icon: 'zap', on: 'both', href: '/docs' },
      { id: 'messages', icon: 'message', on: 'both', href: '/docs' },
      { id: 'shipping', icon: 'box', on: 'both', href: '/docs' },
      { id: 'relister', icon: 'rotate', on: 'both', href: '/docs/listings/manage-inventory' },
    ],
  },
];

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

function MarketplaceBadge({
  on,
  label,
}: {
  on: Marketplace;
  label: string;
}) {
  if (on === 'both') return null;
  return (
    <span
      className={`${MONO} ml-2 inline-block shrink-0 rounded border border-black/10 px-1.5 py-0.5 text-zinc-600 dark:border-white/15 dark:text-zinc-400`}
    >
      {label}
    </span>
  );
}

export async function FeaturesSection() {
  const t = await getTranslations('Features');

  return (
    <section id="features" className="scroll-mt-20 pt-16 pb-8">
      <div className="pb-10">
        <span className={`${MONO} text-zinc-500`}>{t('sectionHeader.eyebrow')}</span>
        <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {t('sectionHeader.title')}
        </h2>
      </div>

      {CHAPTERS.map((chapter, i) => (
        <article
          key={chapter.id}
          className={`grid grid-cols-1 gap-10 border-t border-black/10 py-16 md:grid-cols-12 md:gap-12 dark:border-white/10 ${
            i === 0 ? 'pt-12' : ''
          }`}
        >
          <header className="md:col-span-5">
            <span className={`${MONO} text-zinc-500`}>
              {t(`chapter.${chapter.id}.number`)}
            </span>
            <h3 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t(`chapter.${chapter.id}.title`)}
            </h3>
            <p className="mt-5 text-base text-zinc-600 dark:text-zinc-400">
              {t(`chapter.${chapter.id}.blurb`)}
            </p>
          </header>
          <ul className="space-y-5 md:col-span-6 md:col-start-7">
            {chapter.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group -mx-2 flex gap-4 rounded-lg p-2 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span className="mt-0.5 text-zinc-700 transition group-hover:text-black dark:text-zinc-300 dark:group-hover:text-white">
                    <Icon name={item.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline">
                      <span className="font-medium underline-offset-4 group-hover:underline">
                        {t(`chapter.${chapter.id}.items.${item.id}.label`)}
                      </span>
                      <MarketplaceBadge
                        on={item.on}
                        label={t('marketplaceOnly', { marketplace: item.on })}
                      />
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {t(`chapter.${chapter.id}.items.${item.id}.detail`)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
