"use client";

import type { CSSProperties } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Refresher scene.
 *
 * A Depop shop grid being re-saved from the bottom up, each tile's age
 * resetting to "now" as it goes. Bottom up is the detail worth showing: the
 * newest re-save lands on top, so working from the last tile to the first
 * leaves the shop in exactly the order the seller arranged. Depop only, like
 * the feature, which is why only the one wordmark appears.
 *
 * The cadence row is the scheduler (docs/inventory/refresh): every 4 to 24
 * hours, here sitting on 6.
 */

const TILES: { photo: string; age: number }[] = [
  { photo: "/products/star-beanie.jpg", age: 3 },
  { photo: "/products/strawberry-rings.jpg", age: 5 },
  { photo: "/products/sport-sunglasses.jpg", age: 8 },
  { photo: "/products/cross-necklace.jpg", age: 11 },
  { photo: "/products/union-jack-beanie.jpg", age: 14 },
  { photo: "/products/white-star-beanie.jpg", age: 20 },
];

const CADENCES = [4, 6, 8, 12, 24];
const CADENCE = 6;

const TICK_MS = 100;
const CYCLE = 100; // 10s
const START = 10;
const TICKS_PER_TILE = 7;
const END = START + TILES.length * TICKS_PER_TILE;

export function RefresherScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const phase = reduced ? CYCLE - 1 : tick % CYCLE;

  // How many tiles are done. They go last-first, so tile i is done once
  // (TILES.length - 1 - i) of them are.
  const refreshed = Math.min(
    TILES.length,
    Math.max(0, Math.floor((phase - START) / TICKS_PER_TILE)),
  );
  const current = phase >= START && phase < END ? TILES.length - 1 - refreshed : -1;
  const done = phase >= END;

  const status = done
    ? `Shop back on top, next run in ${CADENCE}h`
    : current >= 0
      ? `Re-saving ${refreshed + 1} of ${TILES.length}, bottom up`
      : "Same photos, same price, same order";

  return (
    <div className="cascade-list flex flex-col items-center gap-6 lg:gap-8">
      <div
        className="cascade-item flex w-full max-w-[260px] flex-col items-center gap-3 lg:max-w-[340px]"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        <BrandWordmark brand="depop" variant="wordmark" height="0.9em" />
        <ul className="grid w-full grid-cols-3 gap-2">
          {TILES.map((t, i) => {
            const isDone = TILES.length - 1 - i < refreshed;
            const isCurrent = i === current;
            return (
              <li
                key={t.photo}
                className={`relative rounded-lg transition-shadow duration-300 ${
                  isCurrent
                    ? "shadow-[0_0_0_2px_rgb(16_185_129_/_0.7)] dark:shadow-[0_0_0_2px_rgb(52_211_153_/_0.7)]"
                    : ""
                }`}
              >
                <ProductImage
                  type="tee"
                  hue={210}
                  src={t.photo}
                  className="aspect-square w-full rounded-lg"
                />
                <span
                  className={`absolute bottom-1 right-1 rounded-sm px-1 py-[1px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] transition-colors duration-300 ${
                    isDone
                      ? "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-zinc-900"
                      : "bg-white/90 text-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-300"
                  }`}
                >
                  {isDone ? "now" : `${t.age}d`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className="cascade-item flex items-center gap-1.5"
        style={{ "--stagger-delay": "120ms" } as CSSProperties}
      >
        <span className="me-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 lg:text-[10px] dark:text-zinc-500">
          Every
        </span>
        {CADENCES.map((h) => (
          <span
            key={h}
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
              h === CADENCE
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-black/[0.05] text-zinc-500 dark:bg-white/[0.07] dark:text-zinc-400"
            }`}
          >
            {h}h
          </span>
        ))}
      </div>

      <div
        className="cascade-item flex w-full max-w-[220px] flex-col items-center gap-2.5 lg:max-w-[300px]"
        style={{ "--stagger-delay": "200ms" } as CSSProperties}
      >
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TILES.length}
          aria-valuenow={refreshed}
          aria-label={status}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              done
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${(refreshed / TILES.length) * 100}%` }}
          />
        </div>
        <span
          aria-hidden
          className={`text-center font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 lg:text-[10px] ${
            done
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
