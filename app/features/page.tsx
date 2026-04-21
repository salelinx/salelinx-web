import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';

export const metadata = {
  title: 'Features - Resale Bot',
  description:
    'Every capability in the Resale Bot Chrome extension: crosslisting, relisting, refresh, follow bots, offers, messages, shipping labels, and more - across Depop and Vinted.',
};

type Marketplace = 'depop' | 'vinted' | 'both';

type FeatureItem = {
  label: string;
  detail: string;
  icon: IconName;
  on: Marketplace;
};

type Chapter = {
  number: string;
  title: string;
  blurb: string;
  items: FeatureItem[];
};

const CHAPTERS: Chapter[] = [
  {
    number: '01',
    title: 'Listings & inventory',
    blurb:
      'One dashboard shows every listing from both shops, merged, sortable, and backed up. Link your Depop and Vinted accounts once and the panel is ready on every page.',
    items: [
      {
        label: 'Unified listings dashboard',
        detail: 'Both shops in one grid, merged by title, sortable across columns.',
        icon: 'grid',
        on: 'both',
      },
      {
        label: 'Link accounts once',
        detail: 'Session auto-detected from the browser; nothing to re-enter.',
        icon: 'link',
        on: 'both',
      },
      {
        label: 'Encrypted cloud backup',
        detail: 'Supabase-backed listing store with client-side AES encryption on linked credentials.',
        icon: 'lock',
        on: 'both',
      },
      {
        label: 'Settings sync across devices',
        detail: 'Move to a second laptop and your configuration follows.',
        icon: 'sync',
        on: 'both',
      },
    ],
  },
  {
    number: '02',
    title: 'Crosslisting',
    blurb:
      'Write the listing once, post it to both marketplaces. Categories, sizes, conditions and brands are translated for you - and the Depop shop layout tool lives in the same panel.',
    items: [
      {
        label: 'Bi-directional crosslister',
        detail: 'Depop to Vinted and Vinted to Depop, with form auto-fill on the target marketplace.',
        icon: 'swap',
        on: 'both',
      },
      {
        label: 'Auto-mapped taxonomies',
        detail: 'Categories, sizes, conditions and brands translated between platforms.',
        icon: 'tree',
        on: 'both',
      },
      {
        label: 'CSV inventory import',
        detail: 'Bulk-load an existing inventory with automatic field mapping.',
        icon: 'upload',
        on: 'both',
      },
      {
        label: 'Shop Designer',
        detail: 'Drag-and-drop layout tool for the Depop shop profile.',
        icon: 'layout',
        on: 'depop',
      },
    ],
  },
  {
    number: '03',
    title: 'Visibility & audience',
    blurb:
      'Keep listings near the top of search and bring relevant users to your shop. Refresh runs on a schedule you set; the follow bot has five ways to target the right accounts.',
    items: [
      {
        label: 'Listing refresher',
        detail: 'Re-saves listings bottom-up so your shop order is preserved.',
        icon: 'refresh',
        on: 'depop',
      },
      {
        label: 'Auto-refresh scheduler',
        detail: 'Runs on 4, 6, 8, 12 or 24-hour intervals via chrome.alarms.',
        icon: 'clock',
        on: 'depop',
      },
      {
        label: 'Follow / unfollow bot',
        detail: 'Target a user\u2019s followers, following, your buyers, review-givers or likers.',
        icon: 'users',
        on: 'both',
      },
      {
        label: 'Blacklist and whitelist',
        detail: 'Case-insensitive matching so specific accounts are always skipped or always kept.',
        icon: 'filter',
        on: 'both',
      },
    ],
  },
  {
    number: '04',
    title: 'Sales & messaging',
    blurb:
      'Offers, buyer messages and shipping labels in one inbox across both marketplaces. Rules handle the repetitive replies so you only touch the conversations that matter.',
    items: [
      {
        label: 'Unified offers inbox',
        detail: 'Accept, decline or counter offers from both marketplaces in one place.',
        icon: 'tag',
        on: 'both',
      },
      {
        label: 'Auto-offers',
        detail: 'Rule-based counter or accept replies on incoming offers.',
        icon: 'zap',
        on: 'both',
      },
      {
        label: 'Unified messages',
        detail: 'Conversations inbox that merges Depop and Vinted threads.',
        icon: 'message',
        on: 'both',
      },
      {
        label: 'Shipping labels',
        detail: 'Download and merge PDF labels for batched fulfilment.',
        icon: 'box',
        on: 'both',
      },
      {
        label: 'Relister',
        detail: 'Recreate listings with tweaked photos and title, then delete the original to refresh search visibility.',
        icon: 'rotate',
        on: 'both',
      },
    ],
  },
  {
    number: '05',
    title: 'Safety & reliability',
    blurb:
      'Everything runs in your own browser session, not a cloud worker pretending to be you. Delays, break patterns and rate-limit handling are tuned to look like a human using the site.',
    items: [
      {
        label: 'Log-normal delay distribution',
        detail: 'Warm-up, fatigue curve and micro-breaks; not uniform intervals.',
        icon: 'wave',
        on: 'both',
      },
      {
        label: 'Tiered rate-limit handling',
        detail: 'Back off on 429, stop immediately on 403; respects session time caps.',
        icon: 'shield',
        on: 'both',
      },
      {
        label: 'Dead-stock detector',
        detail: 'Classifies stale listings and suggests actions.',
        icon: 'search',
        on: 'both',
      },
      {
        label: 'Multi-language UI',
        detail: 'English, French, Spanish and German, with light and dark themes.',
        icon: 'globe',
        on: 'both',
      },
      {
        label: 'Real-time activity log',
        detail: 'Filter by feature or level, pause and stop at any time, export to JSON.',
        icon: 'list',
        on: 'both',
      },
    ],
  },
];

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

function MarketplaceBadge({ on }: { on: Marketplace }) {
  if (on === 'both') return null;
  return (
    <span
      className={`${MONO} ml-2 inline-block shrink-0 rounded border border-black/10 px-1.5 py-0.5 text-zinc-600 dark:border-white/15 dark:text-zinc-400`}
    >
      {on} only
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className={`${MONO} text-zinc-500`}>{children}</span>;
}

export default function FeaturesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-16 sm:pt-28 sm:pb-20">
        <Eyebrow>Features</Eyebrow>
        <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Everything you need to sell on Depop and Vinted, in one extension.
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Crosslist listings, refresh your shop, auto-reply to offers, follow
          buyers and ship, all from a single panel that sits on top of the
          marketplace you&rsquo;re already using.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Install extension
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* At a glance */}
      <section className="border-y border-black/10 py-8 dark:border-white/10">
        <dl className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <dt className={`${MONO} text-zinc-500`}>Works with</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight">
              Depop &amp; Vinted
            </dd>
          </div>
          <div>
            <dt className={`${MONO} text-zinc-500`}>Vinted regions</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight">
              20 countries
            </dd>
          </div>
          <div>
            <dt className={`${MONO} text-zinc-500`}>How it runs</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight">
              Inside your browser
            </dd>
          </div>
        </dl>
      </section>

      {/* Chapters */}
      <section className="pt-16 pb-8">
        {CHAPTERS.map((chapter, i) => (
          <article
            key={chapter.number}
            className={`grid grid-cols-1 gap-10 border-t border-black/10 py-16 md:grid-cols-12 md:gap-12 dark:border-white/10 ${
              i === 0 ? 'border-t-0 pt-0' : ''
            }`}
          >
            <header
              className={`md:col-span-5 ${
                i % 2 === 1 ? 'md:order-2 md:col-start-8' : ''
              }`}
            >
              <Eyebrow>{chapter.number}</Eyebrow>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                {chapter.title}
              </h2>
              <p className="mt-6 text-base text-zinc-600 dark:text-zinc-400">
                {chapter.blurb}
              </p>
            </header>
            <ul
              className={`space-y-5 md:col-span-6 ${
                i % 2 === 1 ? 'md:order-1 md:col-start-1' : 'md:col-start-7'
              }`}
            >
              {chapter.items.map((item) => (
                <li key={item.label} className="flex gap-4">
                  <span className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                    <Icon name={item.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline">
                      <span className="font-medium">{item.label}</span>
                      <MarketplaceBadge on={item.on} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      {/* CTA footer */}
      <section className="border-t border-black/10 py-24 text-center dark:border-white/10">
        <Eyebrow>Ready when you are</Eyebrow>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Start in the browser you already sell from.
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Get started
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-6 text-sm text-zinc-500">
          Per-tier limits and feature gating live on the{' '}
          <Link href="/pricing" className="underline underline-offset-4">
            pricing page
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
