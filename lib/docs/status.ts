import type { Marketplace, MarketplaceStatus, StatusState } from './types';

const STATUS_SOURCE: MarketplaceStatus[] = [
  {
    marketplace: 'depop',
    state: 'ok',
    updatedAt: '2026-04-21',
  },
  {
    marketplace: 'vinted',
    state: 'ok',
    updatedAt: '2026-04-21',
  },
];

export async function getMarketplaceStatus(): Promise<MarketplaceStatus[]> {
  return STATUS_SOURCE;
}

export async function getMarketplaceStatusFor(
  marketplace: Marketplace,
): Promise<MarketplaceStatus | undefined> {
  const all = await getMarketplaceStatus();
  return all.find((s) => s.marketplace === marketplace);
}

export const STATE_META: Record<
  StatusState,
  { label: string; dot: string; badge: string }
> = {
  ok: {
    label: 'Operational',
    dot: 'bg-emerald-500',
    badge:
      'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    badge:
      'border-amber-500/30 bg-amber-500/[0.08] text-amber-700 dark:text-amber-400',
  },
  down: {
    label: 'Outage',
    dot: 'bg-rose-500',
    badge:
      'border-rose-500/30 bg-rose-500/[0.08] text-rose-700 dark:text-rose-400',
  },
};

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  depop: 'Depop',
  vinted: 'Vinted',
};
