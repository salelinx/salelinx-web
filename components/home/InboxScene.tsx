'use client';

import { useEffect, useState } from 'react';

/**
 * Inbox scene.
 *
 * The scroll section used to render OffersPanel and ConversationsPanel side by
 * side in a two-column grid. That works on a desktop stage and falls apart on
 * a phone: each panel gets roughly 150px, so the offer cards wrap onto four
 * lines each and the chat bubbles end up one or two words wide.
 *
 * Splitting them in two was also the wrong read of the feature. The promise is
 * "one inbox" - Depop and Vinted, offers and messages, in a single list - and
 * showing two separate panels side by side illustrates the opposite. So this
 * is one column, one list, with offers and messages interleaved exactly as the
 * real tab shows them.
 *
 * Both original panels are still exported from HeroPreview and still drive the
 * hero's tab cycle; this only replaces what the scroll scene renders.
 */

type Platform = 'depop' | 'vinted';

type Item = {
  platform: Platform;
  handle: string;
  /** Offers carry an amount; messages carry a snippet. */
  offer?: string;
  text: string;
};

// Alternates platform and kind so any four-row window shows both marketplaces
// and both kinds of message, which is the whole point of the scene.
const POOL: Item[] = [
  { platform: 'vinted', handle: 'lila_resale', offer: '£18', text: 'Star beanie' },
  { platform: 'depop', handle: 'kai_pop', text: 'Is this still available?' },
  { platform: 'depop', handle: 'sam_thrifts', offer: '£24', text: 'Crystal cross' },
  { platform: 'vinted', handle: 'noor.vtg', text: 'Could you post tomorrow?' },
  { platform: 'vinted', handle: 'archive.folk', offer: '£20', text: 'Sport shades' },
  { platform: 'depop', handle: 'seconds.london', text: 'Thanks, it arrived today' },
  { platform: 'depop', handle: 'northgate.vtg', offer: '£31', text: 'Wool overshirt' },
  { platform: 'vinted', handle: 'ella.sourced', text: 'Do you have it in a M?' },
];

const ROWS = 4;
const TICK_MS = 100;
const TICKS_PER_ARRIVAL = 30; // 3s between arrivals - slow enough to read

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/** Positive modulo: the rows below the newest are numbered arrivals-1 ..
 *  arrivals-3, which are negative on a freshly loaded page, and JS gives
 *  -3 % 8 === -3. Indexing POOL with that yields undefined. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function PlatformMark({ platform }: { platform: Platform }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size platform logo; next/image adds no value here
    <img
      src={platform === 'depop' ? '/depop-logo.png' : '/vinted-logo.png'}
      alt={platform === 'depop' ? 'Depop' : 'Vinted'}
      width={13}
      height={13}
      className="flex-shrink-0 rounded-[3px] object-contain"
    />
  );
}

export function InboxScene() {
  const tick = useTick(TICK_MS);
  const arrivals = Math.floor(tick / TICKS_PER_ARRIVAL);

  const rows = Array.from({ length: ROWS }, (_, i) => {
    const n = arrivals - i;
    return { n, ...POOL[mod(n, POOL.length)], minutes: i * 4 + 2 };
  });

  const offers = rows.filter((r) => r.offer).length;

  return (
    <div className="panel-fluid flex flex-col items-center gap-7 lg:gap-9">
      {/* Fixed height, clipped.
          The list always holds ROWS entries, so an arrival mounts the newest
          row and unmounts the oldest in the same frame. The enter animation
          grows the new row from zero height, so an auto-height container
          collapsed to three rows and climbed back to four over 450ms, walking
          the caption below it down and back up on every arrival. Pinning the
          height to exactly ROWS rows absorbs that: the new row grows inside the
          box, the oldest slides out of the clip, and the caption never moves. */}
      <div
        className="flex w-full max-w-[300px] flex-col overflow-hidden lg:max-w-[400px]"
        style={{
          height: `calc(${ROWS} * var(--hero-follow-row-h))`,
          maskImage: 'linear-gradient(to bottom, #000 0, #000 72%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0, #000 72%, transparent 100%)',
        }}
      >
        {rows.map((row, i) => (
          // Keyed on the absolute arrival number so React mounts only the new
          // top row; the three below it reconcile in place and slide down as
          // its height animates in.
          <div
            key={row.n}
            className={`hero-follow-row-enter hero-follow-row flex shrink-0 items-center gap-2 border-b border-black/[0.05] last:border-0 dark:border-white/[0.07] ${
              i === 0 ? '' : 'opacity-60'
            }`}
          >
            <PlatformMark platform={row.platform} />
            <span className="shrink-0 font-mono text-[11px] text-zinc-600 lg:text-[12.5px] dark:text-zinc-300">
              @{row.handle}
            </span>
            <span className="truncate text-[11px] text-zinc-400 lg:text-[12.5px] dark:text-zinc-500">
              {row.offer ? (
                <>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    offered {row.offer}
                  </span>{' '}
                  · {row.text}
                </>
              ) : (
                row.text
              )}
            </span>
            {/* Offers carry the three actions; messages carry the timestamp.
                Both sit in the same slot at the same row height, so swapping
                between them cannot change the list's geometry.

                Rendered as spans, not buttons. Nothing here is wired to a
                handler — this is a scroll-driven illustration, and a real
                <button> that silently does nothing is worse than a picture of
                one. The interactive version lives in OffersPanel in the hero,
                where the clicks actually resolve. */}
            {row.offer ? (
              <span aria-hidden className="ml-auto flex shrink-0 items-center gap-1">
                <span className="rounded bg-emerald-500/15 px-1.5 py-[2px] text-[8.5px] font-semibold text-emerald-700 lg:text-[9.5px] dark:text-emerald-300">
                  Accept
                </span>
                <span className="rounded bg-zinc-900/[0.06] px-1.5 py-[2px] text-[8.5px] font-semibold text-zinc-600 lg:text-[9.5px] dark:bg-white/10 dark:text-zinc-300">
                  Counter
                </span>
                <span className="hidden rounded px-1.5 py-[2px] text-[8.5px] font-semibold text-zinc-400 sm:inline lg:text-[9.5px] dark:text-zinc-500">
                  Decline
                </span>
              </span>
            ) : (
              <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-400 lg:text-[10px] dark:text-zinc-600">
                {row.minutes}m
              </span>
            )}
          </div>
        ))}
      </div>

      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 lg:text-[10px] dark:text-zinc-500">
        {offers} offers · {ROWS - offers} messages · one inbox
      </span>
    </div>
  );
}
