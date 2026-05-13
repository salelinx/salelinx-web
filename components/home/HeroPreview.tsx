'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { ProductImage, type ProductType } from './ProductImage';

type TabId =
  | 'listings'
  | 'crosslist'
  | 'autoOffers'
  | 'restocker'
  | 'conversations'
  | 'labels';

interface SideTab {
  id: TabId;
  icon: IconName;
  label: string;
}

const SIDE_TABS: SideTab[] = [
  { id: 'listings', icon: 'grid', label: 'Listings' },
  { id: 'crosslist', icon: 'swap', label: 'Crosslist' },
  { id: 'autoOffers', icon: 'sparkle', label: 'Auto-offers' },
  { id: 'restocker', icon: 'refresh', label: 'Restocker' },
  { id: 'conversations', icon: 'message', label: 'Conversations' },
  { id: 'labels', icon: 'box', label: 'Labels' },
];

const TAB_HEADERS: Record<TabId, { title: string; meta: string }> = {
  listings: { title: 'My listings', meta: '128 in store' },
  crosslist: { title: 'Crosslist', meta: 'Vinted to Depop' },
  autoOffers: { title: 'Auto-offers', meta: 'Live' },
  restocker: { title: 'Restocker', meta: 'Every 6h' },
  conversations: { title: 'Inbox', meta: '3 unread' },
  labels: { title: 'Labels', meta: '5 to print' },
};

// Stock photos sourced from Unsplash CDN. Hue is still used as a backdrop
// when the photo is missing or loading.
const PHOTO = {
  adidasSpezial:
    'https://images.unsplash.com/photo-1621665422246-fde75fb7e7f5?w=240&h=240&fit=crop&auto=format&q=70',
  vintageTee:
    'https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?w=240&h=240&fit=crop&auto=format&q=70',
  airMax90:
    'https://images.unsplash.com/photo-1603036050939-e0775d7d69bd?w=240&h=240&fit=crop&auto=format&q=70',
  carhartt:
    'https://images.unsplash.com/photo-1649937408746-4d2f603f91c8?w=240&h=240&fit=crop&auto=format&q=70',
  levi501:
    'https://images.unsplash.com/photo-1601278085511-992ec3000c8a?w=240&h=240&fit=crop&auto=format&q=70',
  drMartens:
    'https://images.unsplash.com/photo-1747083996241-3d86d9dbab11?w=240&h=240&fit=crop&auto=format&q=70',
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
  const items: {
    title: string;
    price: string;
    hue: number;
    type: ProductType;
    photo: string;
    platforms: ('depop' | 'vinted')[];
  }[] = [
    {
      title: 'Adidas Spezial',
      price: '£42',
      hue: 178,
      type: 'sneaker',
      photo: PHOTO.adidasSpezial,
      platforms: ['vinted'],
    },
    {
      title: 'Vintage tee',
      price: '£18',
      hue: 22,
      type: 'tee',
      photo: PHOTO.vintageTee,
      platforms: ['vinted', 'depop'],
    },
    {
      title: 'Air Max 90',
      price: '£65',
      hue: 312,
      type: 'sneaker',
      photo: PHOTO.airMax90,
      platforms: ['depop'],
    },
    {
      title: 'Carhartt jacket',
      price: '£85',
      hue: 200,
      type: 'jacket',
      photo: PHOTO.carhartt,
      platforms: ['vinted', 'depop'],
    },
    {
      title: 'Levi 501',
      price: '£35',
      hue: 40,
      type: 'jeans',
      photo: PHOTO.levi501,
      platforms: ['vinted'],
    },
    {
      title: 'Dr. Martens',
      price: '£55',
      hue: 0,
      type: 'boots',
      photo: PHOTO.drMartens,
      platforms: ['depop'],
    },
  ];
  return (
    <div className="cascade-list flex flex-col gap-2">
      <ul className="cascade-list grid grid-cols-3 gap-2">
        {items.map((item, i) => (
          <li
            key={item.title}
            className="cascade-item overflow-hidden rounded-lg border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.02]"
            style={{ '--stagger-delay': `${i * 45}ms` } as CSSProperties}
          >
            <ProductImage
              type={item.type}
              hue={item.hue}
              src={item.photo}
              className="aspect-[5/3] w-full"
            />
            <div className="flex items-center justify-between px-2 pt-1.5">
              <div className="truncate text-[10.5px] font-medium text-zinc-900 dark:text-zinc-100">
                {item.title}
              </div>
              <div className="font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                {item.price}
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 pt-1 pb-2">
              {item.platforms.map((p) => (
                <PlatformBadge key={p} platform={p} size={12} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div
        className="cascade-item flex items-center justify-center rounded-md border border-dashed border-black/10 py-1.5 font-mono text-[10px] text-zinc-500 dark:border-white/15"
        style={{ '--stagger-delay': `${6 * 45}ms` } as CSSProperties}
      >
        + 122 more
      </div>
    </div>
  );
}

function CrosslistPanel() {
  return (
    <div className="cascade-list flex flex-col gap-3">
      {/* Vinted (source) -> Depop (target) side-by-side. Same item, two
          platforms, tells the whole crosslist story in one glance.
          The grid itself is a cascade-list so each card animates in. */}
      <div className="cascade-list grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        {/* Source: Vinted */}
        <div
          className="cascade-item flex flex-col gap-1.5 overflow-hidden rounded-lg border border-black/[0.06] bg-white p-2 dark:border-white/10 dark:bg-white/[0.02]"
          style={{ '--stagger-delay': `0ms` } as CSSProperties}
        >
          <div className="flex items-center gap-1.5">
            <PlatformBadge platform="vinted" size={14} />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              Source
            </span>
          </div>
          <ProductImage
            type="sneaker"
            hue={178}
            src={PHOTO.adidasSpezial}
            className="aspect-square w-full rounded-md"
          />
          <div className="truncate text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Adidas Spezial
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
              £42
            </span>
            <span className="font-mono text-[9px] text-zinc-500">4 photos</span>
          </div>
        </div>

        {/* Arrow with floating mapping pills */}
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

        {/* Target: Depop */}
        <div
          className="cascade-item flex flex-col gap-1.5 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-2"
          style={{ '--stagger-delay': `200ms` } as CSSProperties}
        >
          <div className="flex items-center gap-1.5">
            <PlatformBadge platform="depop" size={14} />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              Target
            </span>
          </div>
          <ProductImage
            type="sneaker"
            hue={178}
            src={PHOTO.adidasSpezial}
            className="aspect-square w-full rounded-md"
          />
          <div className="truncate text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Adidas Spezial
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              £42
            </span>
            <span className="font-mono text-[9px] text-emerald-700/70 dark:text-emerald-300/70">
              Posting
            </span>
          </div>
        </div>
      </div>

      {/* Mapped fields summary: compact, shows what got resolved */}
      <div
        className="cascade-item flex flex-wrap items-center gap-1.5"
        style={{ '--stagger-delay': `300ms` } as CSSProperties}
      >
        {[
          ['Brand', 'Adidas'],
          ['Category', 'Trainers'],
          ['Size', 'UK 8'],
          ['Condition', 'Used'],
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
            Posting draft to Depop
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
      meta: '8m ago · paid £12.00',
      hue: 178,
      type: 'sneaker',
      photo: PHOTO.adidasSpezial,
      initial: 'L',
    },
    {
      platform: 'vinted',
      chip: 'OFFERED',
      tone: 'success',
      username: 'sam_thrifts',
      meta: '1m ago · £24.00 (was £32)',
      hue: 200,
      type: 'jacket',
      photo: PHOTO.carhartt,
      initial: 'S',
    },
    {
      platform: 'vinted',
      chip: 'SKIPPED',
      tone: 'warn',
      username: 'mia_v',
      meta: '2m ago · price floor reached',
      hue: 40,
      type: 'jeans',
      photo: PHOTO.levi501,
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
  const rows: {
    title: string;
    nextIn: string;
    hue: number;
    type: ProductType;
    photo: string;
    status: 'refreshed' | 'queued';
    boost?: string;
  }[] = [
    {
      title: 'Adidas Spezial',
      nextIn: 'Refreshed',
      hue: 178,
      type: 'sneaker',
      photo: PHOTO.adidasSpezial,
      status: 'refreshed',
      boost: '+34 views',
    },
    {
      title: 'Vintage tee',
      nextIn: '12m',
      hue: 22,
      type: 'tee',
      photo: PHOTO.vintageTee,
      status: 'queued',
    },
    {
      title: 'Air Max 90',
      nextIn: '2h',
      hue: 312,
      type: 'sneaker',
      photo: PHOTO.airMax90,
      status: 'queued',
    },
    {
      title: 'Carhartt jacket',
      nextIn: '5h',
      hue: 200,
      type: 'jacket',
      photo: PHOTO.carhartt,
      status: 'queued',
    },
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
            Auto-refresh running
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-500">
          Last cycle 4h ago · +127 impressions
        </span>
      </div>
      <ul className="cascade-list flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li
            key={row.title}
            className="cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
            style={{ '--stagger-delay': `${80 + i * 60}ms` } as CSSProperties}
          >
            <ProductImage
              type={row.type}
              hue={row.hue}
              src={row.photo}
              className="size-7 flex-shrink-0 rounded"
            />
            <div className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
              {row.title}
            </div>
            {row.boost && (
              <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {row.boost}
              </span>
            )}
            <span
              className={`flex-shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] ${
                row.status === 'refreshed' ? chipClass('success') : chipClass('neutral')
              }`}
            >
              {row.nextIn.toUpperCase()}
            </span>
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
          <span className="text-[10px] text-zinc-500">· Adidas Spezial</span>
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
      item: 'Adidas Spezial',
      type: 'sneaker',
      photo: PHOTO.adidasSpezial,
      carrier: 'rm',
      hue: 178,
    },
    {
      buyer: 'sam_thrifts',
      item: 'Carhartt jacket',
      type: 'jacket',
      photo: PHOTO.carhartt,
      carrier: 'evri',
      hue: 200,
    },
    {
      buyer: 'mia_v',
      item: 'Vintage tee',
      type: 'tee',
      photo: PHOTO.vintageTee,
      carrier: 'inpost',
      hue: 22,
    },
    {
      buyer: 'kai_pop',
      item: 'Air Max 90',
      type: 'sneaker',
      photo: PHOTO.airMax90,
      carrier: 'rm',
      hue: 312,
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

// ── Main ────────────────────────────────────────────────────────────

export function HeroPreview() {
  const [activeTab, setActiveTab] = useState<TabId>('listings');
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
      'listings',
      'crosslist',
      'autoOffers',
      'restocker',
      'conversations',
      'labels',
    ];
    const timer = window.setInterval(() => {
      setActiveTab((curr) => {
        const idx = order.indexOf(curr);
        return order[(idx + 1) % order.length];
      });
    }, 4500);
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
                  height: panelHeight !== null ? `${panelHeight}px` : undefined,
                  minHeight: 300,
                  transitionDuration: `${transitionDuration}ms`,
                }}
              >
                <div ref={contentRef}>
                  <div key={activeTab} className="panel-swap flex flex-col">
                    {activeTab === 'listings' && <ListingsPanel />}
                    {activeTab === 'crosslist' && <CrosslistPanel />}
                    {activeTab === 'autoOffers' && <AutoOffersPanel />}
                    {activeTab === 'restocker' && <RestockerPanel />}
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
