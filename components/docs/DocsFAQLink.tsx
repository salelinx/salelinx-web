import Link from 'next/link';
import { Icon } from '@/components/Icon';

export function DocsFAQLink() {
  return (
    <Link
      href="/faq"
      className="group flex items-center justify-between gap-6 rounded-xl border border-black/10 bg-white p-6 transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/30"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
          <Icon name="message" />
        </span>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Looking for a quick answer?
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Billing, troubleshooting, privacy, and common one-offs live in the
            FAQ.
          </p>
        </div>
      </div>
      <Icon
        name="arrow-right"
        className="shrink-0 text-zinc-400 transition group-hover:text-black dark:group-hover:text-white"
      />
    </Link>
  );
}
