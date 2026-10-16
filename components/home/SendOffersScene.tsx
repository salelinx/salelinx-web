"use client";

import type { CSSProperties } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Send offers scene.
 *
 * One Vinted item and the people who liked it. Each liker gets an offer in
 * turn, then one of them buys, which is the point: likes turned into a sale.
 *
 * The price follows the extension's rule (src/features/auto-offer-bot.ts in
 * the extension repo): listed price minus the discount, raised to the floor if
 * the discount would go under it. 10% off £20 is £18, above the £17 floor.
 * Alternates between Vinted, where the people are likers, and eBay, where
 * they are watchers, one shop per loop.
 */

type Shop = "vinted" | "ebay";
const SHOPS: Shop[] = ["vinted", "ebay"];

const LISTED = 20;
const DISCOUNT = 10;
const FLOOR = 17;
const OFFER = Math.max(LISTED * (1 - DISCOUNT / 100), FLOOR);

const LIKERS: { handle: string; hue: number; liked: string }[] = [
  { handle: "lila_resale", hue: 200, liked: "2h" },
  { handle: "kai_pop", hue: 290, liked: "5h" },
  { handle: "mia_v", hue: 20, liked: "1d" },
  { handle: "sam_thrifts", hue: 140, liked: "2d" },
];
// Which liker buys at the end. Not the first: a sale on the very first offer
// reads as luck rather than as the payoff of sending them all.
const BUYER = 2;

const TICK_MS = 100;
const CYCLE = 110; // 11s
const START = 8;
const TICKS_PER_OFFER = 9;
const SENT_END = START + LIKERS.length * TICKS_PER_OFFER;
const SOLD_AT = SENT_END + 14;

function Heart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.1 4.4 2.5.8-1.4 2.3-2.5 4.4-2.5 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z"
      />
    </svg>
  );
}

function Eye({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SendOffersScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const phase = reduced ? CYCLE - 1 : tick % CYCLE;
  const shop = reduced ? SHOPS[0] : SHOPS[Math.floor(tick / CYCLE) % SHOPS.length];
  const ebay = shop === "ebay";
  const Mark = ebay ? Eye : Heart;

  const sent = Math.min(
    LIKERS.length,
    Math.max(0, Math.floor((phase - START) / TICKS_PER_OFFER)),
  );
  const sold = phase >= SOLD_AT;
  const done = sent === LIKERS.length;

  const status = sold
    ? `Sold to @${LIKERS[BUYER].handle} at £${OFFER}`
    : done
      ? `${LIKERS.length} offers sent`
      : phase >= START
        ? `Sending ${sent + 1} of ${LIKERS.length}`
        : `${DISCOUNT}% off, never below £${FLOOR}`;

  return (
    <div className="cascade-list flex flex-col items-center gap-6 lg:gap-8">
      <div
        className="cascade-item flex w-full max-w-[320px] items-center gap-3 lg:max-w-[380px]"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        <ProductImage
          type="tee"
          hue={220}
          src="/products/grey-star-beanie.jpg"
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          {/* Fixed-height slot, keyed so each loop's shop slides in. */}
          <span className="flex h-4 items-center">
            <span key={shop} className="scene-swap-in inline-flex">
              <BrandWordmark brand={shop} variant="wordmark" height={ebay ? "1.2em" : "0.95em"} />
            </span>
          </span>
          <div className="mt-1 truncate text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
            Grey star beanie
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
            <span className="tabular-nums">£{LISTED}</span>
            <span aria-hidden>·</span>
            <Mark className={`h-2.5 w-2.5 ${ebay ? "text-zinc-500" : "text-rose-500"}`} />
            <span className="tabular-nums">
              {LIKERS.length} {ebay ? "watchers" : "likes"}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-black/[0.05] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
          {DISCOUNT}% off
        </span>
      </div>

      <ul
        className="cascade-item flex w-full max-w-[320px] flex-col lg:max-w-[380px]"
        style={{ "--stagger-delay": "100ms" } as CSSProperties}
      >
        {LIKERS.map((l, i) => {
          const isSent = i < sent;
          const isBuyer = sold && i === BUYER;
          return (
            <li
              key={l.handle}
              className={`flex h-10 items-center justify-between gap-3 border-b border-black/[0.05] px-1 transition-colors duration-300 last:border-0 dark:border-white/[0.07] ${
                isBuyer ? "rounded-md bg-emerald-500/[0.08] dark:bg-emerald-400/[0.08]" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-[20px] shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold uppercase text-white"
                  style={{ background: `hsl(${l.hue} 55% 42%)` }}
                >
                  {l.handle[0]}
                </span>
                <span className="truncate font-mono text-[11px] text-zinc-600 lg:text-[12px] dark:text-zinc-300">
                  @{l.handle}
                </span>
              </span>
              {/* Every state is rendered and stacked, so the row never changes
                  width as one label replaces another. */}
              <span className="relative grid shrink-0 justify-items-end font-mono text-[9px] uppercase tracking-[0.12em] lg:text-[10px]">
                <span
                  className={`[grid-area:1/1] flex items-center gap-1 text-zinc-400 transition-opacity duration-300 dark:text-zinc-500 ${
                    isSent ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <Mark className={`h-2.5 w-2.5 ${ebay ? "text-zinc-400" : "text-rose-400"}`} />
                  {ebay ? "watched" : "liked"} {l.liked} ago
                </span>
                <span
                  className={`[grid-area:1/1] text-emerald-600 transition-opacity duration-300 dark:text-emerald-400 ${
                    isSent && !isBuyer ? "opacity-100" : "opacity-0"
                  }`}
                >
                  offer sent £{OFFER}
                </span>
                <span
                  className={`[grid-area:1/1] font-semibold text-emerald-700 transition-opacity duration-300 dark:text-emerald-300 ${
                    isBuyer ? "opacity-100" : "opacity-0"
                  }`}
                >
                  bought at £{OFFER}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className="cascade-item flex w-full max-w-[220px] flex-col items-center gap-2.5 lg:max-w-[300px]"
        style={{ "--stagger-delay": "200ms" } as CSSProperties}
      >
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={LIKERS.length}
          aria-valuenow={sent}
          aria-label={status}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              sold
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${(sent / LIKERS.length) * 100}%` }}
          />
        </div>
        <span
          aria-hidden
          className={`text-center font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 lg:text-[10px] ${
            sold
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
