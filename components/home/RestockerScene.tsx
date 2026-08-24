'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { BrandWordmark } from '@/components/BrandWordmark';
import { ProductImage } from './ProductImage';

/**
 * Restocker scene.
 *
 * The panel this replaces buried the idea in a list of rows: a banner said
 * "Relisting on Vinted", which reads as the opposite of what the feature does
 * (the copy promises it *removes* the item so you can't oversell). This shows
 * the actual mechanic instead: one item, listed on both shops, and the two
 * stock counts staying equal as sales land on either side. When the count
 * reaches zero it comes off sale on both, which is the oversell that didn't
 * happen.
 */

const TICK_MS = 100;
const CYCLE = 62; // 6.2s per sale

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

const START_STOCK = 3;

function ShopCard({
  brand,
  stock,
  justSold,
  syncing,
}: {
  brand: 'depop' | 'vinted';
  stock: number;
  justSold: boolean;
  syncing: boolean;
}) {
  const soldOut = stock === 0;
  return (
    <div
      className={`relative flex flex-col gap-3 rounded-xl border bg-white p-4 transition-colors duration-300 dark:bg-white/[0.02] ${
        justSold
          ? 'border-emerald-500/50 bg-emerald-500/[0.04] dark:border-emerald-400/50'
          : syncing
            ? 'border-emerald-500/30 dark:border-emerald-400/30'
            : 'border-black/[0.08] dark:border-white/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <BrandWordmark
          brand={brand}
          variant="wordmark"
          height={brand === 'depop' ? '0.85em' : '1em'}
        />
        {justSold ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-[2px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">
            Sold
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <ProductImage
          type="tee"
          hue={220}
          src="/products/star-beanie.jpg"
          className={`size-12 flex-shrink-0 rounded-md transition-opacity duration-500 ${
            soldOut ? 'opacity-40' : 'opacity-100'
          }`}
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
            Star beanie
          </div>
          <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">GBP 22.00</div>
        </div>
      </div>

      {/* The number that matters. Both cards hold the same value at rest, so
          the sync is legible without reading any label. */}
      <div
        className={`flex items-baseline gap-1.5 rounded-lg px-3 py-2 transition-colors duration-300 ${
          soldOut
            ? 'bg-zinc-900/[0.04] dark:bg-white/[0.06]'
            : 'bg-emerald-500/[0.08]'
        }`}
      >
        {soldOut ? (
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-400">
            Off sale
          </span>
        ) : (
          <>
            <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {stock}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-400">
              in stock
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function RestockerScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const cycle = Math.floor(tick / CYCLE);
  const inCycle = tick % CYCLE;

  // Three sales drain the stock, then it restocks and the loop repeats.
  const step = cycle % (START_STOCK + 1);
  const stockBefore = START_STOCK - step;
  // Sales alternate between the two shops so neither reads as "the main one".
  const soldOn: 'depop' | 'vinted' = step % 2 === 0 ? 'depop' : 'vinted';

  // Phases within a cycle: rest, the sale landing, then the other shop
  // catching up. Reduced motion holds the settled state, which is the frame
  // that carries the story anyway.
  type Phase = 'rest' | 'sold' | 'synced';
  const phase: Phase = reduced
    ? 'synced'
    : step === 0 && cycle > 0 && inCycle < 14
      ? 'rest' // the restock beat, before the next sale
      : inCycle < 12
        ? 'rest'
        : inCycle < 26
          ? 'sold'
          : 'synced';

  const soldStock = Math.max(0, stockBefore - 1);
  const sourceStock = phase === 'rest' ? stockBefore : soldStock;
  // The whole point: the other shop lags by a beat, then matches.
  const otherStock = phase === 'synced' ? soldStock : stockBefore;

  const depopStock = soldOn === 'depop' ? sourceStock : otherStock;
  const vintedStock = soldOn === 'vinted' ? sourceStock : otherStock;

  const status =
    phase === 'rest'
      ? 'Watching both shops'
      : phase === 'sold'
        ? `Sold on ${soldOn === 'depop' ? 'Depop' : 'Vinted'}`
        : soldStock === 0
          ? `Out of stock, removed from ${soldOn === 'depop' ? 'Vinted' : 'Depop'}`
          : `${soldOn === 'depop' ? 'Vinted' : 'Depop'} stock updated to ${soldStock}`;

  const buyer = soldOn === 'depop' ? 'kai_pop' : 'lila_resale';

  return (
    <div className="flex flex-col gap-3">
      {/* The event that starts the chain, above the two shops it affects, so
          the story reads top to bottom: a sale lands here, and the stock below
          follows. Without it the two cards just changed numbers on their own. */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-300 ${
          phase === 'rest'
            ? 'border-black/[0.08] bg-white dark:border-white/10 dark:bg-white/[0.02]'
            : 'border-emerald-500/40 bg-emerald-500/[0.05] dark:border-emerald-400/40'
        }`}
      >
        <span className="relative inline-flex size-2 flex-shrink-0">
          {phase !== 'rest' ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          ) : null}
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>

        <ProductImage
          type="tee"
          hue={220}
          src="/products/star-beanie.jpg"
          className="size-9 flex-shrink-0 rounded-md"
        />

        <div className="min-w-0 flex-1">
          {phase === 'rest' ? (
            <>
              <div className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
                Watching both shops
              </div>
              <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                Star beanie, listed on both
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[12.5px] text-zinc-800 dark:text-zinc-200">
                <span className="font-medium">@{buyer}</span>
                <span className="text-zinc-600 dark:text-zinc-400">bought</span>
                <span className="font-medium">Star beanie</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                on
                <BrandWordmark
                  brand={soldOn}
                  variant="wordmark"
                  height={soldOn === 'depop' ? '0.8em' : '0.95em'}
                />
                <span>· just now</span>
              </div>
            </>
          )}
        </div>

        {phase !== 'rest' ? (
          <span className="flex-shrink-0 rounded-full bg-emerald-500/15 px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">
            Sale
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <ShopCard
          brand="depop"
          stock={depopStock}
          justSold={phase === 'sold' && soldOn === 'depop'}
          syncing={phase === 'synced'}
        />

        {/* Sync indicator. Pulses while the second shop is catching up. */}
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={`flex size-9 items-center justify-center rounded-full border transition-colors duration-300 ${
              phase === 'sold'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-black/[0.08] text-zinc-400 dark:border-white/10 dark:text-zinc-600'
            }`}
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
              <path
                d="M2 6h9L8.5 3.5M14 10H5l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-zinc-400">
            {phase === 'sold' ? 'syncing' : 'in sync'}
          </span>
        </div>

        <ShopCard
          brand="vinted"
          stock={vintedStock}
          justSold={phase === 'sold' && soldOn === 'vinted'}
          syncing={phase === 'synced'}
        />
      </div>

      {/* Status line, narrating what just happened in plain words. */}
      <div className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
        <span className="relative inline-flex size-1.5 flex-shrink-0">
          {phase !== 'rest' ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          ) : null}
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="truncate text-[11.5px] text-zinc-700 dark:text-zinc-300">
          {status}
        </span>
        <span className="ml-auto flex-shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400">
          0 oversold
        </span>
      </div>
    </div>
  );
}
