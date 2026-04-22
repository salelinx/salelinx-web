import Link from 'next/link';
import { SectionNav } from '@/components/features/SectionNav';
import { FeaturesSection } from '@/components/features/FeaturesSection';
import { PricingSection } from '@/components/features/PricingSection';
import { RoadmapSection } from '@/components/features/RoadmapSection';
import { getTierConfigs } from '@/lib/supabase/tier-config';

export const revalidate = 60;

export const metadata = {
  title: 'SaleLinx - Product, pricing, roadmap',
  description:
    'Everything the SaleLinx Chrome extension does, what it costs, and what is coming next. Crosslist, relist, refresh, and restock across Depop and Vinted from one panel.',
};

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export default async function FeaturesPage() {
  const tiers = await getTierConfigs();

  return (
    <main>
      <section className="mx-auto w-full max-w-7xl px-6 pt-20 pb-20 sm:pt-28 sm:pb-24">
        <span className={`${MONO} text-zinc-500`}>The whole product, one page</span>
        <h1 className="mt-6 max-w-5xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          The product, the price, and the roadmap.
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Scroll for the features, jump to pricing when you&rsquo;re ready, or
          skim the roadmap to see what we&rsquo;re shipping next. The tabs
          follow you down the page.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Install extension
          </Link>
          <a
            href="#pricing"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            See pricing
          </a>
        </div>
      </section>

      <SectionNav />

      <div className="mx-auto w-full max-w-7xl px-6">
        <FeaturesSection />
        <PricingSection tiers={tiers} />
        <RoadmapSection />

        <section className="border-t border-black/10 py-24 text-center dark:border-white/10">
          <span className={`${MONO} text-zinc-500`}>Ready when you are</span>
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
            <a
              href="#pricing"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
            >
              See pricing
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
