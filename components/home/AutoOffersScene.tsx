"use client";

import type { CSSProperties } from "react";
import { PlatformBadge } from "./HeroPreview";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Auto-offers scene.
 *
 * One offer at a time, measured against the seller's threshold. The meter
 * fills to the offer's share of the asking price; past the notch it is
 * accepted on the spot, short of it the offer is left for the seller. That is
 * the whole rule (docs/automate/auto-offers): accept at N% of asking or more,
 * never counter or decline on its own, so the scene shows exactly those two
 * outcomes and nothing else.
 */

const THRESHOLD = 90;

const OFFERS: {
  handle: string;
  platform: "depop" | "vinted";
  item: string;
  photo: string;
  listed: number;
  offer: number;
}[] = [
  {
    handle: "kai_pop",
    platform: "depop",
    item: "Sport shades",
    photo: "/products/sport-sunglasses.jpg",
    listed: 24,
    offer: 22,
  },
  {
    handle: "mia_v",
    platform: "vinted",
    item: "Rose charm",
    photo: "/products/rose-charm.jpg",
    listed: 15,
    offer: 9,
  },
  {
    handle: "lila_resale",
    platform: "vinted",
    item: "Grey star beanie",
    photo: "/products/grey-star-beanie.jpg",
    listed: 20,
    offer: 20,
  },
  {
    handle: "noor.vtg",
    platform: "depop",
    item: "Western belt",
    photo: "/products/western-belt.jpg",
    listed: 40,
    offer: 30,
  },
];

const pct = (o: (typeof OFFERS)[number]) =>
  Math.round((o.offer / o.listed) * 100);
const accepts = (o: (typeof OFFERS)[number]) => pct(o) >= THRESHOLD;

const TICK_MS = 100;
const TICKS_PER_OFFER = 42;
const FILL_AT = 5;
const VERDICT_AT = 18;
// So the counters read as a tool that has been running for a while rather
// than one switched on as the page loaded.
const BASE_ACCEPTED = 14;
const BASE_LEFT = 3;

export function AutoOffersScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);

  const n = reduced ? 0 : Math.floor(tick / TICKS_PER_OFFER);
  const inOffer = reduced ? TICKS_PER_OFFER - 1 : tick % TICKS_PER_OFFER;
  const o = OFFERS[n % OFFERS.length];
  const filled = inOffer >= FILL_AT;
  const verdict = inOffer >= VERDICT_AT;
  const accepted = accepts(o);

  // Every offer that has reached its verdict so far, this one included.
  const processed = n + (verdict ? 1 : 0);
  let acceptedCount = BASE_ACCEPTED;
  for (let i = 0; i < processed; i++) {
    if (accepts(OFFERS[i % OFFERS.length])) acceptedCount++;
  }
  const leftCount = BASE_LEFT + processed - (acceptedCount - BASE_ACCEPTED);

  return (
    <div className="cascade-list flex flex-col items-center gap-6 lg:gap-8">
      <span
        className="cascade-item rounded-full bg-black/[0.05] px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-600 lg:text-[10.5px] dark:bg-white/[0.07] dark:text-zinc-300"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        Auto-accept at {THRESHOLD}% of asking or more
      </span>

      <div
        className="cascade-item w-full max-w-[320px] lg:max-w-[380px]"
        style={{ "--stagger-delay": "80ms" } as CSSProperties}
      >
        {/* Keyed by offer so each new one remounts: it slides in, and its
            meter starts from empty instead of shrinking from the last one. */}
        <div
          key={n}
          className={`scene-swap-in flex flex-col gap-3 rounded-lg border bg-white p-3 transition-colors duration-300 dark:bg-white/[0.02] ${
            verdict && accepted
              ? "border-emerald-500/40 dark:border-emerald-400/40"
              : "border-black/[0.08] dark:border-white/10"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ProductImage
              type="tee"
              hue={210}
              src={o.photo}
              className="size-10 shrink-0 rounded"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <PlatformBadge platform={o.platform} size={13} />
                <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                  @{o.handle}
                </span>
              </div>
              <div className="truncate text-[10.5px] text-zinc-500">
                {o.item}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[13px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                £{o.offer}
              </div>
              <div className="font-mono text-[9px] tabular-nums text-zinc-400">
                of £{o.listed}
              </div>
            </div>
          </div>

          {/* The meter. The notch is the seller's rule; the fill is this
              offer. Whether the fill passes the notch is the decision. */}
          <div className="relative pt-3.5">
            <span
              className="absolute top-0 -translate-x-1/2 font-mono text-[8.5px] tabular-nums text-zinc-500 dark:text-zinc-400"
              style={{ left: `${THRESHOLD}%` }}
            >
              {THRESHOLD}%
            </span>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-[1100ms] ease-out ${
                  !verdict
                    ? "bg-zinc-400 dark:bg-zinc-500"
                    : accepted
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : "bg-zinc-300 dark:bg-zinc-600"
                }`}
                style={{ width: filled ? `${pct(o)}%` : "0%" }}
              />
            </div>
            <span
              aria-hidden
              className="absolute bottom-[-3px] h-3 w-px bg-zinc-900 dark:bg-zinc-100"
              style={{ left: `${THRESHOLD}%` }}
            />
          </div>

          <div className="flex h-5 items-center justify-between">
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">
              {filled ? `${pct(o)}% of asking` : " "}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] transition-opacity duration-300 ${
                accepted
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-zinc-900/[0.06] text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
              } ${verdict ? "opacity-100" : "opacity-0"}`}
            >
              {accepted ? `Accepted at £${o.offer}` : "Left for you"}
            </span>
          </div>
        </div>
      </div>

      <div
        className="cascade-item grid w-full max-w-[300px] grid-cols-2 gap-4 lg:max-w-[380px]"
        style={{ "--stagger-delay": "160ms" } as CSSProperties}
      >
        {(
          [
            ["Auto-accepted", acceptedCount, true],
            ["Left for you", leftCount, false],
          ] as const
        ).map(([label, value, green]) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span
              className={`text-[34px] font-medium tabular-nums leading-none tracking-tight lg:text-[44px] ${
                green
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {value}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 lg:text-[10px] dark:text-zinc-500">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
