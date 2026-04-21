import Link from 'next/link';
import { Icon } from '@/components/Icon';

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400"
    >
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="hover:text-black dark:hover:text-white"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-black dark:text-white' : ''}>
                {crumb.label}
              </span>
            )}
            {!isLast ? (
              <Icon name="arrow-right" className="h-3.5 w-3.5 text-zinc-400" />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
