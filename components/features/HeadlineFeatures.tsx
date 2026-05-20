import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon, type IconName } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';
import { BrandWordmark } from '@/components/BrandWordmark';

const BRAND_TAGS = {
  depop: () => <BrandWordmark brand="depop" height="0.95em" />,
  vinted: () => <BrandWordmark brand="vinted" height="0.95em" />,
};

type AccentId = 'violet' | 'emerald' | 'sky' | 'amber' | 'rose' | 'fuchsia';

type HeadlineId =
  | 'crosslist'
  | 'relist'
  | 'restocker'
  | 'oneInbox'
  | 'labels';

type Headline = {
  id: HeadlineId;
  icon: IconName;
  accent: AccentId;
  href: string;
  /** Tailwind column-span class for the md+ 6-column grid. */
  span: string;
};

// Layout: 3 cards top row (col-span-2 each), 2 cards bottom row (col-span-3
// each). Order matches the marketing priority Lewis asked for: crosslist,
// refresh/relist, restocker, offers + messages, labels.
const HEADLINES: Headline[] = [
  {
    id: 'crosslist',
    icon: 'crosslist-arrows',
    accent: 'violet',
    href: '/docs/inventory/crosslist',
    span: 'md:col-span-2',
  },
  {
    id: 'relist',
    icon: 'relist',
    accent: 'emerald',
    href: '/docs/inventory/relist',
    span: 'md:col-span-2',
  },
  {
    id: 'restocker',
    icon: 'cube',
    accent: 'fuchsia',
    href: '/docs/automate/restocker',
    span: 'md:col-span-2',
  },
  {
    id: 'oneInbox',
    icon: 'chat-bubble',
    accent: 'amber',
    href: '/docs/buyers/messages',
    span: 'md:col-span-3',
  },
  {
    id: 'labels',
    icon: 'truck',
    accent: 'rose',
    href: '/docs/buyers/labels',
    span: 'md:col-span-3',
  },
];

const ACCENT: Record<
  AccentId,
  {
    bar: string;
    iconHover: string;
    glow: string;
    pill: string;
  }
> = {
  violet: {
    bar: 'from-violet-400/70 via-violet-500/40 to-transparent',
    iconHover: 'group-hover:text-violet-500 dark:group-hover:text-violet-400',
    glow: 'bg-violet-500/10 dark:bg-violet-400/15',
    pill: 'text-violet-600 dark:text-violet-300',
  },
  emerald: {
    bar: 'from-emerald-400/70 via-emerald-500/40 to-transparent',
    iconHover: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400',
    glow: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    pill: 'text-emerald-600 dark:text-emerald-300',
  },
  sky: {
    bar: 'from-sky-400/70 via-sky-500/40 to-transparent',
    iconHover: 'group-hover:text-sky-500 dark:group-hover:text-sky-400',
    glow: 'bg-sky-500/10 dark:bg-sky-400/15',
    pill: 'text-sky-600 dark:text-sky-300',
  },
  amber: {
    bar: 'from-amber-400/70 via-amber-500/40 to-transparent',
    iconHover: 'group-hover:text-amber-500 dark:group-hover:text-amber-400',
    glow: 'bg-amber-500/10 dark:bg-amber-400/15',
    pill: 'text-amber-600 dark:text-amber-300',
  },
  rose: {
    bar: 'from-rose-400/70 via-rose-500/40 to-transparent',
    iconHover: 'group-hover:text-rose-500 dark:group-hover:text-rose-400',
    glow: 'bg-rose-500/10 dark:bg-rose-400/15',
    pill: 'text-rose-600 dark:text-rose-300',
  },
  fuchsia: {
    bar: 'from-fuchsia-400/70 via-fuchsia-500/40 to-transparent',
    iconHover: 'group-hover:text-fuchsia-500 dark:group-hover:text-fuchsia-400',
    glow: 'bg-fuchsia-500/10 dark:bg-fuchsia-400/15',
    pill: 'text-fuchsia-600 dark:text-fuchsia-300',
  },
};

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function HeadlineFeatures() {
  const t = await getTranslations('Features.headlines');

  return (
    <div className="pt-16 pb-4">
      <Reveal as="div" className="pb-10">
        <span className={`${MONO} text-zinc-500`}>{t('eyebrow')}</span>
        <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {t('title')}
        </h2>
        <p className="mt-5 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          {t('description')}
        </p>
      </Reveal>

      <Reveal
        as="ul"
        className="cascade-list grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-6"
      >
        {HEADLINES.map((item, idx) => {
          const accent = ACCENT[item.accent];
          return (
            <li
              key={item.id}
              className={`cascade-item ${item.span}`}
              style={
                {
                  '--stagger-delay': `${Math.min(idx * 80, 400)}ms`,
                } as CSSProperties
              }
            >
              <Link
                href={item.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/40 p-7 transition-colors hover:border-black/15 hover:bg-black/[0.02] dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent.bar}`}
                  aria-hidden
                />

                <span
                  className={`relative flex h-12 w-12 items-center justify-center rounded-xl text-zinc-700 transition-colors dark:text-zinc-200 ${accent.iconHover}`}
                >
                  <span
                    className={`absolute inset-0 rounded-xl ${accent.glow}`}
                    aria-hidden
                  />
                  <span className="relative">
                    <Icon name={item.icon} />
                  </span>
                </span>

                <span className={`mt-6 block ${MONO} ${accent.pill}`}>
                  {t(`items.${item.id}.short`)}
                </span>
                <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                  {t.rich(`items.${item.id}.title`, BRAND_TAGS)}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(`items.${item.id}.body`)}
                </p>

                <div className="mt-6 flex items-center gap-3 pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.rich(`items.${item.id}.works`, BRAND_TAGS)}
                  </span>
                  <span
                    className="ml-auto text-sm text-zinc-500 transition-transform group-hover:translate-x-0.5 dark:text-zinc-400"
                    aria-hidden
                  >
                    {t('learnMore')} {'->'}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </Reveal>
    </div>
  );
}
