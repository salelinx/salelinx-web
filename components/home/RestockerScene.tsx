"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ProductImage } from "./ProductImage";

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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const START_STOCK = 3;

/**
 * The stock count as a rolling column rather than a swapped digit.
 *
 * A number that simply changed gave no cue which column had moved, so the
 * one-beat lag between the two shops - the thing the feature is - went by
 * unread. Rolling it draws the eye to the column that is moving, at the moment
 * it moves.
 *
 * The offset is in `em`, not a percentage: a percentage translateY resolves
 * against the whole column's height (every digit), so it would scroll four
 * rows at a time. Each row is exactly 1em, so `idx * -1em` lands on the digit.
 */
function StockDigits({ stock, max }: { stock: number; max: number }) {
  const idx = max - stock;
  return (
    <>
      <span className="sr-only">{stock}</span>
      <span aria-hidden className="block h-[1em] overflow-hidden">
        <span
          className="restock-roll flex flex-col transition-transform duration-[520ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ transform: `translateY(calc(${idx} * -1em))` }}
        >
          {Array.from({ length: max + 1 }, (_, i) => max - i).map((n) => (
            <span key={n} className="block h-[1em] leading-[1em]">
              {n}
            </span>
          ))}
        </span>
      </span>
    </>
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
  const soldOn: "depop" | "vinted" = step % 2 === 0 ? "depop" : "vinted";

  // Phases within a cycle: rest, the sale landing, then the other shop
  // catching up. Reduced motion holds the settled state, which is the frame
  // that carries the story anyway.
  type Phase = "rest" | "sold" | "synced";
  const phase: Phase = reduced
    ? "synced"
    : step === 0 && cycle > 0 && inCycle < 14
      ? "rest" // the restock beat, before the next sale
      : inCycle < 12
        ? "rest"
        : inCycle < 26
          ? "sold"
          : "synced";

  const soldStock = Math.max(0, stockBefore - 1);
  const sourceStock = phase === "rest" ? stockBefore : soldStock;
  // The whole point: the other shop lags by a beat, then matches.
  const otherStock = phase === "synced" ? soldStock : stockBefore;

  const depopStock = soldOn === "depop" ? sourceStock : otherStock;
  const vintedStock = soldOn === "vinted" ? sourceStock : otherStock;

  const status =
    phase === "rest"
      ? "Watching both shops"
      : phase === "sold"
        ? `Sold on ${soldOn === "depop" ? "Depop" : "Vinted"}`
        : soldStock === 0
          ? `Out of stock, removed from ${soldOn === "depop" ? "Vinted" : "Depop"}`
          : `${soldOn === "depop" ? "Vinted" : "Depop"} stock updated to ${soldStock}`;

  // One item, two shops, one stock count. The old panel told this with a sale
  // "event" card, two mocked shop cards, an @handle, a price, a status banner
  // and a Sale pill — invented app chrome around a very simple idea. What
  // actually matters is that both numbers end up the same, so the numbers are
  // the panel.
  const total = START_STOCK;
  const sold = total - Math.min(depopStock, vintedStock);
  const progress = (sold / total) * 100;

  return (
    <div className="cascade-list panel-fluid flex flex-col items-center gap-7 lg:gap-9">
      <figure
        className="cascade-item m-0 flex flex-col items-center gap-4"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        {/* Not the beanie: that photo is the centrepiece of the crosslist
            scene a few segments earlier, so the same item was carrying two
            scenes in a row. The hue is the placeholder tint if the file fails
            to load.

            The frame is 5:2, not square, even though the file is 1254x1254:
            the watch itself is only 419px tall in there, with ~400px of empty
            margin above and below. A square box spent two thirds of its height
            rendering nothing, which is what made the watch look small. At 5:2
            object-cover crops to the middle 502px band - comfortably clear of
            the product at 403..822 - so the same box width renders a much
            bigger watch. */}
        <ProductImage
          type="tee"
          hue={210}
          src="/watch.png"
          imgClassName="restock-idle"
          noBackdrop
          className="aspect-[5/2] w-72 sm:w-80 lg:w-[30rem]"
        />
      </figure>

      {/* The two counts, side by side. The one the sale landed on drops first
          and the other follows a beat later — that lag IS the feature, so it
          is the only thing animating. */}
      <div
        className="cascade-item relative grid w-full max-w-[300px] grid-cols-2 gap-4 lg:max-w-[420px]"
        style={{ "--stagger-delay": "120ms" } as CSSProperties}
      >
        {/* The sync itself, crossing from the column that sold to the one that
            has to catch up. It runs only through `sold`, which is exactly the
            window the second shop is still showing the stale count, so it
            lands as that number rolls. Keyed by cycle so the animation
            restarts on every sale rather than playing once. */}
        {phase === "sold" && !reduced ? (
          <span
            key={`${cycle}-${soldOn}`}
            aria-hidden
            className={`restock-pulse pointer-events-none absolute top-[52%] z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18),0_0_12px_2px_rgba(16,185,129,0.5)] dark:bg-emerald-400 ${
              soldOn === "vinted" ? "restock-pulse-ltr" : "restock-pulse-rtl"
            }`}
          />
        ) : null}
        {(
          [
            ["vinted", vintedStock],
            ["depop", depopStock],
          ] as const
        ).map(([brand, stock]) => {
          // Which side of the story this column is playing right now.
          //
          // The numbers alone never said which shop sold and which one
          // followed — both just changed, a beat apart, and you had to catch
          // the lag and read the status line at the bottom to work out what
          // had happened. Naming it per column is what makes the mechanic
          // legible: one says "sold here", the other says "matched" the
          // moment it catches up.
          const isSource = soldOn === brand;
          // The beat where this shop is still advertising stock that has
          // already gone. It is the oversell the feature exists to prevent,
          // and until now nothing in the scene ever looked at risk - both
          // numbers just drifted and then agreed. Holding it in red for the
          // one beat before the sync arrives is what gives the catch-up
          // something to be a relief from.
          const atRisk = !isSource && phase === "sold";
          // The at-risk beat is carried by the red strikethrough alone. A
          // caption naming it as well was saying the same thing twice, and it
          // was the longest label in the row, so it set the width of a slot
          // every other caption then sat inside.
          const caption =
            phase === "rest"
              ? ""
              : isSource
                ? "sold here"
                : phase === "synced"
                  ? stock === 0
                    ? "removed"
                    : "matched"
                  : "";
          const captionTone = isSource
            ? "text-zinc-500 dark:text-zinc-400"
            : "text-emerald-600 dark:text-emerald-400";
          return (
            <div key={brand} className="flex flex-col items-center gap-2">
              {/* Fixed-height slot, centred. The two wordmarks are set at
                  different heights (1em vs 1.25em) to look the same optical
                  size, which left the two columns' logo rows a few pixels
                  apart - so the numbers under them did not sit on one line. */}
              <span className="flex h-5 items-center justify-center lg:h-6">
                <BrandWordmark
                  brand={brand}
                  variant="wordmark"
                  height={brand === "depop" ? "1em" : "1.25em"}
                />
              </span>
              <span
                className={`text-[34px] font-medium tabular-nums leading-none tracking-tight transition-colors duration-300 lg:text-[52px] ${
                  stock === 0
                    ? "text-zinc-300 dark:text-zinc-700"
                    : "text-zinc-900 dark:text-zinc-100"
                } ${atRisk ? "restock-at-risk" : ""}`}
              >
                <StockDigits stock={stock} max={START_STOCK} />
              </span>
              {/* Fixed height and always rendered. An empty caption still holds
                  its line, so the numbers above it never move as the labels
                  come and go. */}
              <span
                aria-hidden
                className={`h-4 font-mono text-[9px] uppercase tracking-[0.14em] transition-opacity duration-300 lg:text-[10px] ${captionTone} ${
                  caption ? "opacity-100" : "opacity-0"
                }`}
              >
                {caption || "\u00a0"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Same progress line as the crosslist scene, so the two read as one
          family: a bar that fills, and a few words naming what just happened. */}
      <div className="cascade-item flex w-full max-w-[220px] flex-col items-center gap-2.5 lg:max-w-[300px]">
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={sold}
          aria-label={status}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              phase === "synced"
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          aria-hidden
          className={`text-center font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 lg:text-[10px] ${
            phase === "synced"
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
