"use client";

import type { CSSProperties } from "react";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Price drops scene.
 *
 * One item, its price stepping down on a schedule until it sells. The steps
 * follow the real maths in docs/automate/price-drops: drops are a percentage
 * of the ORIGINAL price, so 10% on £30 is £3 every cycle (£30, £27, £24), not
 * a shrinking amount. The floor chip is there because "never below a number
 * you choose" is the reassurance a seller needs before switching this on.
 */

const PRICES = [30, 27, 24];
const FLOOR = 21;
const DAYS = [0, 7, 14];
const SOLD_DAY = 16;

const TICK_MS = 100;
const CYCLE = 100; // 10s
// Ticks at which each drop lands, then the sale.
const DROP_AT = [18, 38];
const SOLD_AT = 60;

export function PriceDropScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const phase = reduced ? CYCLE - 1 : tick % CYCLE;

  const step = DROP_AT.filter((t) => phase >= t).length;
  const sold = phase >= SOLD_AT;
  const price = PRICES[step];
  const prev = step > 0 ? PRICES[step - 1] : null;

  const caption = sold
    ? `Sold on day ${SOLD_DAY}`
    : step === 0
      ? "Listed price"
      : `Day ${DAYS[step]}, ${step * 10}% off`;
  const status = sold
    ? `Sold at £${price}, ${step * 10}% off`
    : `10% off every 7 days, never below £${FLOOR}`;

  return (
    <div className="cascade-list flex flex-col items-center gap-6 lg:gap-8">
      <figure
        className="cascade-item relative m-0"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        <ProductImage
          type="tee"
          hue={30}
          src="/products/black-sunglasses.jpg"
          className="aspect-square w-36 rounded-2xl sm:w-40 lg:w-48"
        />
        <span
          aria-hidden={!sold}
          className={`absolute -right-4 top-2 rotate-6 rounded-md border-2 border-emerald-500 bg-white px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 shadow-sm transition-[opacity,transform] duration-300 dark:border-emerald-400 dark:bg-zinc-900 dark:text-emerald-400 ${
            sold ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        >
          Sold
        </span>
      </figure>

      <div
        className="cascade-item flex flex-col items-center gap-2"
        style={{ "--stagger-delay": "120ms" } as CSSProperties}
      >
        <div className="flex items-baseline gap-3">
          {/* Always rendered so the big price does not shift sideways the
              first time a drop gives it something to sit next to. */}
          <span
            className={`font-mono text-sm tabular-nums text-zinc-400 line-through transition-opacity duration-300 lg:text-base dark:text-zinc-500 ${
              prev ? "opacity-100" : "opacity-0"
            }`}
          >
            £{prev ?? PRICES[0]}
          </span>
          <span
            key={price}
            className={`scene-swap-in text-[34px] font-medium tabular-nums leading-none tracking-tight transition-colors duration-500 lg:text-[52px] ${
              sold
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            £{price}
          </span>
        </div>
        <span
          aria-hidden
          className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 lg:text-[10px] dark:text-zinc-500"
        >
          {caption}
        </span>
      </div>

      <div
        className="cascade-item flex w-full max-w-[300px] flex-col items-center gap-2.5 lg:max-w-[360px]"
        style={{ "--stagger-delay": "200ms" } as CSSProperties}
      >
        <ol
          className="grid w-full grid-cols-4 gap-1.5"
          aria-label={status}
        >
          {PRICES.map((p, i) => (
            <li
              key={p}
              className={`flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors duration-300 ${
                i === step
                  ? sold
                    ? "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-zinc-900"
                    : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : i < step
                    ? "bg-black/[0.03] text-zinc-400 dark:bg-white/[0.04] dark:text-zinc-500"
                    : "bg-black/[0.05] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300"
              }`}
            >
              <span
                className={`font-mono text-[11px] font-semibold tabular-nums ${
                  i < step ? "line-through" : ""
                }`}
              >
                £{p}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] opacity-70">
                Day {DAYS[i]}
              </span>
            </li>
          ))}
          <li className="flex flex-col items-center gap-0.5 rounded-md border border-dashed border-black/15 py-1.5 text-zinc-500 dark:border-white/20 dark:text-zinc-400">
            <span className="font-mono text-[11px] font-semibold tabular-nums">
              £{FLOOR}
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] opacity-70">
              Floor
            </span>
          </li>
        </ol>
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
