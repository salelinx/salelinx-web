'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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
  label: string;
}

const SIDE_TABS: SideTab[] = [
  { id: 'crosslist', icon: 'swap', label: 'Crosslist' },
  { id: 'restocker', icon: 'refresh', label: 'Restocker' },
  { id: 'shopDesigner', icon: 'layout', label: 'Shop designer' },
  { id: 'listings', icon: 'grid', label: 'Listings' },
  { id: 'relister', icon: 'rotate', label: 'Relister' },
  { id: 'priceDrops', icon: 'tag', label: 'Price drops' },
  { id: 'followBot', icon: 'users', label: 'Follow bot' },
  { id: 'offers', icon: 'zap', label: 'Offers' },
  { id: 'autoOffers', icon: 'sparkle', label: 'Auto-offers' },
  { id: 'conversations', icon: 'message', label: 'Conversations' },
  { id: 'labels', icon: 'box', label: 'Labels' },
];

const TAB_HEADERS: Record<TabId, { title: string; meta: string }> = {
  listings: { title: 'My listings', meta: '128 in store' },
  crosslist: { title: 'Crosslist', meta: 'Vinted to Depop' },
  shopDesigner: { title: 'Shop designer', meta: 'Depop layout' },
  restocker: { title: 'Restocker', meta: 'Every 6h' },
  relister: { title: 'Relister', meta: 'Refreshing rank' },
  priceDrops: { title: 'Price drops', meta: '4 scheduled' },
  followBot: { title: 'Follow bot', meta: '218 / 500 today' },
  offers: { title: 'Offers', meta: '6 pending' },
  autoOffers: { title: 'Auto-offers', meta: 'Live' },
  conversations: { title: 'Inbox', meta: '3 unread' },
  labels: { title: 'Labels', meta: '5 to print' },
};

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
        <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] px-2 py-[2px] text-[9.5px] text-zinc-600 dark:border-white/15 dark:text-zinc-300">
          <PlatformBadge platform="vinted" size={10} />
          Vinted
        </span>
      </div>

      {/* Table header row */}
      <div
        className="cascade-item grid grid-cols-[28px_1fr_36px_56px_38px_60px_28px] items-center gap-2 px-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-zinc-500"
        style={{ '--stagger-delay': `40ms` } as CSSProperties}
      >
        <span />
        <span>Item</span>
        <span>Site</span>
        <span className="text-right">Price</span>
        <span className="text-right">Views</span>
        <span className="text-center">Restock</span>
        <span className="text-right">Listed</span>
      </div>

      {/* Listing rows */}
      <ul className="cascade-list flex flex-col gap-1">
        {rows.map((r, i) => (
          <li
            key={r.title}
            className="cascade-item grid grid-cols-[28px_1fr_36px_56px_38px_60px_28px] items-center gap-2 rounded-md border border-black/[0.06] bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
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
            <div className="text-right font-mono text-[10px] tabular-nums text-zinc-600 dark:text-zinc-400">
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
            <div className="text-right font-mono text-[9.5px] text-zinc-500">{r.listed}</div>
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
            <div className="truncate text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              Star beanie
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
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

        {/* Mapping arrow */}
        <div
          className="cascade-item relative flex flex-col items-center justify-center gap-1.5 px-1 pt-6"
          style={{ '--stagger-delay': `100ms` } as CSSProperties}
        >
          <svg
            className="size-5 text-zinc-400 dark:text-zinc-600"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 12h14m0 0l-5-5m5 5l-5 5"
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
            <div className="flex items-center gap-1 text-[9px] text-zinc-500">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#ff2300] text-[7px] font-bold text-white">
                Y
              </span>
              <span>@your_shop</span>
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
  const offers: {
    platform: 'depop' | 'vinted';
    chip: string;
    tone: 'success' | 'warn' | 'neutral';
    username: string;
    meta: string;
    hue: number;
    type: ProductType;
    photo: string;
    initial: string;
  }[] = [
    {
      platform: 'vinted',
      chip: 'BOUGHT',
      tone: 'success',
      username: 'lila_resale',
      meta: '8m ago · paid £18.00',
      hue: 195,
      type: 'tee',
      photo: PHOTO.crossNecklace,
      initial: 'L',
    },
    {
      platform: 'depop',
      chip: 'OFFERED',
      tone: 'success',
      username: 'sam_thrifts',
      meta: '1m ago · £24.00 (was £28)',
      hue: 200,
      type: 'tee',
      photo: PHOTO.crystalCross,
      initial: 'S',
    },
    {
      platform: 'depop',
      chip: 'SKIPPED',
      tone: 'warn',
      username: 'mia_v',
      meta: '2m ago · price floor reached',
      hue: 0,
      type: 'tee',
      photo: PHOTO.strawberryRings,
      initial: 'M',
    },
  ];
  return (
    <div className="cascade-list flex flex-col gap-1.5">
      <div
        className="cascade-item grid grid-cols-3 divide-x divide-black/[0.06] rounded-md border border-black/[0.06] bg-white py-1 text-center dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            42
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Sent
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            11
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Converted
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
            £273
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Earned
          </div>
        </div>
      </div>

      <ul className="cascade-list flex flex-col gap-1.5">
        {offers.map((row, i) => (
          <li
            key={row.initial + row.username}
            className={`cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.02] ${platformBorder(row.platform)}`}
            style={{ '--stagger-delay': `${60 + i * 70}ms` } as CSSProperties}
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
                  className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass(row.tone)}`}
                >
                  {row.chip}
                </span>
                <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                  @{row.username}
                </span>
              </div>
              <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-500">
                {row.meta}
              </div>
            </div>
            <ProductImage
              type={row.type}
              hue={row.hue}
              src={row.photo}
              className="size-9 flex-shrink-0 rounded-md"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RestockerPanel() {
  // Stock-aware restocker. Each item carries a current stock count and a
  // record of the most recent sale on each marketplace. The narrative the
  // panel tells: when one platform reports a sale, SaleLinx decrements
  // stock and (if any remains) auto-relists so the listing stays live.
  const rows: {
    title: string;
    hue: number;
    type: ProductType;
    photo: string;
    stock: number;
    soldOn?: 'depop' | 'vinted';
    soldAt?: string;
    justRestocked?: boolean;
    lowStock?: boolean;
  }[] = [
    {
      title: 'Star beanie',
      hue: 220,
      type: 'tee',
      photo: PHOTO.starBeanie,
      stock: 3,
      soldOn: 'vinted',
      soldAt: 'just now',
      justRestocked: true,
    },
    {
      title: 'Crystal cross',
      hue: 200,
      type: 'tee',
      photo: PHOTO.crystalCross,
      stock: 5,
    },
    {
      title: 'Cross necklace',
      hue: 195,
      type: 'tee',
      photo: PHOTO.crossNecklace,
      stock: 2,
      soldOn: 'depop',
      soldAt: '6m ago',
      justRestocked: true,
    },
    {
      title: 'Rose charm',
      hue: 8,
      type: 'tee',
      photo: PHOTO.roseCharm,
      stock: 1,
      lowStock: true,
    },
    {
      title: 'Sport shades',
      hue: 210,
      type: 'tee',
      photo: PHOTO.sportSunglasses,
      stock: 4,
    },
  ];
  return (
    <div className="cascade-list flex flex-col gap-2">
      {/* Live sale event - the trigger that drives a restock */}
      <div
        className="cascade-item flex items-center gap-2.5 overflow-hidden rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2"
        style={{ '--stagger-delay': `0ms` } as CSSProperties}
      >
        <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <ProductImage
          type="tee"
          hue={220}
          src={PHOTO.starBeanie}
          className="size-6 flex-shrink-0 rounded"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
            Star beanie sold on <span className="font-semibold">Vinted</span>
          </div>
          <div className="truncate text-[9.5px] text-emerald-700/80 dark:text-emerald-300/80">
            Stock 4 -&gt; 3 · auto-relisted to keep listing live
          </div>
        </div>
        <span className="font-mono text-[9px] text-emerald-700/70 dark:text-emerald-300/70">
          just now
        </span>
      </div>

      {/* Stats: how much restocking has happened today */}
      <div
        className="cascade-item grid grid-cols-3 divide-x divide-black/[0.06] rounded-md border border-black/[0.06] bg-white py-1 text-center dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `60ms` } as CSSProperties}
      >
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            12
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Restocks today
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
            £284
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

      {/* Stock list: each item with its count + recent activity */}
      <ul className="cascade-list flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li
            key={row.title}
            className="cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
            style={{ '--stagger-delay': `${120 + i * 55}ms` } as CSSProperties}
          >
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
              {row.soldOn && (
                <div className="truncate text-[9.5px] text-zinc-500">
                  Sold on {row.soldOn === 'depop' ? 'Depop' : 'Vinted'} · {row.soldAt}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {row.justRestocked && (
                <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('success')}`}>
                  RESTOCKED
                </span>
              )}
              {row.lowStock && (
                <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('warn')}`}>
                  LOW
                </span>
              )}
              <span className="flex items-baseline gap-0.5 rounded-md bg-zinc-900/[0.04] px-2 py-0.5 dark:bg-white/[0.06]">
                <span className={`font-mono text-[12px] font-semibold tabular-nums ${row.lowStock ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {row.stock}
                </span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-zinc-500">
                  in stock
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConversationsPanel() {
  const messages = [
    { hue: 178, initial: 'L', text: 'Is this still available?', time: '12:04', mine: false },
    {
      hue: 0,
      initial: 'Y',
      text: 'Yes! Shipping today if you grab it.',
      time: '12:05',
      mine: true,
    },
    { hue: 178, initial: 'L', text: 'Perfect, just paid.', time: '12:06', mine: false },
  ];
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
        {messages.map((m, i) => (
          <li
            key={i}
            className={`cascade-item flex items-end gap-1.5 ${m.mine ? 'flex-row-reverse' : ''}`}
            style={{ '--stagger-delay': `${80 + i * 80}ms` } as CSSProperties}
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
        <li
          className="cascade-item flex items-end gap-1.5"
          style={{ '--stagger-delay': `${80 + messages.length * 80}ms` } as CSSProperties}
        >
          <span
            className="flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
            style={avatarStyle(178)}
          >
            L
          </span>
          <div
            className="rounded-2xl rounded-bl-sm border border-black/[0.06] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
            aria-label="typing"
          >
            <span className="flex items-center gap-1">
              <span
                className="hero-typing-dot size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="hero-typing-dot size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
                style={{ animationDelay: '180ms' }}
              />
              <span
                className="hero-typing-dot size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
                style={{ animationDelay: '360ms' }}
              />
            </span>
          </div>
        </li>
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
  const recent: { username: string; hue: number; status: 'followed' | 'followed-back' | 'unfollowed' }[] = [
    { username: 'thrift_haven', hue: 22, status: 'followed-back' },
    { username: 'vintage_vee', hue: 200, status: 'followed' },
    { username: 'mia_v', hue: 312, status: 'followed' },
    { username: 'kai_pop', hue: 0, status: 'unfollowed' },
    { username: 'sam_thrifts', hue: 178, status: 'followed-back' },
  ];
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
        <span className="font-mono text-[10px] text-zinc-500">218 / 500</span>
      </div>

      <div
        className="cascade-item relative h-1.5 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-white/10"
        style={{ '--stagger-delay': `60ms` } as CSSProperties}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/80"
          style={{ width: '43.6%' }}
        />
      </div>

      <div
        className="cascade-item grid grid-cols-3 divide-x divide-black/[0.06] rounded-md border border-black/[0.06] bg-white py-1 text-center dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ '--stagger-delay': `120ms` } as CSSProperties}
      >
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            218
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Followed
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
            64
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Back
          </div>
        </div>
        <div className="px-2">
          <div className="font-mono text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            29%
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
            Rate
          </div>
        </div>
      </div>

      <ul className="cascade-list flex flex-col gap-1.5">
        {recent.map((r, i) => (
          <li
            key={r.username}
            className="cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
            style={{ '--stagger-delay': `${180 + i * 60}ms` } as CSSProperties}
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
        ))}
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
  const rows: {
    title: string;
    type: ProductType;
    photo: string;
    hue: number;
    current: number;
    next: number;
    nextIn: string;
    floor: number;
  }[] = [
    {
      title: 'Cross necklace',
      type: 'tee',
      photo: PHOTO.crossNecklace,
      hue: 195,
      current: 28,
      next: 25,
      nextIn: 'tomorrow',
      floor: 18,
    },
    {
      title: 'Sport shades',
      type: 'tee',
      photo: PHOTO.sportSunglasses,
      hue: 210,
      current: 24,
      next: 22,
      nextIn: '3 days',
      floor: 15,
    },
    {
      title: 'Rose charm',
      type: 'tee',
      photo: PHOTO.roseCharm,
      hue: 8,
      current: 12,
      next: 11,
      nextIn: '5 days',
      floor: 8,
    },
  ];
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
        {rows.map((r, i) => {
          const dropPct = Math.round(((r.current - r.next) / r.current) * 100);
          const progressToFloor =
            ((r.current - r.floor) / (r.current * 0.4)) * 100;
          return (
            <li
              key={r.title}
              className="cascade-item flex flex-col gap-1.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.02]"
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
                <span className="font-mono text-[10.5px] font-semibold text-zinc-900 line-through opacity-50 dark:text-zinc-100">
                  £{r.current}
                </span>
                <Icon name="arrow-right" className="h-3 w-3 text-zinc-400" />
                <span className="font-mono text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  £{r.next}
                </span>
                <span className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${chipClass('neutral')}`}>
                  -{dropPct}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-white/10">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-amber-500/70"
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

function OffersPanel() {
  const offers: {
    platform: 'depop' | 'vinted';
    username: string;
    item: string;
    type: ProductType;
    photo: string;
    hue: number;
    listed: number;
    offer: number;
    received: string;
  }[] = [
    {
      platform: 'vinted',
      username: 'lila_resale',
      item: 'Star beanie',
      type: 'tee',
      photo: PHOTO.starBeanie,
      hue: 220,
      listed: 22,
      offer: 18,
      received: '2m ago',
    },
    {
      platform: 'depop',
      username: 'kai_pop',
      item: 'Sport shades',
      type: 'tee',
      photo: PHOTO.sportSunglasses,
      hue: 210,
      listed: 24,
      offer: 20,
      received: '14m ago',
    },
    {
      platform: 'vinted',
      username: 'sam_thrifts',
      item: 'Crystal cross',
      type: 'tee',
      photo: PHOTO.crystalCross,
      hue: 200,
      listed: 28,
      offer: 24,
      received: '1h ago',
    },
  ];
  return (
    <div className="cascade-list flex flex-col gap-1.5">
      <ul className="cascade-list flex flex-col gap-1.5">
        {offers.map((o, i) => {
          const dropPct = Math.round(((o.listed - o.offer) / o.listed) * 100);
          return (
            <li
              key={o.username + o.item}
              className={`cascade-item flex flex-col gap-1.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.02] ${platformBorder(o.platform)}`}
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:text-emerald-300"
                >
                  Accept
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex-1 rounded bg-zinc-900/[0.06] px-2 py-1 text-[10px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-900/10 dark:bg-white/10 dark:text-zinc-200"
                >
                  Counter
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex-1 rounded px-2 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.06]"
                >
                  Decline
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex items-center justify-between border-t border-black/[0.06] pt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-500 dark:border-white/10">
        <span>Pending offers</span>
        <span className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <PlatformBadge platform="vinted" size={11} /> 4
          </span>
          <span className="inline-flex items-center gap-1">
            <PlatformBadge platform="depop" size={11} /> 2
          </span>
        </span>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────

export function HeroPreview() {
  const [activeTab, setActiveTab] = useState<TabId>('crosslist');
  const [userInteracted, setUserInteracted] = useState(false);
  const header = TAB_HEADERS[activeTab];

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
    }, 5000);
    return () => window.clearInterval(timer);
  }, [userInteracted]);

  const handleTabClick = (id: TabId) => {
    setUserInteracted(true);
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
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex flex-col p-3 sm:p-5">
              <div className="flex items-center justify-between pb-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                  {header.title}
                </div>
                <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  {header.meta}
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
                    {activeTab === 'offers' && <OffersPanel />}
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
