import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { formatChangelogDate, getRecentChangelog } from '@/lib/docs/changelog';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function WhatsNewStrip() {
  const entries = getRecentChangelog(3);
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <span className={`${MONO} text-zinc-500`}>What&rsquo;s new</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Recent changes
          </h2>
        </div>
        <Link
          href="/docs/changelog"
          className="hidden items-center gap-1.5 text-sm text-zinc-700 hover:text-black sm:inline-flex dark:text-zinc-300 dark:hover:text-white"
        >
          Full changelog
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {entries.map((entry) => (
          <li key={entry.date}>
            <Link
              href="/docs/changelog"
              className="group flex items-start justify-between gap-6 py-5"
            >
              <div className="min-w-0">
                <span className={`${MONO} text-zinc-500`}>
                  {formatChangelogDate(entry.date)}
                </span>
                <h3 className="mt-2 text-base font-medium tracking-tight group-hover:underline">
                  {entry.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.summary}
                </p>
              </div>
              <Icon
                name="arrow-right"
                className="mt-2 h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-black dark:group-hover:text-white"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
