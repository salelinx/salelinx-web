"use client";

import type { CSSProperties } from "react";
import { PlatformBadge, platformBorder, type Platform } from "./HeroPreview";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Listings scene: the My Listings grid.
 *
 * Depop, Vinted and eBay rows in one list, the platform filter stepping
 * through each shop, then two eBay edits saved straight to eBay: a price
 * change, and an ended listing relisted. Those are the eBay actions My
 * Listings has (docs/inventory/listings, "eBay listings").
 */

type Filter = "all" | Platform;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "depop", label: "Depop" },
  { id: "vinted", label: "Vinted" },
  { id: "ebay", label: "eBay" },
];

const PLATFORM_NAME: Record<Platform, string> = {
  depop: "Depop",
  vinted: "Vinted",
  ebay: "eBay",
};

type Status = "active" | "sold" | "ended";

const ROWS: {
  item: string;
  photo: string;
  platform: Platform;
  price: number;
  status: Status;
  /** New price saved to eBay partway through. */
  edited?: number;
  /** Ended eBay listing that gets relisted. */
  relist?: boolean;
}[] = [
  { item: "Western belt", photo: "/products/western-belt.jpg", platform: "depop", price: 40, status: "active" },
  { item: "Union Jack beanie", photo: "/products/union-jack-beanie.jpg", platform: "ebay", price: 35, status: "active", edited: 30 },
  { item: "Cat ring", photo: "/products/cat-ring.jpg", platform: "vinted", price: 18, status: "active" },
  { item: "Grey star beanie", photo: "/products/grey-star-beanie.jpg", platform: "ebay", price: 22, status: "ended", relist: true },
  { item: "Sport shades", photo: "/products/sport-sunglasses.jpg", platform: "depop", price: 24, status: "sold" },
];

const STATUS_TONE: Record<Status, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  sold: "bg-black/[0.05] text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400",
  ended: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
};

const TICK_MS = 100;
const CYCLE = 130; // 13s
// When the filter moves to each shop, then back to All for the hold.
const FILTER_AT: [number, Filter][] = [
  [0, "all"],
  [18, "depop"],
  [34, "vinted"],
  [50, "ebay"],
  [110, "all"],
];
const EDIT_AT = 64;
const RELIST_AT = 84;
// How long the row being saved stays outlined.
const FLASH = 14;

export function ListingsScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const phase = reduced ? CYCLE - 1 : tick % CYCLE;

  const filter = FILTER_AT.reduce<Filter>((f, [t, id]) => (phase >= t ? id : f), "all");
  const edited = phase >= EDIT_AT;
  const relisted = phase >= RELIST_AT;
  const holding = phase >= FILTER_AT[FILTER_AT.length - 1][0];

  const count = (p: Platform) => ROWS.filter((r) => r.platform === p).length;
  const status = holding
    ? "Three shops, one list"
    : relisted
      ? "Relisted on eBay"
      : edited
        ? "Price saved to eBay"
        : filter === "all"
          ? `${ROWS.length} listings from 3 shops`
          : `${PLATFORM_NAME[filter]}, ${count(filter)} ${count(filter) === 1 ? "listing" : "listings"}`;

  // Filter steps, then the two saves.
  const stages = FILTER_AT.slice(1, 4).filter(([t]) => phase >= t).length + (edited ? 1 : 0) + (relisted ? 1 : 0);
  const STAGES = 5;
  const done = stages === STAGES;

  return (
    <div className="cascade-list flex flex-col items-center gap-5 lg:gap-7">
      <div
        className="cascade-item flex w-full max-w-[340px] items-center justify-between gap-2 lg:max-w-[400px]"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500 lg:text-[10px]">
          My Listings
        </span>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <span
              key={f.id}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors duration-300 lg:text-[11px] ${
                filter === f.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-black/[0.05] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300"
              }`}
            >
              {f.label}
            </span>
          ))}
        </div>
      </div>

      <ul
        className="cascade-item flex w-full max-w-[340px] flex-col gap-1.5 lg:max-w-[400px]"
        style={{ "--stagger-delay": "100ms" } as CSSProperties}
      >
        {ROWS.map((r) => {
          const shown = filter === "all" || filter === r.platform;
          const price = r.edited !== undefined && edited ? r.edited : r.price;
          const rowStatus: Status = r.relist && relisted ? "active" : r.status;
          const saving =
            !reduced &&
            ((r.edited !== undefined && phase >= EDIT_AT && phase < EDIT_AT + FLASH) ||
              (r.relist && phase >= RELIST_AT && phase < RELIST_AT + FLASH));
          const note = r.edited !== undefined && edited ? "saved" : r.relist && relisted ? "relisted" : null;
          return (
            <li
              key={r.item}
              className={`flex h-11 items-center gap-2.5 rounded-md border bg-white px-2.5 transition-[opacity,border-color] duration-300 dark:bg-white/[0.02] ${platformBorder(r.platform)} ${
                saving
                  ? "border-emerald-500/50 dark:border-emerald-400/50"
                  : "border-black/[0.06] dark:border-white/10"
              } ${shown ? "opacity-100" : "opacity-30"}`}
            >
              <ProductImage
                type="tee"
                hue={30}
                src={r.photo}
                className="size-8 shrink-0 rounded"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <PlatformBadge platform={r.platform} size={12} />
                  <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                    {r.item}
                  </span>
                </div>
                {/* Keyed on the price, so the eBay edit slides in. */}
                <span
                  key={price}
                  className="scene-swap-in block font-mono text-[10.5px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
                >
                  £{price}
                </span>
              </div>
              {/* Fixed width, both lines always rendered, so nothing to the
                  left reflows as the status and the note change. */}
              <div className="flex w-[64px] shrink-0 flex-col items-end gap-1">
                <span
                  key={rowStatus}
                  className={`scene-swap-in rounded-sm px-1.5 py-[2px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] ${STATUS_TONE[rowStatus]}`}
                >
                  {rowStatus}
                </span>
                <span
                  aria-hidden={!note}
                  className={`whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.08em] text-emerald-600 transition-opacity duration-300 dark:text-emerald-400 ${
                    note ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {note ?? "saved"}
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
          aria-valuemax={STAGES}
          aria-valuenow={stages}
          aria-label={status}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              done ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${(stages / STAGES) * 100}%` }}
          />
        </div>
        <span
          aria-hidden
          className={`text-center font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 lg:text-[10px] ${
            done ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
