'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

/**
 * Drives a panel demo loop. Returns a tick counter that increments every
 * `intervalMs`. Respects prefers-reduced-motion (stays at 0). Reset to 0
 * whenever the panel mounts (because panels unmount when the tab changes).
 */
function useAnimationTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}
import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@/components/Icon';
import { BrandWordmark } from '@/components/BrandWordmark';
import { ProductImage, type ProductType } from './ProductImage';

type TabId =
  | 'listings'
  | 'crosslist'
  | 'shopDesigner'
  | 'restocker'
  | 'relister'
  | 'priceDrops'
  | 'followBot'
  | 'offers'
  | 'autoOffers'
  | 'conversations'
  | 'labels';

interface SideTab {
  id: TabId;
  icon: IconName;
}

// Labels and headers (title + meta) come from Home.preview translations
// in messages/*.json so the demo localises with the site language. Order
// here is the rendering order of the sidebar.
const SIDE_TABS: SideTab[] = [
  { id: 'crosslist', icon: 'swap' },
  { id: 'restocker', icon: 'refresh' },
  { id: 'shopDesigner', icon: 'layout' },
  { id: 'listings', icon: 'grid' },
  { id: 'relister', icon: 'rotate' },
  { id: 'priceDrops', icon: 'tag' },
  { id: 'followBot', icon: 'users' },
  { id: 'offers', icon: 'zap' },
  { id: 'autoOffers', icon: 'sparkle' },
  { id: 'conversations', icon: 'message' },
  { id: 'labels', icon: 'box' },
];

// Product photos. Local studio shots of the accessory items the demo shop
// sells across both marketplaces.
const PHOTO = {
  crossNecklace: '/products/cross-necklace.jpg',
  crystalCross: '/products/crystal-cross.jpg',
  roseCharm: '/products/rose-charm.jpg',
  strawberryRings: '/products/strawberry-rings.jpg',
  catRing: '/products/cat-ring.jpg',
  sportSunglasses: '/products/sport-sunglasses.jpg',
  starBeanie: '/products/star-beanie.jpg',
} as const;

function avatarStyle(hue: number): CSSProperties {
  return { background: `hsl(${hue} 55% 42%)` };
}

function platformBorder(platform: 'depop' | 'vinted'): string {
  return platform === 'depop'
    ? 'border-l-[2px] border-l-[rgba(255,35,0,0.55)]'
    : 'border-l-[2px] border-l-[rgba(9,177,136,0.55)]';
}

function chipClass(tone: 'success' | 'neutral' | 'warn'): string {
  if (tone === 'success')
    return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300';
  if (tone === 'warn')
    return 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300';
  return 'bg-zinc-900/[0.06] text-zinc-600 dark:bg-white/10 dark:text-zinc-300';
}

function PlatformBadge({
  platform,
  size = 14,
}: {
  platform: 'depop' | 'vinted';
  size?: number;
}) {
  const src = platform === 'depop' ? '/depop-logo.png' : '/vinted-logo.png';
  return (
    <img
      src={src}
      alt={platform === 'depop' ? 'Depop' : 'Vinted'}
      width={size}
      height={size}
      className="flex-shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

// ── Tab panels ──────────────────────────────────────────────────────

function ListingsPanel() {
  // Mirrors the actual app's listings tab: a row-based table with
  // thumbnail, title + brand chip, platform logos (stacked for cross-listed
  // items), price (stacked when prices differ across platforms), views,
  // status pill, restock toggle + quantity.
  type Status = 'active' | 'draft' | 'sold';
  const rows: {
    title: string;
    brand?: string;
    photo: string;
    type: ProductType;
    hue: number;
    platforms: ('depop' | 'vinted')[];
    prices: string[];
    views: number;
    likes: number;
    statuses: Status[];
    restockOn: boolean;
    restockQty: number;
    listed: string;
  }[] = [
    {
      title: 'Star beanie vintage y2k',
      brand: 'Vintage',
      photo: PHOTO.starBeanie,
      type: 'tee',
      hue: 220,
      platforms: ['depop', 'vinted'],
      prices: ['£22', '£24'],
      views: 87,
      likes: 14,
      statuses: ['active', 'active'],
      restockOn: true,
      restockQty: 3,
      listed: '2d',
    },
    {
      title: 'Crystal cross y2k pendant',
      brand: 'Pre-loved',
      photo: PHOTO.crystalCross,
      type: 'tee',
      hue: 200,
      platforms: ['depop'],
      prices: ['£28'],
      views: 124,
      likes: 22,
      statuses: ['active'],
      restockOn: true,
      restockQty: 5,
      listed: '5d',
    },
    {
      title: 'Blue cross beaded necklace',
      photo: PHOTO.crossNecklace,
      type: 'tee',
      hue: 195,
      platforms: ['depop', 'vinted'],
      prices: ['£18'],
      views: 56,
      likes: 9,
      statuses: ['active', 'active'],
      restockOn: true,
      restockQty: 1,
      listed: '8d',
    },
    {
      title: 'Rose charm gold clip',
      brand: 'Vintage',
      photo: PHOTO.roseCharm,
      type: 'tee',
      hue: 8,
      platforms: ['vinted'],
      prices: ['£12'],
      views: 23,
      likes: 3,
      statuses: ['draft'],
      restockOn: false,
      restockQty: 0,
      listed: '1d',
    },
    {
      title: 'Strawberry rings 2-pack',
      photo: PHOTO.strawberryRings,
      type: 'tee',
      hue: 0,
      platforms: ['depop'],
      prices: ['£16'],
      views: 198,
      likes: 41,
      statuses: ['active'],
      restockOn: false,
      restockQty: 0,
      listed: '12d',
    },
    {
      title: 'Sport shades black wraparound',
      brand: 'Y2K',
      photo: PHOTO.sportSunglasses,
      type: 'tee',
      hue: 210,
      platforms: ['depop', 'vinted'],
      prices: ['£24', '£25'],
      views: 64,
      likes: 11,
      statuses: ['sold', 'active'],
      restockOn: true,
      restockQty: 2,
      listed: '18d',
    },
  ];

  const statusClass = (s: Status) =>
    s === 'active'
      ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
      : s === 'draft'
      ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
      : 'bg-zinc-900/[0.06] text-zinc-600 dark:bg-white/10 dark:text-zinc-300';

  return (
    <div className="cascade-list flex flex-col gap-1.5">
      {/* Toolbar: search + filter chips + count */}
      <div
        className="cascade-item flex items-center gap-2 rounded-md border border-black/[0.06] bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="flex flex-1 items-center gap-1.5 rounded bg-zinc-100/70 px-2 py-1 dark:bg-white/[0.04]">
          <svg viewBox="0 0 14 14" className="h-3 w-3 text-zinc-400" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 12L9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="text-[10.5px] text-zinc-400">Search 128 listings</span>
        </div>
        <span className="rounded-full bg-zinc-900 px-2 py-[2px] text-[9.5px] font-semibold text-white dark:bg-white dark:text-zinc-900">
          All
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] px-2 py-[2px] text-[9.5px] text-zinc-600 dark:border-white/15 dark:text-zinc-300">
          <PlatformBadge platform="depop" size={10} />
          Depop
        </span>
        <span className="hidden items-center gap-1 rounded-full border border-black/[0.08] px-2 py-[2px] text-[9.5px] text-zinc-600 sm:inline-flex dark:border-white/15 dark:text-zinc-300">
          <PlatformBadge platform="vinted" size={10} />
          Vinted
        </span>
      </div>

      {/* Table header row */}
      <div
        className="cascade-item grid grid-cols-[22px_1fr_24px_44px_44px] items-center gap-1.5 px-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-zinc-500 sm:grid-cols-[28px_1fr_36px_56px_38px_60px_28px] sm:gap-2"
        style={{ '--stagger-delay': `40ms` } as CSSProperties}
      >
        <span />
        <span>Item</span>
        <span>Site</span>
        <span className="text-right">Price</span>
        <span className="hidden text-right sm:inline">Views</span>
        <span className="text-center">Restock</span>
        <span className="hidden text-right sm:inline">Listed</span>
      </div>

      {/* Listing rows */}
      <ul className="cascade-list flex flex-col gap-1">
        {rows.map((r, i) => (
          <li
            key={r.title}
            className="cascade-item grid grid-cols-[22px_1fr_24px_44px_44px] items-center gap-1.5 rounded-md border border-black/[0.06] bg-white px-2 py-1.5 sm:grid-cols-[28px_1fr_36px_56px_38px_60px_28px] sm:gap-2 dark:border-white/10 dark:bg-white/[0.02]"
            style={{ '--stagger-delay': `${80 + i * 50}ms` } as CSSProperties}
          >
            <ProductImage
              type={r.type}
              hue={r.hue}
              src={r.photo}
              className="size-7 flex-shrink-0 rounded"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                  {r.title}
                </span>
                {r.platforms.length > 1 && (
                  <svg viewBox="0 0 14 14" className="h-2.5 w-2.5 flex-shrink-0 text-emerald-500" fill="none" aria-hidden="true">
                    <path d="M6 8a3 3 0 0 0 4.24.24l1.76-1.76a3 3 0 0 0-4.24-4.24l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M8 6a3 3 0 0 0-4.24-.24L2 7.52a3 3 0 0 0 4.24 4.24l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[9.5px] text-zinc-500">
                {r.brand && (
                  <span className="rounded bg-zinc-900/[0.06] px-1 py-[0.5px] text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                    {r.brand}
                  </span>
                )}
                <span className="inline-flex items-center gap-0.5">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
                    <path d="M6 10.5c-.2 0-.4-.1-.6-.2C2.4 7.9.5 6.2.5 4c0-1.7 1.3-3 3-3 1 0 1.9.5 2.5 1.2C6.6 1.5 7.5 1 8.5 1c1.7 0 3 1.3 3 3 0 2.2-1.9 3.9-4.9 6.3-.2.1-.4.2-.6.2z" />
                  </svg>
                  {r.likes}
                </span>
                <span
                  className={`rounded-full px-1 py-[0.5px] text-[8.5px] font-semibold tracking-[0.06em] ${statusClass(r.statuses[0])}`}
                >
                  {r.statuses[0].toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              {r.platforms.map((p) => (
                <PlatformBadge key={p} platform={p} size={11} />
              ))}
            </div>
            <div className="text-right font-mono text-[10.5px] font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {r.prices.length > 1 ? (
                <div className="flex flex-col items-end leading-tight">
                  {r.prices.map((p, idx) => (
                    <span key={idx}>{p}</span>
                  ))}
                </div>
              ) : (
                r.prices[0]
              )}
            </div>
            <div className="hidden text-right font-mono text-[10px] tabular-nums text-zinc-600 sm:block dark:text-zinc-400">
              {r.views}
            </div>
            <div className="flex items-center justify-center gap-1">
              <span
                className={`relative inline-flex h-3 w-5 items-center rounded-full transition-colors ${
                  r.restockOn ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-white/15'
                }`}
                aria-hidden
              >
                <span
                  className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform ${
                    r.restockOn ? 'translate-x-2' : 'translate-x-[1px]'
                  }`}
                />
              </span>
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  r.restockOn
                    ? r.restockQty <= 1
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-400'
                }`}
              >
                {r.restockOn ? r.restockQty : '--'}
              </span>
            </div>
            <div className="hidden text-right font-mono text-[9.5px] text-zinc-500 sm:block">{r.listed}</div>
          </li>
        ))}
      </ul>

      {/* Pagination row */}
      <div
        className="cascade-item flex items-center justify-between px-1 pt-1 text-[9.5px] text-zinc-500"
        style={{ '--stagger-delay': `${80 + 6 * 50}ms` } as CSSProperties}
      >
        <span className="font-mono">128 listings · 6 shown</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-black/10 text-zinc-400 dark:border-white/15">
            &lt;
          </span>
          <span className="font-mono">1 / 22</span>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-black/10 text-zinc-700 dark:border-white/15 dark:text-zinc-200">
            &gt;
          </span>
        </span>
      </div>
    </div>
  );
}

function CrosslistPanel() {
  // Vinted (source) and Depop (target) cards are deliberately styled to
  // mimic each platform: Vinted's teal accents + "heart + measurements"
  // sidebar style, Depop's red accents + "@user + tags" feed style. Same
  // item, two visibly different homes - that's the crosslist story.
  return (
    <div className="cascade-list flex flex-col gap-3">
      <div className="cascade-list grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        {/* Source: Vinted - teal palette, clean grid look */}
        <div
          className="cascade-item flex flex-col overflow-hidden rounded-lg border-2 border-[#007782]/25 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:border-[#007782]/35 dark:bg-white/[0.02]"
          style={{ '--stagger-delay': `0ms` } as CSSProperties}
        >
          <div className="flex items-center justify-between border-b border-[#007782]/15 bg-[#007782]/[0.06] px-2 py-1 dark:bg-[#007782]/[0.12]">
            <BrandWordmark brand="vinted" variant="wordmark" height="0.9em" />
            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#007782] dark:text-[#5bb4be]">
              Source
            </span>
          </div>
          <ProductImage
            type="tee"
            hue={220}
            src={PHOTO.starBeanie}
            className="aspect-square w-full"
          />
          <div className="flex flex-col gap-1 p-2">
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#5bb4be] to-[#007782] shadow-[0_0_0_1.5px_white,0_1px_2px_rgba(0,119,130,0.45)] dark:shadow-[0_0_0_1.5px_rgba(255,255,255,0.6),0_1px_2px_rgba(0,119,130,0.5)]">
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M6 1l1.5 3.5L11 5l-2.7 2.3.8 3.5L6 9l-3.1 1.8.8-3.5L1 5l3.5-.5L6 1z" />
                </svg>
              </span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">@your_shop</span>
            </div>
            <div className="truncate text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              Star beanie
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[12px] font-bold text-[#007782] dark:text-[#5bb4be]">
                £22
              </span>
              <span className="text-[9px] text-zinc-500">incl. fee £24.50</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-zinc-500">
              <span className="inline-flex items-center gap-0.5">
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                  <path d="M6 10.5c-.2 0-.4-.1-.6-.2C2.4 7.9.5 6.2.5 4c0-1.7 1.3-3 3-3 1 0 1.9.5 2.5 1.2C6.6 1.5 7.5 1 8.5 1c1.7 0 3 1.3 3 3 0 2.2-1.9 3.9-4.9 6.3-.2.1-.4.2-.6.2z" />
                </svg>
                12
              </span>
              <span>·</span>
              <span>Size: One size</span>
            </div>
          </div>
        </div>

        {/* Mapping arrow: bidirectional, crosslist runs either direction */}
        <div
          className="cascade-item relative flex flex-col items-center justify-center gap-1.5 px-1 pt-6"
          style={{ '--stagger-delay': `100ms` } as CSSProperties}
        >
          <svg
            className="size-6 text-zinc-400 dark:text-zinc-500"
            viewBox="0 0 28 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 12h22M3 12l5-5M3 12l5 5M25 12l-5-5M25 12l-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400">
            mapped
          </span>
        </div>

        {/* Target: Depop - red palette, social feed look */}
        <div
          className="cascade-item flex flex-col overflow-hidden rounded-lg border-2 border-[#ff2300]/25 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:border-[#ff2300]/35 dark:bg-white/[0.02]"
          style={{ '--stagger-delay': `200ms` } as CSSProperties}
        >
          <div className="flex items-center justify-between border-b border-[#ff2300]/15 bg-[#ff2300]/[0.06] px-2 py-1 dark:bg-[#ff2300]/[0.12]">
            <BrandWordmark brand="depop" variant="wordmark" height="0.7em" />
            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#ff2300] dark:text-[#ff7a66]">
              Target
            </span>
          </div>
          <ProductImage
            type="tee"
            hue={220}
            src={PHOTO.starBeanie}
            className="aspect-square w-full"
          />
          <div className="flex flex-col gap-1 p-2">
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a66] to-[#ff2300] shadow-[0_0_0_1.5px_white,0_1px_2px_rgba(255,35,0,0.45)] dark:shadow-[0_0_0_1.5px_rgba(255,255,255,0.6),0_1px_2px_rgba(255,35,0,0.5)]">
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M6 1l1.5 3.5L11 5l-2.7 2.3.8 3.5L6 9l-3.1 1.8.8-3.5L1 5l3.5-.5L6 1z" />
                </svg>
              </span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">@your_shop</span>
            </div>
            <div className="truncate text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              Star beanie vintage y2k
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[12px] font-bold text-[#ff2300]">
                £22
              </span>
              <span className="text-[9px] font-medium text-zinc-500">+ POSTAGE</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-zinc-900/[0.06] px-1.5 py-[1px] text-[8.5px] text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                #y2k
              </span>
              <span className="rounded-full bg-zinc-900/[0.06] px-1.5 py-[1px] text-[8.5px] text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                #beanie
              </span>
              <span className="rounded-full bg-zinc-900/[0.06] px-1.5 py-[1px] text-[8.5px] text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                #vintage
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mapped fields summary: shows what got resolved between schemas */}
      <div
        className="cascade-item flex flex-wrap items-center gap-1.5"
        style={{ '--stagger-delay': `300ms` } as CSSProperties}
      >
        {[
          ['Brand', 'Vintage'],
          ['Category', 'Hats'],
          ['Size', 'One size'],
          ['Condition', 'Like new'],
        ].map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/[0.02]"
          >
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-zinc-500">
              {k}
            </span>
            <span className="text-zinc-900 dark:text-zinc-100">{v}</span>
          </span>
        ))}
      </div>

      {/* Active progress sweep: tells the user something is happening NOW */}
      <div
        className="cascade-item relative overflow-hidden rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5"
        style={{ '--stagger-delay': `380ms` } as CSSProperties}
      >
        <div className="relative z-10 flex items-center justify-between text-[11px]">
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            Posting to Depop
          </span>
          <span className="font-mono text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
            step 4 of 5
          </span>
        </div>
        <span className="hero-progress-sweep" aria-hidden="true" />
      </div>
    </div>
  );
}

function AutoOffersPanel() {
  // Live demo: every ~6s a new like comes in on one of your listings, the
  // bot picks it up and sends the liker a private offer at a configurable
  // discount (here 15% off listed). The active card cycles through three
  // phases — LIKE detected → bot preparing the offer → offer SENT. Older
  // sent offers show below with their outcome.
  const TICKS_PER_OFFER = 60; // 6s
  const tick = useAnimationTick(100);
  const offerIndex = Math.floor(tick / TICKS_PER_OFFER);
  const inOffer = tick % TICKS_PER_OFFER;

  type Phase = 'like' | 'preparing' | 'sent';
  const phase: Phase =
    inOffer < 12 ? 'like' : inOffer < 30 ? 'preparing' : 'sent';

  // Pool of likers + items the bot rotates through. Each one gets an
  // auto-offer at 85% of listed (rounded to the nearest pound).
  const POOL: {
    platform: 'depop' | 'vinted';
    username: string;
    hue: number;
    type: ProductType;
    photo: string;
    initial: string;
    item: string;
    listed: number;
    historyOutcome: 'accepted' | 'pending' | 'declined';
  }[] = [
    { platform: 'depop', username: 'sam_thrifts', hue: 200, type: 'tee', photo: PHOTO.crystalCross,    initial: 'S', item: 'Crystal cross',  listed: 28, historyOutcome: 'accepted' },
    { platform: 'vinted', username: 'mia_v',       hue: 0,   type: 'tee', photo: PHOTO.strawberryRings, initial: 'M', item: 'Strawberry rings', listed: 16, historyOutcome: 'pending'  },
    { platform: 'depop', username: 'lila_resale', hue: 195, type: 'tee', photo: PHOTO.crossNecklace,  initial: 'L', item: 'Cross necklace', listed: 18, historyOutcome: 'accepted' },
    { platform: 'vinted', username: 'kai_pop',     hue: 22,  type: 'tee', photo: PHOTO.starBeanie,     initial: 'K', item: 'Star beanie',    listed: 22, historyOutcome: 'declined' },
  ];

  const discountPct = 15; // 15% off listed
  const offerPriceFor = (listed: number) => Math.max(1, Math.round(listed * (1 - discountPct / 100)));

  const active = POOL[offerIndex % POOL.length];
  const activeOffer = offerPriceFor(active.listed);

  // History rows = the two most recent sent offers (one and two cycles back).
  const history = [1, 2].map((back) => POOL[((offerIndex - back) % POOL.length + POOL.length) % POOL.length]);

  // Stats climb as the demo runs.
  const sent = 38 + offerIndex;
  const converted = 9 + Math.floor(offerIndex / 3);
  const earned = 211 + offerIndex * 18;
  return (
    <div className="cascade-list flex flex-col gap-1.5">
      <div
        className="cascade-item grid grid-cols-3 divide-x divide-black/[0.06] rounded-md border border-black/[0.06] bg-white py-1 text-center dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {sent}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Sent
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {converted}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Converted
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            £{earned}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Earned
          </div>
        </div>
      </div>

      {/* Active card: state machine cycles like → preparing → sent */}
      <div
        key={`active-${offerIndex}`}
        className={`cascade-item relative flex flex-col gap-1.5 rounded-md border bg-white px-2.5 py-2 transition-colors duration-300 dark:bg-white/[0.02] ${
          phase === 'sent'
            ? 'border-emerald-500/30 bg-emerald-500/[0.04] dark:border-emerald-400/30 dark:bg-emerald-400/[0.04]'
            : phase === 'like'
            ? 'border-pink-500/30 bg-pink-500/[0.04] dark:border-pink-400/30 dark:bg-pink-400/[0.04]'
            : 'border-black/[0.08] dark:border-white/15'
        }`}
        style={{ '--stagger-delay': `60ms` } as CSSProperties}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={avatarStyle(active.hue)}
          >
            {active.initial}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${
                  phase === 'like'
                    ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300'
                    : phase === 'preparing'
                    ? chipClass('neutral')
                    : chipClass('success')
                }`}
              >
                {phase === 'like' && '♥ NEW LIKE'}
                {phase === 'preparing' && 'BOT PREPARING OFFER…'}
                {phase === 'sent' && 'OFFER SENT'}
              </span>
              <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                @{active.username}
              </span>
              <PlatformBadge platform={active.platform} size={11} />
            </div>
            <div className="truncate text-[10px] text-zinc-500">
              {phase === 'like' && `Liked ${active.item} (£${active.listed})`}
              {phase === 'preparing' && `Composing private offer at -${discountPct}% (£${activeOffer})`}
              {phase === 'sent' && `Sent £${activeOffer} to @${active.username} · was £${active.listed}`}
            </div>
          </div>
          {phase === 'preparing' ? (
            <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-md bg-zinc-900/[0.04] dark:bg-white/[0.06]">
              <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin text-zinc-500" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          ) : (
            <ProductImage
              type={active.type}
              hue={active.hue}
              src={active.photo}
              className="size-9 flex-shrink-0 rounded-md"
            />
          )}
        </div>
      </div>

      {/* History: the previous two sent offers and what happened to them */}
      <ul className="cascade-list flex flex-col gap-1.5">
        {history.map((row, i) => {
          const sentPrice = offerPriceFor(row.listed);
          return (
            <li
              key={`hist-${offerIndex}-${i}`}
              className={`cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 opacity-80 dark:border-white/10 dark:bg-white/[0.02] ${platformBorder(row.platform)}`}
              style={{ '--stagger-delay': `${120 + i * 70}ms` } as CSSProperties}
            >
              <span
                className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={avatarStyle(row.hue)}
              >
                {row.initial}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${
                      row.historyOutcome === 'accepted'
                        ? chipClass('success')
                        : row.historyOutcome === 'declined'
                        ? chipClass('warn')
                        : chipClass('neutral')
                    }`}
                  >
                    {row.historyOutcome === 'accepted' && 'BOUGHT'}
                    {row.historyOutcome === 'pending' && 'AWAITING'}
                    {row.historyOutcome === 'declined' && 'DECLINED'}
                  </span>
                  <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                    @{row.username}
                  </span>
                </div>
                <div className="truncate text-[10px] text-zinc-500">
                  Sent £{sentPrice} on {row.item} (was £{row.listed})
                </div>
              </div>
              <ProductImage
                type={row.type}
                hue={row.hue}
                src={row.photo}
                className="size-9 flex-shrink-0 rounded-md"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RestockerPanel() {
  // Live demo: every ~6 seconds, one item gets a sale event, the bar fills
  // showing the restock in progress, then the listing pops back to "RESTOCKED"
  // and its stock decrements by 1. The cycle rotates through the inventory.
  //
  // Tick fires every 100ms; one cycle = 60 ticks = 6s. The four phases break
  // up that cycle so the user can follow what just happened.
  const TICKS_PER_CYCLE = 60;
  const tick = useAnimationTick(100);
  const cycleIndex = Math.floor(tick / TICKS_PER_CYCLE);
  const inCycle = tick % TICKS_PER_CYCLE;

  type Phase = 'idle' | 'sale' | 'restocking' | 'done';
  const phase: Phase =
    inCycle < 3
      ? 'idle'
      : inCycle < 12
      ? 'sale'
      : inCycle < 40
      ? 'restocking'
      : 'done';
  // Progress bar 0..1 across the 'restocking' window (ticks 12..40).
  const progress =
    phase === 'restocking'
      ? Math.min(1, Math.max(0, (inCycle - 12) / 28))
      : phase === 'done'
      ? 1
      : 0;

  type Row = {
    title: string;
    hue: number;
    type: ProductType;
    photo: string;
    initialStock: number;
    soldOn: 'depop' | 'vinted';
  };
  const baseRows: Row[] = [
    { title: 'Star beanie', hue: 220, type: 'tee', photo: PHOTO.starBeanie, initialStock: 4, soldOn: 'vinted' },
    { title: 'Crystal cross', hue: 200, type: 'tee', photo: PHOTO.crystalCross, initialStock: 5, soldOn: 'depop' },
    { title: 'Cross necklace', hue: 195, type: 'tee', photo: PHOTO.crossNecklace, initialStock: 3, soldOn: 'vinted' },
    { title: 'Rose charm', hue: 8, type: 'tee', photo: PHOTO.roseCharm, initialStock: 2, soldOn: 'depop' },
    { title: 'Sport shades', hue: 210, type: 'tee', photo: PHOTO.sportSunglasses, initialStock: 4, soldOn: 'vinted' },
  ];

  // Active row for this cycle.
  const activeIdx = cycleIndex % baseRows.length;
  const active = baseRows[activeIdx];

  // Stock per row: each row has had (number of completed cycles that picked it) sales applied.
  // For the active row in 'done' phase, also count the just-finished sale.
  const stocks = baseRows.map((r, i) => {
    const completedSalesForRow = Math.floor((cycleIndex + (baseRows.length - i)) / baseRows.length);
    const inflight = i === activeIdx && (phase === 'sale' || phase === 'restocking') ? 1 : 0;
    return Math.max(0, r.initialStock - completedSalesForRow + inflight);
  });

  // Stats counters tick up as the demo runs.
  const restocksToday = 8 + cycleIndex;
  const salesToday = 184 + cycleIndex * 22;
  return (
    <div className="cascade-list flex flex-col gap-2">
      {/* Live sale event banner - swaps content as the cycle advances */}
      <div
        className="cascade-item flex items-center gap-2.5 overflow-hidden rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 transition-opacity duration-300"
        style={{
          '--stagger-delay': `0ms`,
          opacity: phase === 'idle' ? 0.5 : 1,
        } as CSSProperties}
      >
        <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
          {phase !== 'idle' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <ProductImage
          type={active.type}
          hue={active.hue}
          src={active.photo}
          className="size-6 flex-shrink-0 rounded"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
            {active.title} sold on <span className="font-semibold">{active.soldOn === 'depop' ? 'Depop' : 'Vinted'}</span>
          </div>
          <div className="truncate text-[9.5px] text-emerald-700/80 dark:text-emerald-300/80">
            {phase === 'sale' && 'Detected · queueing restock…'}
            {phase === 'restocking' && `Relisting on ${active.soldOn === 'depop' ? 'Vinted' : 'Depop'} · ${Math.round(progress * 100)}%`}
            {phase === 'done' && `Stock ${stocks[activeIdx] + 1} → ${stocks[activeIdx]} · listing kept live`}
            {phase === 'idle' && 'Watching for sales…'}
          </div>
        </div>
        <span className="font-mono text-[9px] text-emerald-700/70 dark:text-emerald-300/70">
          {phase === 'idle' ? '' : 'just now'}
        </span>
      </div>

      {/* Stats: incrementing counters as the demo runs */}
      <div
        className="cascade-item grid grid-cols-3 divide-x divide-black/[0.06] rounded-md border border-black/[0.06] bg-white py-1 text-center dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `60ms` } as CSSProperties}
      >
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {restocksToday}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Restocks today
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            £{salesToday}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Sales today
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            0
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Oversells
          </div>
        </div>
      </div>

      {/* Stock list: progress bar overlays the active row during restock */}
      <ul className="cascade-list flex flex-col gap-1.5">
        {baseRows.map((row, i) => {
          const isActive = i === activeIdx;
          const stock = stocks[i];
          const lowStock = stock <= 1;
          const showProgress = isActive && phase === 'restocking';
          const showRestocked = isActive && phase === 'done';
          return (
            <li
              key={row.title}
              className="cascade-item relative overflow-hidden rounded-md border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.02]"
              style={{ '--stagger-delay': `${120 + i * 55}ms` } as CSSProperties}
            >
              {/* Progress bar overlay - fills the row from left to right */}
              {showProgress && (
                <span
                  className="absolute inset-y-0 left-0 bg-emerald-500/[0.08] transition-[width] duration-100 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              )}
              <div className="relative flex items-center gap-2.5 px-2.5 py-1.5">
                <ProductImage
                  type={row.type}
                  hue={row.hue}
                  src={row.photo}
                  className="size-7 flex-shrink-0 rounded"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                    {row.title}
                  </div>
                  {(showProgress || showRestocked) && (
                    <div className="truncate text-[9.5px] text-zinc-500">
                      {showProgress
                        ? `Sold on ${row.soldOn === 'depop' ? 'Depop' : 'Vinted'} · restocking…`
                        : `Sold on ${row.soldOn === 'depop' ? 'Depop' : 'Vinted'} · just now`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {showRestocked && (
                    <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('success')}`}>
                      RESTOCKED
                    </span>
                  )}
                  {!showRestocked && lowStock && (
                    <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('warn')}`}>
                      LOW
                    </span>
                  )}
                  <span className="flex items-baseline gap-0.5 rounded-md bg-zinc-900/[0.04] px-2 py-0.5 dark:bg-white/[0.06]">
                    <span className={`font-mono text-[12px] font-semibold tabular-nums transition-colors ${lowStock ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {stock}
                    </span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-zinc-500">
                      in stock
                    </span>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConversationsPanel() {
  // Live demo: messages appear one by one with a "typing" indicator from
  // whichever side is about to speak next. After all messages are visible,
  // the thread holds for a beat then restarts. Tick = 100ms, full cycle =
  // 80 ticks = 8s (5 phases × 16 ticks each = perfect for the 8s autocycle).
  const TICKS_PER_PHASE = 16;
  const PHASES = 5;
  const tick = useAnimationTick(100);
  const phase = Math.floor(tick / TICKS_PER_PHASE) % PHASES;

  const messages = [
    { hue: 178, initial: 'L', text: 'Is this still available?', time: '12:04', mine: false },
    { hue: 0, initial: 'Y', text: 'Yes! Shipping today if you grab it.', time: '12:05', mine: true },
    { hue: 178, initial: 'L', text: 'Perfect, just paid.', time: '12:06', mine: false },
  ];

  // Phases (in order):
  // 0: buyer typing (no messages yet)
  // 1: msg 0 visible, seller (me) typing
  // 2: msgs 0+1 visible, buyer typing
  // 3: all 3 visible
  // 4: pause with all 3 visible (then loop)
  const visibleCount = phase === 0 ? 0 : phase === 1 ? 1 : phase === 2 ? 2 : 3;
  const typingFrom: 'buyer' | 'me' | null =
    phase === 0 ? 'buyer' : phase === 1 ? 'me' : phase === 2 ? 'buyer' : null;
  return (
    <div className="cascade-list flex flex-col gap-2">
      <div
        className="cascade-item flex items-center justify-between rounded-md border border-black/[0.06] bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="flex items-center gap-2">
          <PlatformBadge platform="vinted" size={14} />
          <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            @lila_resale
          </span>
          <span className="text-[10px] text-zinc-500">· Star beanie</span>
        </div>
        <span className="font-mono text-[9.5px] text-zinc-500">re: offer</span>
      </div>

      <ul className="cascade-list flex flex-col gap-1.5">
        {messages.slice(0, visibleCount).map((m, i) => (
          <li
            key={`msg-${i}`}
            className={`cascade-item flex items-end gap-1.5 ${m.mine ? 'flex-row-reverse' : ''}`}
            style={{ '--stagger-delay': `0ms` } as CSSProperties}
          >
            <span
              className="flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={avatarStyle(m.hue)}
            >
              {m.initial}
            </span>
            <div
              className={
                m.mine
                  ? 'max-w-[70%] rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-1.5 text-[11px] text-white dark:bg-white dark:text-zinc-900'
                  : 'max-w-[70%] rounded-2xl rounded-bl-sm border border-black/[0.06] bg-white px-3 py-1.5 text-[11px] text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100'
              }
            >
              {m.text}
            </div>
            <span className="self-center font-mono text-[9px] text-zinc-400">{m.time}</span>
          </li>
        ))}
        {typingFrom && (
          <li
            key={`typing-${phase}`}
            className={`cascade-item flex items-end gap-1.5 ${typingFrom === 'me' ? 'flex-row-reverse' : ''}`}
            style={{ '--stagger-delay': `0ms` } as CSSProperties}
          >
            <span
              className="flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={avatarStyle(typingFrom === 'me' ? 0 : 178)}
            >
              {typingFrom === 'me' ? 'Y' : 'L'}
            </span>
            <div
              className={
                typingFrom === 'me'
                  ? 'rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 dark:bg-white'
                  : 'rounded-2xl rounded-bl-sm border border-black/[0.06] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]'
              }
              aria-label="typing"
            >
              <span className="flex items-center gap-1">
                <span
                  className={`hero-typing-dot size-1.5 rounded-full ${typingFrom === 'me' ? 'bg-white/60 dark:bg-zinc-900/60' : 'bg-zinc-400 dark:bg-zinc-500'}`}
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className={`hero-typing-dot size-1.5 rounded-full ${typingFrom === 'me' ? 'bg-white/60 dark:bg-zinc-900/60' : 'bg-zinc-400 dark:bg-zinc-500'}`}
                  style={{ animationDelay: '180ms' }}
                />
                <span
                  className={`hero-typing-dot size-1.5 rounded-full ${typingFrom === 'me' ? 'bg-white/60 dark:bg-zinc-900/60' : 'bg-zinc-400 dark:bg-zinc-500'}`}
                  style={{ animationDelay: '360ms' }}
                />
              </span>
            </div>
          </li>
        )}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-black/[0.06] pt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-500 dark:border-white/10">
        <span>Inbox</span>
        <span className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <PlatformBadge platform="vinted" size={11} /> 3
          </span>
          <span className="inline-flex items-center gap-1">
            <PlatformBadge platform="depop" size={11} /> 1
          </span>
        </span>
      </div>
    </div>
  );
}

function LabelsPanel() {
  const orders: {
    buyer: string;
    item: string;
    type: ProductType;
    photo: string;
    carrier: 'rm' | 'evri' | 'inpost';
    hue: number;
  }[] = [
    {
      buyer: 'lila_resale',
      item: 'Star beanie',
      type: 'tee',
      photo: PHOTO.starBeanie,
      carrier: 'rm',
      hue: 220,
    },
    {
      buyer: 'sam_thrifts',
      item: 'Crystal cross',
      type: 'tee',
      photo: PHOTO.crystalCross,
      carrier: 'evri',
      hue: 200,
    },
    {
      buyer: 'mia_v',
      item: 'Rose charm',
      type: 'tee',
      photo: PHOTO.roseCharm,
      carrier: 'inpost',
      hue: 22,
    },
    {
      buyer: 'kai_pop',
      item: 'Sport shades',
      type: 'tee',
      photo: PHOTO.sportSunglasses,
      carrier: 'rm',
      hue: 210,
    },
  ];
  const CARRIER: Record<
    'rm' | 'evri' | 'inpost',
    { label: string; className: string }
  > = {
    rm: {
      label: 'Royal Mail',
      className:
        'bg-[rgba(207,20,43,0.10)] text-[rgb(167,16,34)] dark:bg-[rgba(207,20,43,0.18)] dark:text-[rgb(255,140,150)]',
    },
    evri: {
      label: 'Evri',
      className:
        'bg-[rgba(6,143,180,0.10)] text-[rgb(5,114,144)] dark:bg-[rgba(6,143,180,0.18)] dark:text-[rgb(110,200,225)]',
    },
    inpost: {
      label: 'InPost',
      className:
        'bg-[rgba(238,219,0,0.18)] text-[rgb(132,118,0)] dark:bg-[rgba(238,219,0,0.18)] dark:text-[rgb(238,219,0)]',
    },
  };
  return (
    <div className="cascade-list flex h-full flex-col gap-2">
      <ul className="cascade-list flex flex-col gap-1.5">
        {orders.map((o, i) => (
          <li
            key={o.buyer}
            className="cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
            style={{ '--stagger-delay': `${i * 60}ms` } as CSSProperties}
          >
            <span className="flex size-3.5 flex-shrink-0 items-center justify-center rounded-sm border border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                <path
                  d="M2 5.2l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <ProductImage
              type={o.type}
              hue={o.hue}
              src={o.photo}
              className="size-7 flex-shrink-0 rounded"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                @{o.buyer}
              </div>
              <div className="truncate font-mono text-[9.5px] text-zinc-500">{o.item}</div>
            </div>
            <span
              className={`flex-shrink-0 rounded-full px-1.5 py-[1px] font-mono text-[9px] font-semibold tracking-[0.06em] ${CARRIER[o.carrier].className}`}
            >
              {CARRIER[o.carrier].label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        tabIndex={-1}
        className="cascade-item mt-auto flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-[11.5px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] dark:bg-white dark:text-zinc-900"
        style={{ '--stagger-delay': `${4 * 60}ms` } as CSSProperties}
      >
        <svg viewBox="0 0 14 14" className="size-3" fill="none" aria-hidden="true">
          <path
            d="M3 8v3h8V8M7 2v6m0 0L4.5 5.5M7 8l2.5-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download merged PDF (4 labels)
      </button>
    </div>
  );
}

function FollowBotPanel() {
  // Live demo: every ~2.5s the bot follows a new account. The counter ticks
  // up smoothly, the progress bar advances, and a new card slides in at the
  // top of the recent-activity list (with stable keys, React only mounts the
  // new row; the other four reconcile in place instead of all 5 rebuilding).
  const TICKS_PER_FOLLOW = 25; // 2.5s — slower so the list doesn't churn
  const tick = useAnimationTick(100);
  const follows = Math.floor(tick / TICKS_PER_FOLLOW);
  const inFollow = tick % TICKS_PER_FOLLOW;
  const justFollowed = inFollow < 15; // hold the highlight for 1.5s

  // A small pool we cycle through to simulate "new" follows arriving.
  type Status = 'followed' | 'followed-back' | 'unfollowed';
  const POOL: { username: string; hue: number; status: Status }[] = [
    { username: 'thrift_haven', hue: 22, status: 'followed-back' },
    { username: 'vintage_vee', hue: 200, status: 'followed' },
    { username: 'mia_v', hue: 312, status: 'followed' },
    { username: 'kai_pop', hue: 0, status: 'unfollowed' },
    { username: 'sam_thrifts', hue: 178, status: 'followed-back' },
    { username: 'depot_finds', hue: 140, status: 'followed' },
    { username: 'lila_resale', hue: 60, status: 'followed-back' },
    { username: 'arc_vintage', hue: 280, status: 'followed' },
    { username: 'rose_market', hue: 340, status: 'followed' },
    { username: 'kiera_shop', hue: 100, status: 'followed-back' },
  ];

  // Take the next 5 entries from the rotating pool. The newest is at the top.
  const recent = Array.from({ length: 5 }, (_, i) => {
    const idx = (POOL.length - 1 - (follows + i)) % POOL.length;
    const safeIdx = ((idx % POOL.length) + POOL.length) % POOL.length;
    return POOL[safeIdx];
  });

  // Counters (start at a nice round-ish number, climb from there).
  const followed = 218 + follows;
  const backRate = 0.29 + (follows % 7) * 0.005; // small jitter for realism
  const back = Math.round(followed * backRate);
  const rate = Math.round((back / followed) * 100);
  const target = 500;
  const progressPct = Math.min(100, (followed / target) * 100);
  return (
    <div className="cascade-list flex flex-col gap-2">
      <div
        className="cascade-item flex items-center justify-between rounded-md border border-black/[0.06] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Targeting @drip_resale&apos;s followers
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-500 tabular-nums">{followed} / {target}</span>
      </div>

      <div
        className="cascade-item relative h-1.5 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-white/10"
        style={{ '--stagger-delay': `60ms` } as CSSProperties}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/80 transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div
        className="cascade-item grid grid-cols-3 divide-x divide-black/[0.06] rounded-md border border-black/[0.06] bg-white py-1 text-center dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `120ms` } as CSSProperties}
      >
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {followed}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Followed
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {back}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Back
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {rate}%
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Rate
          </div>
        </div>
      </div>

      <ul className="cascade-list flex flex-col gap-1.5">
        {recent.map((r, i) => {
          const isTop = i === 0;
          return (
            <li
              key={r.username}
              className={`hero-follow-row-enter flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors duration-300 ${
                isTop && justFollowed
                  ? 'border-emerald-500/30 bg-emerald-500/[0.05] dark:border-emerald-400/30 dark:bg-emerald-400/[0.05]'
                  : 'border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.02]'
              }`}
            >
              <span
                className="flex size-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={avatarStyle(r.hue)}
              >
                {r.username[0].toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                @{r.username}
              </span>
              {isTop && justFollowed && (
                <span className="font-mono text-[9px] text-emerald-700/80 dark:text-emerald-300/80">
                  just now
                </span>
              )}
              <span
                className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${
                  r.status === 'followed-back'
                    ? chipClass('success')
                    : r.status === 'unfollowed'
                    ? chipClass('warn')
                    : chipClass('neutral')
                }`}
              >
                {r.status === 'followed-back'
                  ? 'FOLLOWED BACK'
                  : r.status === 'unfollowed'
                  ? 'UNFOLLOWED'
                  : 'FOLLOWED'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RelisterPanel() {
  return (
    <div className="cascade-list flex flex-col gap-2.5">
      <div
        className="cascade-item flex items-center justify-between rounded-md border border-black/[0.06] bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="flex items-center gap-2">
          <PlatformBadge platform="depop" size={14} />
          <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Crystal cross
          </span>
        </div>
        <span className="font-mono text-[9.5px] text-zinc-500">listed 41 days ago</span>
      </div>

      <div className="cascade-list grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <div
          className="cascade-item flex flex-col gap-1.5 overflow-hidden rounded-lg border border-black/[0.06] bg-white p-2 opacity-60 dark:border-white/10 dark:bg-white/[0.02]"
          style={{ '--stagger-delay': `60ms` } as CSSProperties}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              Original
            </span>
            <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('warn')}`}>
              STALE
            </span>
          </div>
          <ProductImage
            type="tee"
            hue={200}
            src={PHOTO.crystalCross}
            className="aspect-square w-full rounded-md"
          />
          <div className="truncate text-[10.5px] font-medium text-zinc-900 line-through dark:text-zinc-100">
            Silver cross pendant
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
              £28
            </span>
            <span className="font-mono text-[9px] text-zinc-500">8 views / week</span>
          </div>
        </div>

        <div
          className="cascade-item relative flex flex-col items-center justify-center gap-1.5 px-1 pt-8"
          style={{ '--stagger-delay': `140ms` } as CSSProperties}
        >
          <Icon name="rotate" className="h-5 w-5 text-zinc-400 dark:text-zinc-600" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400">
            relisting
          </span>
        </div>

        <div
          className="cascade-item flex flex-col gap-1.5 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-2"
          style={{ '--stagger-delay': `220ms` } as CSSProperties}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              Relisted
            </span>
            <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('success')}`}>
              FRESH
            </span>
          </div>
          <ProductImage
            type="tee"
            hue={200}
            src={PHOTO.crystalCross}
            className="aspect-square w-full rounded-md"
          />
          <div className="truncate text-[10.5px] font-medium text-zinc-900 dark:text-zinc-100">
            Crystal cross y2k pendant
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              £28
            </span>
            <span className="font-mono text-[9px] text-emerald-700/70 dark:text-emerald-300/70">
              just posted
            </span>
          </div>
        </div>
      </div>

      <div
        className="cascade-item flex flex-wrap items-center gap-1.5"
        style={{ '--stagger-delay': `300ms` } as CSSProperties}
      >
        {[
          ['Title', 'rewritten'],
          ['Photo', 'reordered'],
          ['Original', 'deleted'],
        ].map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/[0.02]"
          >
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-zinc-500">
              {k}
            </span>
            <span className="text-zinc-900 dark:text-zinc-100">{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PriceDropsPanel() {
  // Live demo: every 3 seconds, one tracked item ticks its price down by the
  // next-cycle amount, flashes green briefly, then settles. Cycles through
  // the tracked list. Tick = 100ms so the green-flash window can be tight.
  const TICKS_PER_DROP = 30; // 3s
  const FLASH_TICKS = 6; // 600ms green flash after the drop
  const tick = useAnimationTick(100);
  const dropIndex = Math.floor(tick / TICKS_PER_DROP);
  const inDrop = tick % TICKS_PER_DROP;

  type Row = {
    title: string;
    type: ProductType;
    photo: string;
    hue: number;
    start: number; // starting price at cycle 0
    step: number; // how much we drop per cycle
    floor: number;
    nextIn: string;
  };
  const baseRows: Row[] = [
    { title: 'Cross necklace', type: 'tee', photo: PHOTO.crossNecklace, hue: 195, start: 28, step: 3, floor: 18, nextIn: 'tomorrow' },
    { title: 'Sport shades', type: 'tee', photo: PHOTO.sportSunglasses, hue: 210, start: 24, step: 2, floor: 15, nextIn: '3 days' },
    { title: 'Rose charm', type: 'tee', photo: PHOTO.roseCharm, hue: 8, start: 12, step: 1, floor: 8, nextIn: '5 days' },
  ];

  const activeIdx = dropIndex % baseRows.length;
  const cycleNumber = Math.floor(dropIndex / baseRows.length);
  const flashing = inDrop < FLASH_TICKS;

  // Each row's price = start - (step × cycles_that_picked_it), clamped to floor.
  // For the active row we apply the new cycle's drop only AFTER it fires
  // (i.e. throughout the visible cycle, including the flash window).
  const priceFor = (i: number): number => {
    const drops = i <= activeIdx ? cycleNumber + 1 : cycleNumber;
    return Math.max(baseRows[i].floor, baseRows[i].start - baseRows[i].step * drops);
  };
  const previousPriceFor = (i: number): number => {
    const drops = i <= activeIdx ? cycleNumber : Math.max(0, cycleNumber - 1);
    return Math.max(baseRows[i].floor, baseRows[i].start - baseRows[i].step * drops);
  };
  return (
    <div className="cascade-list flex flex-col gap-2">
      <div
        className="cascade-item flex items-center justify-between rounded-md border border-black/[0.06] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="flex items-center gap-2">
          <Icon name="tag" className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Drop 10% every 7 days
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-500">stops at floor</span>
      </div>

      <ul className="cascade-list flex flex-col gap-1.5">
        {baseRows.map((r, i) => {
          const current = priceFor(i);
          const previous = previousPriceFor(i);
          const isActive = i === activeIdx;
          const justDropped = isActive && flashing;
          const dropPct = previous > 0 ? Math.round(((previous - current) / previous) * 100) : 0;
          const range = Math.max(1, r.start - r.floor);
          const progressToFloor = ((r.start - current) / range) * 100;
          return (
            <li
              key={r.title}
              className={`cascade-item relative flex flex-col gap-1.5 overflow-hidden rounded-md border px-2.5 py-2 transition-colors duration-300 ${
                justDropped
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06] dark:border-emerald-400/30 dark:bg-emerald-400/[0.06]'
                  : 'border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.02]'
              }`}
              style={{ '--stagger-delay': `${80 + i * 70}ms` } as CSSProperties}
            >
              <div className="flex items-center gap-2.5">
                <ProductImage
                  type={r.type}
                  hue={r.hue}
                  src={r.photo}
                  className="size-7 flex-shrink-0 rounded"
                />
                <div className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                  {r.title}
                </div>
                {justDropped && previous !== current ? (
                  <>
                    <span className="font-mono text-[10.5px] font-semibold text-zinc-900 line-through opacity-50 dark:text-zinc-100">
                      £{previous}
                    </span>
                    <Icon name="arrow-right" className="h-3 w-3 text-zinc-400" />
                    <span className="font-mono text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                      £{current}
                    </span>
                    <span className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('success')}`}>
                      DROPPED -{dropPct}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-[10.5px] font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                      £{current}
                    </span>
                    <span className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('neutral')}`}>
                      next -£{r.step}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-white/10">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-amber-500/70 transition-[width] duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, progressToFloor))}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-zinc-500">
                  next in {r.nextIn} · floor £{r.floor}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ShopTile = {
  id: string;
  title: string;
  type: ProductType;
  photo: string;
  hue: number;
  price: string;
};

const INITIAL_SHOP_TILES: ShopTile[] = [
  { id: 'starBeanie', title: 'Star beanie', type: 'tee', photo: PHOTO.starBeanie, hue: 220, price: '£22' },
  { id: 'sportSunglasses', title: 'Sport shades', type: 'tee', photo: PHOTO.sportSunglasses, hue: 210, price: '£24' },
  { id: 'crystalCross', title: 'Crystal cross', type: 'tee', photo: PHOTO.crystalCross, hue: 200, price: '£28' },
  { id: 'crossNecklace', title: 'Cross necklace', type: 'tee', photo: PHOTO.crossNecklace, hue: 195, price: '£18' },
  { id: 'roseCharm', title: 'Rose charm', type: 'tee', photo: PHOTO.roseCharm, hue: 8, price: '£12' },
  { id: 'strawberryRings', title: 'Strawberry rings', type: 'tee', photo: PHOTO.strawberryRings, hue: 0, price: '£16' },
];

function ShopDesignerPanel() {
  // Functional drag-and-drop: native HTML5 DnD, light enough for a preview.
  // Reorder by inserting the dragged tile into the drop target's slot and
  // shifting the rest.
  const [tiles, setTiles] = useState<ShopTile[]>(INITIAL_SHOP_TILES);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragId(id);
  };

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== overId) setOverId(id);
  };

  const handleDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = dragId ?? e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === id) {
      setDragId(null);
      setOverId(null);
      return;
    }
    setTiles((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((t) => t.id === draggedId);
      const toIdx = next.findIndex((t) => t.id === id);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragId(null);
    setOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="cascade-list flex flex-col gap-2">
      {/* Depop-style profile header */}
      <div
        className="cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-[12px] font-bold text-white">
          Y
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
              @your_shop
            </span>
            <span className="text-[9px] text-zinc-500">· London</span>
          </div>
          <div className="flex items-center gap-2 text-[9.5px] text-zinc-500">
            <span><span className="font-semibold text-zinc-900 dark:text-zinc-100">428</span> sold</span>
            <span>·</span>
            <span><span className="font-semibold text-zinc-900 dark:text-zinc-100">1.2k</span> followers</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-amber-500" aria-hidden="true">
                <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z" />
              </svg>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">5.0</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="flex-shrink-0 rounded-full bg-[#ff2300] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white"
        >
          Follow
        </button>
      </div>

      {/* Tabs row, Depop style */}
      <div
        className="cascade-item flex items-center gap-4 border-b border-black/[0.08] px-1 dark:border-white/10"
        style={{ '--stagger-delay': `40ms` } as CSSProperties}
      >
        <button
          type="button"
          tabIndex={-1}
          className="border-b-2 border-zinc-900 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
        >
          Selling ({tiles.length})
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400"
        >
          Sold
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400"
        >
          Likes
        </button>
      </div>

      {/* Drag-and-drop grid, Depop-style packed square thumbnails */}
      <ul
        className="cascade-list grid grid-cols-3 gap-0.5"
        aria-label="Shop layout, drag to reorder"
      >
        {tiles.map((t, i) => {
          const isDragging = t.id === dragId;
          const isOver = t.id === overId && t.id !== dragId;
          return (
            <li
              key={t.id}
              draggable
              onDragStart={handleDragStart(t.id)}
              onDragOver={handleDragOver(t.id)}
              onDrop={handleDrop(t.id)}
              onDragEnd={handleDragEnd}
              className={`cascade-item group relative cursor-grab overflow-hidden bg-white transition-all active:cursor-grabbing dark:bg-white/[0.02] ${
                isDragging
                  ? 'scale-95 opacity-40'
                  : isOver
                  ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950'
                  : ''
              }`}
              style={{ '--stagger-delay': `${80 + i * 40}ms` } as CSSProperties}
            >
              <ProductImage
                type={t.type}
                hue={t.hue}
                src={t.photo}
                className="aspect-square w-full"
              />
              {/* Price overlay (Depop shows it on hover, we keep visible) */}
              <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-[1px] text-[9px] font-bold text-white">
                {t.price}
              </span>
              {/* Grip dots (top-right, Depop doesn't have this but shows
                  it's draggable) */}
              <span
                className="pointer-events-none absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-white/85 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-900/85"
                aria-hidden
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-zinc-700 dark:text-zinc-300" fill="currentColor">
                  <circle cx="4" cy="3" r="1" />
                  <circle cx="8" cy="3" r="1" />
                  <circle cx="4" cy="6" r="1" />
                  <circle cx="8" cy="6" r="1" />
                  <circle cx="4" cy="9" r="1" />
                  <circle cx="8" cy="9" r="1" />
                </svg>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Helper line + sync status */}
      <div
        className="cascade-item flex items-center justify-between rounded-md border border-dashed border-black/10 bg-zinc-50/60 px-3 py-1.5 dark:border-white/15 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `${80 + 6 * 40}ms` } as CSSProperties}
      >
        <span className="font-mono text-[10px] text-zinc-500">
          Drag tiles to reorder · auto-syncs to Depop
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Saved
        </span>
      </div>
    </div>
  );
}

function OffersPanel({ onInteract }: { onInteract?: () => void }) {
  type Offer = {
    id: string;
    platform: 'depop' | 'vinted';
    username: string;
    item: string;
    type: ProductType;
    photo: string;
    hue: number;
    listed: number;
    offer: number;
    received: string;
  };
  const BASE_OFFERS: Offer[] = [
    { id: 'a', platform: 'vinted', username: 'lila_resale', item: 'Star beanie', type: 'tee', photo: PHOTO.starBeanie, hue: 220, listed: 22, offer: 18, received: '2m ago' },
    { id: 'b', platform: 'depop', username: 'kai_pop', item: 'Sport shades', type: 'tee', photo: PHOTO.sportSunglasses, hue: 210, listed: 24, offer: 20, received: '14m ago' },
    { id: 'c', platform: 'vinted', username: 'sam_thrifts', item: 'Crystal cross', type: 'tee', photo: PHOTO.crystalCross, hue: 200, listed: 28, offer: 24, received: '1h ago' },
  ];

  type Resolution = 'accepted' | 'countered' | 'declined';
  // Per-offer state machine, four phases:
  //   pending  → user hasn't acted yet, buttons visible
  //   resolved → user clicked, confirmation pill swaps in (~900ms hold)
  //   leaving  → exit animation playing (collapse + fade, ~350ms)
  //   gone     → unmounted from the list
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  const handle = (id: string, action: Resolution) => {
    if (resolved[id]) return; // ignore double-clicks
    onInteract?.();
    setResolved((r) => ({ ...r, [id]: action }));
    // Confirmation pill holds for 900ms so the user reads the action they
    // triggered, then the exit animation runs for 350ms, then we drop the
    // card from the DOM. Two timers keeps the choreography legible.
    window.setTimeout(() => {
      setLeaving((l) => ({ ...l, [id]: true }));
      window.setTimeout(() => {
        setRemoved((r) => ({ ...r, [id]: true }));
      }, 350);
    }, 900);
  };

  // Reset everything when nothing's left so the demo restores itself after a
  // few seconds of empty inbox. (Without this the visitor sees a permanently
  // empty panel after their first round of clicks.)
  const allDone = BASE_OFFERS.every((o) => removed[o.id]);
  useEffect(() => {
    if (!allDone) return;
    const t = window.setTimeout(() => {
      setResolved({});
      setLeaving({});
      setRemoved({});
    }, 2000);
    return () => window.clearTimeout(t);
  }, [allDone]);

  const remainingCount = BASE_OFFERS.filter((o) => !removed[o.id]).length;

  return (
    <div className="cascade-list flex flex-col gap-1.5">
      <ul className="cascade-list flex flex-col gap-1.5">
        {BASE_OFFERS.map((o, i) => {
          if (removed[o.id]) return null;
          const state = resolved[o.id];
          const isLeaving = leaving[o.id];
          const dropPct = Math.round(((o.listed - o.offer) / o.listed) * 100);
          return (
            <li
              key={o.id}
              className={`${isLeaving ? 'hero-offer-row-exit' : 'cascade-item'} flex flex-col gap-1.5 rounded-md border bg-white px-2.5 py-2 transition-colors duration-300 dark:bg-white/[0.02] ${platformBorder(o.platform)} ${
                state === 'accepted'
                  ? 'border-emerald-500/40 bg-emerald-500/[0.05] dark:border-emerald-400/40 dark:bg-emerald-400/[0.06]'
                  : state === 'declined'
                  ? 'border-zinc-400/40 opacity-60 dark:border-white/20'
                  : state === 'countered'
                  ? 'border-amber-500/40 bg-amber-500/[0.05] dark:border-amber-400/40 dark:bg-amber-400/[0.06]'
                  : 'border-black/[0.06] dark:border-white/10'
              }`}
              style={{ '--stagger-delay': `${i * 70}ms` } as CSSProperties}
            >
              <div className="flex items-center gap-2.5">
                <ProductImage
                  type={o.type}
                  hue={o.hue}
                  src={o.photo}
                  className="size-8 flex-shrink-0 rounded"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                      @{o.username}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-400">·</span>
                    <span className="truncate text-[10.5px] text-zinc-500">{o.item}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] text-zinc-500 line-through">
                      £{o.listed}
                    </span>
                    <Icon name="arrow-right" className="h-2.5 w-2.5 text-zinc-400" />
                    <span className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                      £{o.offer}
                    </span>
                    <span className={`rounded-full px-1.5 py-[1px] text-[8.5px] font-semibold tracking-[0.08em] ${chipClass('warn')}`}>
                      -{dropPct}%
                    </span>
                    <span className="ml-auto font-mono text-[9px] text-zinc-400">
                      {o.received}
                    </span>
                  </div>
                </div>
              </div>
              {state ? (
                /* Confirmation pill replacing the buttons for ~900ms */
                <div
                  className={`hero-offer-confirm-in flex items-center justify-center rounded px-2 py-1 text-[10.5px] font-semibold tracking-[0.06em] ${
                    state === 'accepted'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : state === 'countered'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-zinc-900/[0.06] text-zinc-500 dark:bg-white/10'
                  }`}
                >
                  {state === 'accepted' && `Accepted at £${o.offer}`}
                  {state === 'countered' && `Countered with £${Math.round((o.listed + o.offer) / 2)}`}
                  {state === 'declined' && 'Declined'}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handle(o.id, 'accepted')}
                    className="flex-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 active:bg-emerald-500/40 dark:text-emerald-300"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(o.id, 'countered')}
                    className="flex-1 rounded bg-zinc-900/[0.06] px-2 py-1 text-[10px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-900/10 active:bg-zinc-900/[0.18] dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                  >
                    Counter
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(o.id, 'declined')}
                    className="flex-1 rounded px-2 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-900/[0.04] active:bg-zinc-900/[0.1] dark:hover:bg-white/[0.06]"
                  >
                    Decline
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {allDone && (
          <li className="rounded-md border border-dashed border-black/10 px-3 py-6 text-center text-[10.5px] text-zinc-500 dark:border-white/15">
            Inbox empty. New offers reappear in a moment…
          </li>
        )}
      </ul>
      <div className="mt-auto flex items-center justify-between border-t border-black/[0.06] pt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-500 dark:border-white/10">
        <span>Pending offers</span>
        <span className="font-mono text-[9.5px] text-zinc-600 tabular-nums dark:text-zinc-400">
          {remainingCount}
        </span>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────

export function HeroPreview() {
  const t = useTranslations('Home.preview');
  const [activeTab, setActiveTab] = useState<TabId>('crosslist');
  const [userInteracted, setUserInteracted] = useState(false);
  const [interactionTick, setInteractionTick] = useState(0);
  const bumpInteraction = () => {
    setUserInteracted(true);
    setInteractionTick((n) => n + 1);
  };
  const headerTitle = t(`headers.${activeTab}.title`);
  const headerMeta = t(`headers.${activeTab}.meta`);

  // Animate the panel container height to match whichever panel is active.
  // Panels have different intrinsic heights, so without this the card
  // snaps when tabs change. We deliberately drive height with two state
  // updates per swap so the browser actually sees a transition trigger:
  //
  //   1. Initial mount + after any swap settles: measure and lock current
  //      content height (useLayoutEffect, pre-paint).
  //   2. On activeTab change: keep the previous height for one paint, then
  //      set the new height in rAF so the browser interpolates from
  //      oldHeight -> newHeight rather than collapsing both updates into
  //      one paint (which would skip the transition entirely).
  const contentRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // Initial measurement, runs before first paint to avoid a 300px -> real
  // jump on mount.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (panelHeight === null) setPanelHeight(el.scrollHeight);
    // panelHeight intentionally omitted from deps: we only want the
    // first-mount measurement here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shrink reads as more abrupt than grow at the same duration (the eye
  // tracks the disappearing area), so we lengthen the transition when the
  // next panel is shorter than the current one.
  const [transitionDuration, setTransitionDuration] = useState(320);

  // On every tab change, wait one frame so the previous height paints with
  // the new content clipped to it, then transition to the new height.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const next = el.scrollHeight;
      setPanelHeight((curr) => {
        if (curr === next) return curr;
        if (curr !== null) {
          setTransitionDuration(next < curr ? 480 : 320);
        }
        return next;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

  // Auto-cycle through tabs as a passive demo on page load. Stops as soon
  // as the user clicks any sidebar tab (so we don't fight their interaction)
  // and is skipped entirely if the user has reduced-motion enabled.
  useEffect(() => {
    if (userInteracted) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const order: TabId[] = [
      'crosslist',
      'restocker',
      'shopDesigner',
      'listings',
      'relister',
      'priceDrops',
      'followBot',
      'offers',
      'autoOffers',
      'conversations',
      'labels',
    ];
    const timer = window.setInterval(() => {
      setActiveTab((curr) => {
        const idx = order.indexOf(curr);
        return order[(idx + 1) % order.length];
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [userInteracted]);

  // Resume auto-cycling after a stretch of inactivity. Each interaction
  // bumps interactionTick, which resets this timer.
  useEffect(() => {
    if (!userInteracted) return;
    const t = window.setTimeout(() => setUserInteracted(false), 15000);
    return () => window.clearTimeout(t);
  }, [userInteracted, interactionTick]);

  const handleTabClick = (id: TabId) => {
    bumpInteraction();
    setActiveTab(id);
  };

  return (
    <div className="relative mx-auto w-full">
      <div className="relative rounded-2xl bg-gradient-to-b from-black/15 via-black/5 to-transparent p-px shadow-[0_40px_100px_-30px_rgba(0,0,0,0.45)] dark:from-white/20 dark:via-white/5 dark:to-white/0 dark:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)]">
        <div className="relative overflow-hidden rounded-[15px] bg-white/95 backdrop-blur-xl dark:bg-zinc-950/95">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <img
                src="/salelinx-logo.png"
                alt=""
                aria-hidden="true"
                width={16}
                height={22}
                className="h-4 w-auto object-contain dark:invert"
              />
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-zinc-700 dark:text-zinc-300">
                SaleLinx
              </span>
              <span className="relative ml-1 inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-[148px_1fr] sm:divide-x sm:divide-black/[0.06] dark:sm:divide-white/10">
            <nav
              className="flex gap-1 overflow-x-auto border-b border-black/[0.06] bg-zinc-50/60 p-2 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-0 sm:p-3 dark:border-white/10 dark:bg-white/[0.02] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Preview sections"
            >
              {SIDE_TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? 'flex flex-shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-left text-[12px] font-medium text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_12px_-6px_rgba(0,0,0,0.15)] transition-colors sm:gap-2 dark:bg-white/[0.08] dark:text-zinc-50'
                        : 'flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-zinc-600 transition-colors hover:bg-white/60 hover:text-zinc-900 sm:gap-2 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-100'
                    }
                  >
                    <span
                      className={
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }
                    >
                      <Icon name={tab.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span>{t(`tabs.${tab.id}`)}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex flex-col p-3 sm:p-5">
              <div className="flex items-center justify-between pb-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                  {headerTitle}
                </div>
                <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  {headerMeta}
                </div>
              </div>
              <div
                className="panel-height-anim relative overflow-hidden"
                style={{
                  // Lock to the tallest panel so the rest of the page below
                  // doesn't bounce when tabs swap. Dynamic panelHeight still
                  // animates if a panel exceeds the floor, but with a high
                  // enough floor every panel fits and the outer box stays put.
                  height: panelHeight !== null ? `${Math.max(panelHeight, 480)}px` : undefined,
                  minHeight: 480,
                  transitionDuration: `${transitionDuration}ms`,
                }}
              >
                <div ref={contentRef}>
                  <div key={activeTab} className="panel-swap flex flex-col">
                    {activeTab === 'listings' && <ListingsPanel />}
                    {activeTab === 'crosslist' && <CrosslistPanel />}
                    {activeTab === 'shopDesigner' && <ShopDesignerPanel />}
                    {activeTab === 'restocker' && <RestockerPanel />}
                    {activeTab === 'relister' && <RelisterPanel />}
                    {activeTab === 'priceDrops' && <PriceDropsPanel />}
                    {activeTab === 'followBot' && <FollowBotPanel />}
                    {activeTab === 'offers' && (
                      <OffersPanel onInteract={bumpInteraction} />
                    )}
                    {activeTab === 'autoOffers' && <AutoOffersPanel />}
                    {activeTab === 'conversations' && <ConversationsPanel />}
                    {activeTab === 'labels' && <LabelsPanel />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 -bottom-8 flex justify-center">
        <div className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
          Runs in your browser · Depop + Vinted
        </div>
      </div>
    </div>
  );
}
