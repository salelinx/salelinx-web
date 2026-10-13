"use client";

import type { CSSProperties } from "react";
import { PlatformBadge, platformBorder } from "./HeroPreview";
import { ProductImage } from "./ProductImage";
import { usePrefersReducedMotion, useTick } from "./scene-hooks";

/**
 * Dead stock scene.
 *
 * Four listings get scored one at a time, the way the Dead Stock tab sorts a
 * shop into tiers, and the money tied up in the flagged ones adds up as it
 * goes. Once the scan finishes each flagged row names the fix the tab would
 * suggest. The detector itself never edits anything, so the scene stops at
 * the suggestion rather than showing it act.
 *
 * The rows are real classifications, not decoration: each one passes the
 * thresholds in docs/automate/dead-stock for its marketplace (Depop dead at
 * 21+ days, stale at 10+; Vinted dead at 30+, with under 5 likes in every
 * case here). Keep them consistent if the thresholds change.
 */

type Tier = "healthy" | "stale" | "dead";

const ROWS: {
  item: string;
  photo: string;
  platform: "depop" | "vinted";
  age: number;
  views: number;
  likes: number;
  price: number;
  tier: Tier;
  action: string | null;
}[] = [
  {
    item: "Western belt",
    photo: "/products/western-belt.jpg",
    platform: "depop",
    age: 34,
    views: 12,
    likes: 1,
    price: 40,
    tier: "dead",
    action: "relist",
  },
  {
    item: "Crystal cross",
    photo: "/products/crystal-cross.jpg",
    platform: "vinted",
    age: 4,
    views: 86,
    likes: 14,
    price: 28,
    tier: "healthy",
    action: null,
  },
  {
    item: "Cat ring",
    photo: "/products/cat-ring.jpg",
    platform: "depop",
    age: 12,
    views: 22,
    likes: 3,
    price: 18,
    tier: "stale",
    action: "refresh",
  },
  {
    item: "Rose charm",
    photo: "/products/rose-charm.jpg",
    platform: "vinted",
    age: 31,
    views: 30,
    likes: 2,
    price: 15,
    tier: "dead",
    action: "drop price",
  },
];

const TIER_TONE: Record<Tier, string> = {
  healthy:
    "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  stale:
    "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  dead: "bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
};

const TICK_MS = 100;
const CYCLE = 110; // 11s
const SCAN_START = 8;
const TICKS_PER_ROW = 12;
const SCAN_END = SCAN_START + ROWS.length * TICKS_PER_ROW;
// A beat after the last verdict, so the suggestions read as a second step
// rather than arriving with the final badge.
const ACTIONS_AT = SCAN_END + 6;

export function DeadStockScene() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(TICK_MS);
  const phase = reduced ? CYCLE - 1 : tick % CYCLE;

  // How many rows have a verdict, and which one is being looked at now.
  const scored = Math.min(
    ROWS.length,
    Math.max(0, Math.floor((phase - SCAN_START) / TICKS_PER_ROW)),
  );
  const scanning = phase >= SCAN_START && phase < SCAN_END ? scored : -1;
  const done = phase >= SCAN_END;
  const showActions = phase >= ACTIONS_AT;

  const flagged = ROWS.slice(0, scored).filter((r) => r.tier !== "healthy");
  const atRisk = flagged.reduce((sum, r) => sum + r.price, 0);
  const dead = flagged.filter((r) => r.tier === "dead").length;
  const stale = flagged.length - dead;

  const status = done
    ? `${dead} dead, ${stale} stale`
    : scanning >= 0
      ? `Scoring ${scanning + 1} of ${ROWS.length}`
      : "Checking age, views and likes";

  return (
    <div className="cascade-list flex flex-col items-center gap-6 lg:gap-8">
      <ul
        className="cascade-item flex w-full max-w-[340px] flex-col gap-1.5 lg:max-w-[400px]"
        style={{ "--stagger-delay": "0ms" } as CSSProperties}
      >
        {ROWS.map((r, i) => {
          const hasVerdict = i < scored;
          const isScanning = i === scanning;
          return (
            <li
              key={r.item}
              className={`flex h-12 items-center gap-2.5 rounded-md border bg-white px-2.5 transition-[opacity,background-color,border-color] duration-300 dark:bg-white/[0.02] ${platformBorder(r.platform)} ${
                isScanning
                  ? "border-zinc-400/50 bg-zinc-50 dark:border-white/25 dark:bg-white/[0.05]"
                  : "border-black/[0.06] dark:border-white/10"
              } ${hasVerdict || isScanning ? "" : "opacity-55"}`}
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
                <div className="truncate font-mono text-[9.5px] text-zinc-500">
                  {r.age}d · {r.views} views · {r.likes}{" "}
                  {r.likes === 1 ? "like" : "likes"}
                </div>
              </div>
              {/* Fixed width so the item name never reflows as the badge and
                  the suggestion under it come and go. */}
              <div className="flex w-[68px] shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-sm px-1.5 py-[2px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] transition-opacity duration-300 ${TIER_TONE[r.tier]} ${
                    hasVerdict ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {r.tier}
                </span>
                {r.action ? (
                  <span
                    aria-hidden={!showActions}
                    className={`whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.08em] text-zinc-500 transition-opacity duration-500 dark:text-zinc-400 ${
                      showActions ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {r.action} &rsaquo;
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="cascade-item flex flex-col items-center gap-2"
        style={{ "--stagger-delay": "120ms" } as CSSProperties}
      >
        <span
          className={`text-[34px] font-medium tabular-nums leading-none tracking-tight transition-colors duration-500 lg:text-[44px] ${
            atRisk > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-zinc-300 dark:text-zinc-700"
          }`}
        >
          £{atRisk}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 lg:text-[10px] dark:text-zinc-500">
          Capital at risk
        </span>
      </div>

      <div
        className="cascade-item flex w-full max-w-[220px] flex-col items-center gap-2.5 lg:max-w-[300px]"
        style={{ "--stagger-delay": "200ms" } as CSSProperties}
      >
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={ROWS.length}
          aria-valuenow={scored}
          aria-label={status}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              done
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${(scored / ROWS.length) * 100}%` }}
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
