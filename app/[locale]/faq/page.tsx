import Link from 'next/link';
import { FAQList } from '@/components/faq/FAQList';
import { SupportCard } from '@/components/docs/SupportCard';
import { Icon } from '@/components/Icon';
import { FAQ_GROUPS } from '@/lib/faq/data';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export const metadata = {
  title: 'FAQ - SaleLinx',
  description:
    'Quick answers to common questions about SaleLinx: billing, account, troubleshooting, privacy.',
};

export default function FAQPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6">
      <section className="pt-20 pb-10 sm:pt-24">
        <span className={`${MONO} text-zinc-500`}>FAQ</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Frequently asked questions.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Quick answers to the questions we hear most. Looking for a full
          walkthrough instead?{' '}
          <Link href="/docs" className="underline underline-offset-4">
            Browse the docs
          </Link>
          .
        </p>

        <nav className="mt-8 flex flex-wrap gap-2">
          {FAQ_GROUPS.map((g) => (
            <a
              key={g.slug}
              href={`#${g.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm text-zinc-700 transition hover:border-black/30 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-white/40"
            >
              {g.title}
              <span className="text-xs text-zinc-500">{g.items.length}</span>
            </a>
          ))}
        </nav>
      </section>

      <section className="pb-16">
        <FAQList groups={FAQ_GROUPS} />
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <SupportCard />
      </section>

      <section className="border-t border-black/10 py-10 dark:border-white/10">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 text-sm text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
        >
          <Icon name="book" className="h-4 w-4" />
          Looking for step-by-step guides? Browse the docs
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
