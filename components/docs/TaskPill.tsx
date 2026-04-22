import { Link } from '@/i18n/navigation';

export type TaskPillProps = {
  label: string;
  href: string;
};

export function TaskPill({ label, href }: TaskPillProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm text-zinc-700 transition hover:border-black/30 hover:bg-black hover:text-white dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-white/40 dark:hover:bg-white dark:hover:text-black"
    >
      {label}
    </Link>
  );
}
