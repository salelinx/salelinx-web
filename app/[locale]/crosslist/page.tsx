import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PricingSection } from '@/components/features/PricingSection';
import { getCachedTierConfigs } from '@/lib/supabase/tier-config';
import { pageMetadata } from '@/lib/site';

// Google Ads landing page for the crosslisting keywords. Body and metadata
// are hardcoded English like the legal pages: the campaign targets the UK in
// English, so a translated variant would never be served. /features stays the
// product overview; this page answers one query and nothing else, because
// landing page experience is scored on how well the page matches the search.

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/crosslist',
    title: 'Crosslist Depop and Vinted',
    description:
      'Post one listing to both Depop and Vinted in a click, and pull it from the other shop the moment it sells. A Chrome extension for UK resellers.',
    contentLocales: ['en'],
  });
}

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

const STEPS = [
  {
    title: 'Install the extension',
    body: 'SaleLinx adds a panel to Chrome on your computer. Sign in once with your Depop and Vinted accounts already open.',
  },
  {
    title: 'Pick a listing, hit crosslist',
    body: "The other marketplace's form fills itself in. Categories, sizes and condition are mapped across, so you are not retyping the same item twice.",
  },
  {
    title: 'Let it keep both shops in step',
    body: 'When something sells on Depop, SaleLinx removes it from Vinted in the same minute. It works the other way round too.',
  },
];

const INCLUDED = [
  {
    title: 'Crosslist',
    body: 'One listing, both marketplaces, with categories and sizes mapped instead of retyped.',
  },
  {
    title: 'Restocker',
    body: 'Sold on one shop, pulled from the other in the same minute, so you never sell the same item twice.',
  },
  {
    title: 'Relist',
    body: 'Recreate tired listings with tweaked photos and titles, then delete the originals so they climb back up the search results.',
  },
  {
    title: 'Unified inbox',
    body: 'Every offer and buyer message from both shops in one list, with rules to auto accept or counter.',
  },
  {
    title: 'Shipping labels',
    body: 'Merge a whole day of label PDFs into one file and run them through the printer in one go.',
  },
];

const FAQ = [
  {
    q: 'What does crosslisting mean?',
    a: 'On resale marketplaces it means listing the same item in more than one place at once, so it gets seen by both audiences. SaleLinx does that between Depop and Vinted, and takes the item down from the other shop when it sells.',
  },
  {
    q: 'Which marketplaces does it support?',
    a: 'Depop and Vinted. SaleLinx is built for those two rather than spread thinly across a dozen, which is why the category and size mapping between them actually works.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'Yes, SaleLinx is a Chrome extension and it runs on a desktop or laptop browser. There is no phone app, because the marketplace pages it works with are the desktop ones.',
  },
  {
    q: 'What happens when an item sells?',
    a: 'The restocker removes it from the other marketplace within the minute, so two buyers cannot pay for the same thing.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Fourteen days free on the Starter plan. You add a card when you start it, and on day fifteen it becomes a paid Starter subscription unless you cancel before then.',
  },
];

export default async function CrosslistPage({
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
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>Depop and Vinted</span>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          Crosslist between Depop and Vinted in one click.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          List an item once and SaleLinx fills in the other marketplace for you, then pulls it down
          the moment it sells. A Chrome extension for people running both shops.
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
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>How it works</span>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Three steps, then it runs on its own.
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className={`${MONO} text-zinc-500 dark:text-zinc-500`}>
                  Step 0{i + 1}
                </span>
                <h3 className="mt-3 text-xl font-medium">{step.title}</h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-black/10 py-20 dark:border-white/10">
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>What you get</span>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The boring half of running two shops.
          </h2>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item) => (
              <li key={item.title}>
                <h3 className="text-xl font-medium">{item.title}</h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/features"
            className="mt-10 inline-block text-sm underline underline-offset-4"
          >
            See everything SaleLinx does
          </Link>
        </section>

        <PricingSection tiers={tiers} />

        <section className="border-t border-black/10 py-20 dark:border-white/10">
          <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>Questions</span>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Before you install.
          </h2>
          <dl className="mt-12 grid gap-8 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-xl font-medium">{item.q}</dt>
                <dd className="mt-2 text-zinc-600 dark:text-zinc-400">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-black/10 py-20 text-center dark:border-white/10">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop listing everything twice.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Get started
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
