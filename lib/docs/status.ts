import type { Marketplace, MarketplaceStatus, StatusState } from './types';
import { loadStatusOverrides } from './feature-status';

// Baseline shown when no manual override exists. Marketplaces have no automatic
// signal of their own - unlike features, there is no "the whole of Vinted is
// failing" measurement, only per-endpoint telemetry that the feature rollup
// already surfaces - so the default is operational and a real outage is
// declared by an admin in /admin/health (011_status_overrides.sql).
//
// This replaces the hardcoded table this file used to carry; the migration path
// noted in earlier versions is now taken.
const DEFAULT_STATUS: MarketplaceStatus[] = [
  { marketplace: 'depop', state: 'ok', updatedAt: '2026-04-21' },
  { marketplace: 'vinted', state: 'ok', updatedAt: '2026-04-21' },
];

export async function getMarketplaceStatus(): Promise<MarketplaceStatus[]> {
  const overrides = await loadStatusOverrides();

  return DEFAULT_STATUS.map((base) => {
    const override = overrides.get(`platform:${base.marketplace}`);
    if (!override) return base;
    return {
      ...base,
      state: override.state,
      note: override.note ?? undefined,
      // Show when the override was set, not the constant's stale date.
      updatedAt: override.updated_at.slice(0, 10),
    };
  });
}

export async function getMarketplaceStatusFor(
  marketplace: Marketplace,
): Promise<MarketplaceStatus | undefined> {
  const all = await getMarketplaceStatus();
  return all.find((s) => s.marketplace === marketplace);
}

export const STATE_META: Record<
  StatusState,
  { dot: string; badge: string }
> = {
  ok: {
    dot: 'bg-emerald-500',
    badge:
      'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400',
  },
  degraded: {
    dot: 'bg-amber-500',
    badge:
      'border-amber-500/30 bg-amber-500/[0.08] text-amber-700 dark:text-amber-400',
  },
  down: {
    dot: 'bg-rose-500',
    badge:
      'border-rose-500/30 bg-rose-500/[0.08] text-rose-700 dark:text-rose-400',
  },
};

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  depop: 'Depop',
  vinted: 'Vinted',
};
