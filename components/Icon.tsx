import type { ReactNode } from 'react';

export type IconName =
  | 'grid'
  | 'link'
  | 'lock'
  | 'sync'
  | 'swap'
  | 'tree'
  | 'upload'
  | 'layout'
  | 'refresh'
  | 'clock'
  | 'users'
  | 'filter'
  | 'tag'
  | 'zap'
  | 'message'
  | 'box'
  | 'rotate'
  | 'wave'
  | 'shield'
  | 'search'
  | 'globe'
  | 'list'
  | 'cloud'
  | 'x';

const ICON_PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
      <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1" />
    </>
  ),
  sync: (
    <>
      <rect x="3" y="4" width="13" height="9" rx="1.5" />
      <rect x="10" y="12" width="11" height="8" rx="1.5" />
    </>
  ),
  swap: (
    <>
      <path d="M7 7h12l-3-3" />
      <path d="M17 17H5l3 3" />
    </>
  ),
  tree: (
    <>
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 6h5a5 5 0 0 1 5 4M7 18h5a5 5 0 0 0 5-4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 9h18M9 9v12" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15.6 6.1" />
      <path d="M3 12a9 9 0 0 1 15.6-6.1" />
      <path d="m18 3 .6 4.1-4.1.6" />
      <path d="m6 21-.6-4.1 4.1-.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M15 6.5a3 3 0 0 1 0 5.5" />
      <path d="M17 20c0-2.5 1.3-4.6 4-5.6" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
  zap: <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />,
  message: (
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5A8 8 0 1 1 21 12Z" />
  ),
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8 12 13l9-5" />
      <path d="M12 13v8" />
    </>
  ),
  rotate: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  wave: (
    <path d="M3 12c2 0 2-6 4-6s2 12 4 12 2-10 4-10 2 8 4 8 2-4 2-4" />
  ),
  shield: (
    <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 4 6 4 9s-1.2 6-4 9c-2.8-3-4-6-4-9s1.2-6 4-9Z" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  cloud: (
    <path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8H7Z" />
  ),
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
};

export function Icon({
  name,
  className = 'h-5 w-5 shrink-0',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
