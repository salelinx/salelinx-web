"use client";

import type { CSSProperties } from "react";
import { PlatformBadge, platformBorder } from "./HeroPreview";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Bulk edit scene: the My Listings selection toolbar.
 *
 * Three selected listings and four toolbar actions applied in turn, each to
 * the whole selection at once, which is the point. The photos start sideways
 * (the classic phone upload) and are rotated upright, prices come down 20%,
 * the two Depop items go on a native Depop sale (Vinted has no equivalent, so
 * the Vinted row is left alone), and every row gets a draft copy.
 *
 * Prices are picked so every step lands on whole pounds: 20% off 40/25/30 is
 * 32/20/24, and a 25% Depop sale on 32 and 24 is 24 and 18.
 */

type Step = "photos" | "edit" | "discount" | "duplicate";

const STEPS: { id: Step; label: string; status: string }[] = [
  { id: "photos", label: "Photos", status: "Photos rotated upright" },
  { id: "edit", label: "Edit", status: "Price -20% on 3 listings" },
  { id: "discount", label: "Discount", status: "25% sale on 2 Depop listings" },
  { id: "duplicate", label: "Duplicate", status: "3 copies saved as drafts" },
];

const ROWS: {
  item: string;
  photo: string;
  platform: "depop" | "vinted";
  price: number;
  edited: number;
  /** Depop sale price; null on Vinted, which has no native discount. */
  sale: number | null;
}[] = [
  { item: "Western belt", photo: "/products/western-belt.jpg", platform: "depop", price: 40, edited: 32, sale: 24 },
  { item: "Cat ring", photo: "/products/cat-ring.jpg", platform: "vinted", price: 25, edited: 20, sale: null },
  { item: "Star beanie", photo: "/products/star-beanie.jpg", platform: "depop", price: 30, edited: 24, sale: 18 },
];

const TICK_MS = 100;
const CYCLE = 120; // 12s
const START = 6;
const TICKS_PER_STEP = 24;
// The toolbar button lights up first and the change lands a beat later, so
// it reads as "pressed Photos, photos changed" rather than both at once.
const APPLY_AFTER = 7;

export function BulkEditScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const phase = reduced ? CYCLE - 1 : tick % CYCLE;

  // Which toolbar button is lit, and how many steps have been applied.
  const active = phase < START ? -1 : Math.min(STEPS.length - 1, Math.floor((phase - START) / TICKS_PER_STEP));
  const applied = phase < START
    ? 0
    : Math.min(STEPS.length, Math.floor((phase - START - APPLY_AFTER) / TICKS_PER_STEP) + 1);
  const has = (s: Step) => STEPS.findIndex((x) => x.id === s) < applied;
  // No button stays lit through the hold at the end of the cycle.
  const lit = active >= 0 && phase < START + STEPS.length * TICKS_PER_STEP;

  const status = applied > 0 ? STEPS[applied - 1].status : "3 selected";

  return (
    <div className="cascade-list flex flex-col items-center gap-5 lg:gap-7">
      {/* The toolbar. Labels match the buttons in the extension's My
          Listings selection toolbar. */}
      <div
        className="cascade-item flex w-full max-w-[340px] items-center justify-between gap-2 lg:max-w-[400px]"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500 lg:text-[10px]">
          3 selected
        </span>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors duration-300 lg:text-[11px] ${
                lit && i === active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-black/[0.05] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300"
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <ul
        className="cascade-item flex w-full max-w-[340px] flex-col gap-1.5 lg:max-w-[400px]"
        style={{ "--stagger-delay": "100ms" } as CSSProperties}
      >
        {ROWS.map((r) => {
          const price = has("edit") ? r.edited : r.price;
          const onSale = has("discount") && r.sale !== null;
          return (
            <li
              key={r.item}
              className={`flex h-14 items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 dark:border-white/10 dark:bg-white/[0.02] ${platformBorder(r.platform)}`}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
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
                type="tee"
                hue={30}
                src={r.photo}
                className="size-10 shrink-0 rounded"
                imgStyle={{
                  transform: has("photos") ? "none" : "rotate(-90deg)",
                  filter: has("photos") ? "none" : "brightness(0.85)",
                  transition: "transform 650ms cubic-bezier(0.2,0.8,0.2,1), filter 650ms ease-out",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <PlatformBadge platform={r.platform} size={12} />
                  <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                    {r.item}
                  </span>
                </div>
                <div className="mt-0.5 flex h-4 items-center gap-1.5 font-mono text-[11px] tabular-nums">
                  {/* Keyed on what it shows, so each change slides in. */}
                  <span
                    key={`${price}-${onSale}`}
                    className={`scene-swap-in ${
                      onSale
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : "font-semibold text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    £{price}
                  </span>
                  {onSale ? (
                    <span className="scene-swap-in font-semibold text-rose-600 dark:text-rose-400">
                      £{r.sale}
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Fixed width, both chips always rendered, so nothing to the
                  left reflows as they appear. */}
              <div className="flex w-[76px] shrink-0 flex-col items-end gap-1">
                <span
                  className={`whitespace-nowrap rounded-sm bg-rose-500/15 px-1.5 py-[2px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-rose-700 transition-opacity duration-300 dark:bg-rose-400/15 dark:text-rose-300 ${
                    onSale ? "opacity-100" : "opacity-0"
                  }`}
                >
                  -25% sale
                </span>
                <span
                  className={`whitespace-nowrap rounded-sm bg-black/[0.05] px-1.5 py-[2px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-zinc-600 transition-opacity duration-300 dark:bg-white/[0.08] dark:text-zinc-300 ${
                    has("duplicate") ? "opacity-100" : "opacity-0"
                  }`}
                >
                  + draft
                </span>
              </div>
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
          aria-valuemax={STEPS.length}
          aria-valuenow={applied}
          aria-label={status}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              applied === STEPS.length
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${(applied / STEPS.length) * 100}%` }}
          />
        </div>
        <span
          aria-hidden
          className={`text-center font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 lg:text-[10px] ${
            applied === STEPS.length
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
