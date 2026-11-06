import Image from 'next/image';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

const SHOTS = {
  crosslist: 'The SaleLinx Crosslist tab: a grid of listings ticked for copying to another marketplace.',
  listings: 'The SaleLinx My Listings tab: Depop, Vinted and eBay listings in one table with price, views and likes.',
  deadstock: 'The SaleLinx Dead Stock tab: the value stuck in unsold stock and the listings with the least engagement.',
  shipping: 'The SaleLinx Labels tab: sold Depop and Vinted orders waiting to ship, ready to print as one PDF.',
  offers: 'The SaleLinx Offers tab: a pending offer showing the asking price, the offer and the discount, with Accept, Decline and Counter.',
  relist: 'The SaleLinx Relist tab: listings picked to relist as fresh copies.',
  linking: 'The SaleLinx Linking tab: the same item matched across Depop, Vinted and eBay.',
  automarkdown: 'The SaleLinx Price Drops tab: listings picked for gradual price drops with a floor.',
  designer: 'The SaleLinx Shop Designer: a Depop shop layout previewed on mobile and desktop.',
  conversations: 'The SaleLinx Messages tab: buyer messages from every marketplace in one inbox, names blurred.',
} as const;

export function SaleLinxHelps({ shot, children }: { shot: keyof typeof SHOTS; children: ReactNode }) {
  return (
    <section
      aria-labelledby="salelinx-helps"
      className="my-12 rounded-2xl border border-black/10 bg-zinc-50 p-6 sm:p-8 dark:border-white/15 dark:bg-white/[0.03]"
    >
      <h2
        id="salelinx-helps"
        className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        <Image src="/salelinx-logo.png" alt="" width={21} height={28} className="h-8 w-auto dark:invert" />
        How SaleLinx helps
      </h2>
      <Image
        src={`/blog/panel/${shot}.webp`}
        alt={SHOTS[shot]}
        width={3840}
        height={2160}
        quality={90}
        sizes="(max-width: 768px) 100vw, 672px"
        className="mt-6 h-auto w-full rounded-lg border border-black/10 shadow-xl dark:border-white/10"
      />
      {children}
      <Link
        href="/pricing"
        className="mt-2 inline-block rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Try it free for 14 days
      </Link>
    </section>
  );
}
