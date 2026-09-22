import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PricingSection } from '@/components/features/PricingSection';
import { getCachedTierConfigs } from '@/lib/supabase/tier-config';
import { pageMetadata } from '@/lib/site';

// Google Ads landing page for the competitor keywords. English-only body for
// the same reason as /crosslist.
//
// There is deliberately no feature-by-feature comparison table. Every claim
// about a competitor's features or prices is a claim we have to keep true as
// they change it, and a stale one is both a bad look and a legal risk. The
// page sells what SaleLinx is and says plainly who it does not suit, which
// converts better than a table nobody believes anyway. If a table is wanted
// later, every row needs a dated source.

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/vendoo-alternative',
    title: 'A crosslister built for Depop and Vinted',
    description:
      'Looking for a crosslisting tool for Depop and Vinted? SaleLinx does those two marketplaces properly, in pounds, from a UK company. See if it suits you.',
    contentLocales: ['en'],
  });
}

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

const REASONS = [
  {
    title: 'Two marketplaces, done properly',
    body: 'Depop and Vinted only. Categories, sizes and condition map between them because there are two sets of rules to get right, not twelve.',
  },
  {
    title: 'Sold in one place, gone from the other',
    body: 'The restocker pulls the item from the other shop within the minute, so two buyers cannot pay for the same thing.',
  },
  {
    title: 'Priced in pounds',
    body: 'UK sellers are billed in pounds rather than converted from dollars. Euro and dollar pricing exist too, picked from where you are.',
  },
  {
    title: 'A UK company',
    body: 'SaleLinx Ltd is registered in England and Wales, so your contract, your data terms and your support are all under UK law.',
  },
];

const SUITS = [
  'You sell on both Depop and Vinted, or you want to start.',
  'You list from a computer rather than only from your phone.',
  'You are tired of typing the same item into two forms.',
];

const DOES_NOT_SUIT = [
  'You sell mainly on eBay, Poshmark, Mercari or Etsy. SaleLinx does not touch those, and a general crosslister will serve you better.',
  'You only ever list from a phone. SaleLinx is a desktop Chrome extension.',
  'You want a single tool for a dozen marketplaces. That is not what this is.',
];

export default async function VendooAlternativePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tiers = await getCachedTierConfigs();

  return (
    <main>
      <section className="mx-auto w-full max-w-7xl px-6 pt-20 pb-6 text-center sm:pt-28 sm:pb-8">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>Alternatives</span>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          A crosslister built for Depop and Vinted.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Most crosslisting tools spread themselves across a dozen marketplaces. SaleLinx does two,
          and does the awkward parts properly: category mapping, size mapping, and taking the item
          down from the other shop the moment it sells.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Get started
          </Link>
          <a
            href="#pricing"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            See pricing
          </a>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6">
        <section className="border-t border-black/10 py-20 dark:border-white/10">
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>Why people pick it</span>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Narrow on purpose.
          </h2>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2">
            {REASONS.map((item) => (
              <li key={item.title}>
                <h3 className="text-xl font-medium">{item.title}</h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-black/10 py-20 dark:border-white/10">
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>Honestly</span>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Whether this is the right tool for you.
          </h2>
          <div className="mt-12 grid gap-12 sm:grid-cols-2">
            <div>
              <h3 className="text-xl font-medium">It suits you if</h3>
              <ul className="mt-4 space-y-3 text-zinc-600 dark:text-zinc-400">
                {SUITS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-medium">Look elsewhere if</h3>
              <ul className="mt-4 space-y-3 text-zinc-600 dark:text-zinc-400">
                {DOES_NOT_SUIT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <PricingSection tiers={tiers} />

        <section className="border-t border-black/10 py-20 text-center dark:border-white/10">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Try it on your own shops.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-zinc-600 dark:text-zinc-400">
            Fourteen days free on Starter to see how it handles your own listings. A card is taken
            when the trial starts, and it becomes a paid Starter plan on day fifteen unless you
            cancel before then.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Get started
            </Link>
            <Link
              href="/features"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
            >
              See all features
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
