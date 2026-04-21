import Link from 'next/link';
import type { Marketplace } from '@/lib/docs/types';
import { MARKETPLACE_LABELS } from '@/lib/docs/status';

const MARKETPLACES: Marketplace[] = [
  'depop',
  'vinted',
  'ebay',
  'mercari',
  'poshmark',
  'etsy',
];

export function MarketplaceLogoRow() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {MARKETPLACES.map((m) => (
        <Link
          key={m}
          href={`/docs/status#${m}`}
          className="flex items-center justify-center rounded-lg border border-black/10 bg-white py-4 text-sm font-medium tracking-tight text-zinc-700 transition hover:border-black/30 hover:text-black dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-white/30 dark:hover:text-white"
        >
          {MARKETPLACE_LABELS[m]}
        </Link>
      ))}
    </div>
  );
}
