import { DocsSearch } from '@/components/docs/DocsSearch';
import { TaskPill } from '@/components/docs/TaskPill';
import { CategoryCard } from '@/components/docs/CategoryCard';
import { StatusCard } from '@/components/docs/StatusCard';
import { MarketplaceLogoRow } from '@/components/docs/MarketplaceLogoRow';
import { WhatsNewStrip } from '@/components/docs/WhatsNewStrip';
import { DocsFAQLink } from '@/components/docs/DocsFAQLink';
import { CATEGORIES } from '@/lib/docs/categories';
import { getArticleCountByCategory } from '@/lib/docs/getArticle';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

const TASK_PILLS = [
  { label: 'Install the extension', href: '/docs/getting-started/install-the-extension' },
  { label: 'Connect a marketplace', href: '/docs/getting-started/connect-your-first-marketplace' },
  { label: 'Crosslist your first item', href: '/docs/crosslisting/crosslist-your-first-item' },
  { label: 'Manage your inventory', href: '/docs/listings/manage-inventory' },
];

export default function DocsHomePage() {
  const counts = getArticleCountByCategory();

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <section className="pt-20 pb-12 sm:pt-24">
        <span className={`${MONO} text-zinc-500`}>Docs</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Learn SaleLinx.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Step-by-step guides and walkthroughs for the SaleLinx Chrome
          extension. For quick answers to common questions, head to the{' '}
          <a href="/faq" className="underline underline-offset-4">
            FAQ
          </a>
          .
        </p>

        <div className="mt-10 max-w-3xl">
          <DocsSearch />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {TASK_PILLS.map((pill) => (
            <TaskPill key={pill.href} {...pill} />
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Browse by topic
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.slug}
              category={category}
              articleCount={counts[category.slug]}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <div className="mb-6">
          <span className={`${MONO} text-zinc-500`}>By marketplace</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Find help for a specific platform
          </h2>
        </div>
        <MarketplaceLogoRow />
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <StatusCard />
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <WhatsNewStrip />
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <DocsFAQLink />
      </section>
    </main>
  );
}
