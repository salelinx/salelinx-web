import { Breadcrumbs } from '@/components/docs/Breadcrumbs';
import { formatChangelogDate, listChangelog } from '@/lib/docs/changelog';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export const metadata = {
  title: 'Changelog - SaleLinx docs',
  description: 'What changed in recent releases of the SaleLinx extension.',
};

export default function ChangelogPage() {
  const entries = listChangelog();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Breadcrumbs
        trail={[
          { label: 'Docs', href: '/docs' },
          { label: 'Changelog' },
        ]}
      />
      <header className="mt-8">
        <span className={`${MONO} text-zinc-500`}>Changelog</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          What&rsquo;s new in SaleLinx
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Release notes for the SaleLinx extension. The newest entry is at the
          top.
        </p>
      </header>

      <div className="mt-12 space-y-16">
        {entries.map(({ metadata, default: Body }) => (
          <section
            key={metadata.date}
            className="border-t border-black/10 pt-10 dark:border-white/10"
          >
            <span className={`${MONO} text-zinc-500`}>
              {formatChangelogDate(metadata.date)}
            </span>
            <div className="mt-2">
              <Body />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
