"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

/**
 * Drives a panel demo loop. Returns a tick counter that increments every
 * `intervalMs`. Respects prefers-reduced-motion (stays at 0). Reset to 0
 * whenever the panel mounts (because panels unmount when the tab changes).
 */
function useAnimationTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/**
 * True when the visitor asked for reduced motion. Panels that build a state up
 * over several ticks need this: useAnimationTick holds at 0 for those users, so
 * a tick-derived panel would otherwise freeze showing its *empty* first frame.
 * Reading this lets a panel jump straight to its finished state instead.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    // Server render assumes motion is fine; the client corrects on hydration.
    () => false,
  );
}
import { Icon } from "@/components/Icon";
import { BrandWordmark, GLYPH, type Brand } from "@/components/BrandWordmark";
import { ProductImage, type ProductType } from "./ProductImage";

// Product photos. Local studio shots of the accessory items the demo shop
// sells across all three marketplaces.
const PHOTO = {
  crossNecklace: "/products/cross-necklace.jpg",
  crystalCross: "/products/crystal-cross.jpg",
  roseCharm: "/products/rose-charm.jpg",
  strawberryRings: "/products/strawberry-rings.jpg",
  catRing: "/products/cat-ring.jpg",
  sportSunglasses: "/products/sport-sunglasses.jpg",
  starBeanie: "/products/star-beanie.jpg",
  whiteStarBeanie: "/products/white-star-beanie.jpg",
  greyStarBeanie: "/products/grey-star-beanie.jpg",
  unionJackBeanie: "/products/union-jack-beanie.jpg",
  westernBelt: "/products/western-belt.jpg",
  blackSunglasses: "/products/black-sunglasses.jpg",
} as const;

function avatarStyle(hue: number): CSSProperties {
  return { background: `hsl(${hue} 55% 42%)` };
}

export type Platform = "depop" | "vinted" | "ebay";

const PLATFORM_BORDER: Record<Platform, string> = {
  depop: "border-l-[2px] border-l-[rgba(255,35,0,0.55)]",
  vinted: "border-l-[2px] border-l-[rgba(9,177,136,0.55)]",
  ebay: "border-l-[2px] border-l-[rgba(9,104,246,0.55)]",
};

export function platformBorder(platform: Platform): string {
  return PLATFORM_BORDER[platform];
}

export function PlatformBadge({
  platform,
  size = 14,
}: {
  platform: Platform;
  size?: number;
}) {
  if (platform === "ebay") {
    // eBay has no square monogram to match the other two, and its four-colour
    // wordmark squeezed into a square this small was an unreadable smudge. So
    // the wordmark at the badge's height instead, wider than the others.
    const g = GLYPH.ebay.wordmark;
    return (
      <svg
        role="img"
        aria-label="eBay"
        viewBox={g.viewBox}
        fill={g.fill}
        className="flex-shrink-0"
        style={{ height: size, width: "auto" }}
      >
        {g.d}
      </svg>
    );
  }
  const src = platform === "depop" ? "/depop-logo.png" : "/vinted-logo.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size platform logo; next/image adds no value here
    <img
      src={src}
      alt={platform === "depop" ? "Depop" : "Vinted"}
      width={size}
      height={size}
      className="flex-shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

const BRAND_NAME: Record<Brand, string> = {
  depop: "Depop",
  vinted: "Vinted",
  ebay: "eBay",
};

// The three shops, always in this order, with an arrow between each pair.
const CROSSLIST_COLUMNS: Brand[] = ["depop", "vinted", "ebay"];

// One loop per shop holding the original, so each marketplace is the source
// once and a target twice, and a different item each time so the loops do not
// read as a replay.
const CROSSLIST_LOOPS: { source: number; photo: string }[] = [
  { source: 0, photo: PHOTO.starBeanie },
  { source: 1, photo: PHOTO.unionJackBeanie },
  { source: 2, photo: PHOTO.westernBelt },
];

// Heights tuned so the three wordmarks look the same optical size.
const CROSSLIST_WORDMARK_H: Record<Brand, string> = {
  depop: "0.8em",
  vinted: "1em",
  ebay: "1.1em",
};

const CROSSLIST_CYCLE = 110; // 11s
// When each copy starts, nearest shop first, and how long it takes to fill.
// COPY_TICKS must match the transition on .crosslist-fill-on in globals.css.
const CROSSLIST_COPY_AT = [12, 44];
const CROSSLIST_COPY_TICKS = 22;

/** The other two columns, nearest first (left first when both are one away). */
function crosslistTargets(source: number): number[] {
  return [0, 1, 2]
    .filter((i) => i !== source)
    .sort((a, b) => Math.abs(a - source) - Math.abs(b - source) || a - b);
}

function CrosslistArrow({ dir }: { dir: "left" | "right" | null }) {
  // Two-headed while idle, because crosslisting runs either way. While a copy
  // travels across it, it points the way the copy is going.
  const d =
    dir === "right"
      ? "M4 12h20M20 8l4 4-4 4"
      : dir === "left"
        ? "M24 12H4M8 8l-4 4 4 4"
        : "M4 12h20M20 8l4 4-4 4M8 8l-4 4 4 4";
  return (
    <svg
      className={`size-5 transition-colors duration-300 sm:size-6 ${
        dir ? "text-emerald-500 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"
      }`}
      viewBox="0 0 28 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

// ── Tab panels ──────────────────────────────────────────────────────

export function CrosslistPanel() {
  // Three shops side by side, Depop, Vinted and eBay, with an arrow between
  // each. One holds the original listing and the copies fill in on the other
  // two, one after the other; next loop the original is on the next shop.
  //
  // Deliberately close to nothing: photos, the marketplace each belongs to,
  // arrows, and one line of text. An earlier version mocked full marketplace
  // cards (handles, fees, likes, hashtags, a chip row) that the crosslister
  // does not have, and at phone width it collapsed into clutter. The story is
  // "the same item, now on every marketplace", and the photos tell that.
  const tick = useAnimationTick(100);
  const reduced = usePrefersReducedMotion();

  const loopIndex = reduced ? 0 : Math.floor(tick / CROSSLIST_CYCLE) % CROSSLIST_LOOPS.length;
  const loop = CROSSLIST_LOOPS[loopIndex];
  // Reduced motion holds the finished frame: the original and both copies.
  const phase = reduced ? CROSSLIST_CYCLE - 1 : tick % CROSSLIST_CYCLE;
  const targets = crosslistTargets(loop.source);

  type ColumnState = "original" | "waiting" | "copying" | "done";
  const stateOf = (col: number): ColumnState => {
    const k = targets.indexOf(col);
    if (k < 0) return "original";
    if (phase < CROSSLIST_COPY_AT[k]) return "waiting";
    if (phase < CROSSLIST_COPY_AT[k] + CROSSLIST_COPY_TICKS) return "copying";
    return "done";
  };
  const copying = targets.find((t) => stateOf(t) === "copying");
  const doneCount = targets.filter((t) => stateOf(t) === "done").length;

  // Arrow i sits between column i and i + 1. A copy lights the arrow on its
  // side facing the original, pointing away from it.
  const arrowDir = (i: number): "left" | "right" | null => {
    if (copying === undefined) return null;
    const arrow = copying < loop.source ? copying : copying - 1;
    if (arrow !== i) return null;
    return copying > loop.source ? "right" : "left";
  };

  const sourceName = BRAND_NAME[CROSSLIST_COLUMNS[loop.source]];
  const label =
    copying !== undefined
      ? `Copying to ${BRAND_NAME[CROSSLIST_COLUMNS[copying]]}`
      : doneCount === targets.length
        ? "On Depop, Vinted and eBay"
        : `Original on ${sourceName}`;
  // The bar fills alongside each copy: it heads for the next half over the
  // same time the photo takes to sharpen, then snaps back between loops.
  const progress = ((doneCount + (copying !== undefined ? 1 : 0)) / targets.length) * 100;

  return (
    <div className="cascade-list panel-fluid flex flex-col items-center gap-6">
      <div className="cascade-list grid w-full grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 sm:gap-4">
        {CROSSLIST_COLUMNS.flatMap((brand, col) => {
          const state = stateOf(col);
          const chip =
            state === "original"
              ? "Original"
              : state === "copying"
                ? "Copying"
                : state === "done"
                  ? brand === "ebay"
                    ? "Live"
                    : "Draft"
                  : "";
          const figure = (
            <figure
              key={brand}
              className="cascade-item m-0 flex flex-col items-center gap-2.5 sm:gap-3"
              style={{ "--stagger-delay": `${col * 100}ms` } as CSSProperties}
            >
              <span className="flex h-5 items-center justify-center">
                <BrandWordmark brand={brand} variant="wordmark" height={CROSSLIST_WORDMARK_H[brand]} />
              </span>
              {/* Keyed by loop, so a column that changes role between loops
                  starts clean instead of transitioning out of its old one. */}
              <div key={loopIndex} className="relative aspect-square w-full">
                {state === "original" ? (
                  <ProductImage
                    type="tee"
                    hue={220}
                    src={loop.photo}
                    className="h-full w-full rounded-xl"
                  />
                ) : (
                  <>
                    {/* The empty slot the copy lands in, until it starts. */}
                    <div
                      className={`absolute inset-0 rounded-xl border border-dashed border-black/15 transition-opacity duration-300 dark:border-white/20 ${
                        state === "waiting" ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {/* The copy SHARPENS rather than being uncovered: a blurred
                        layer appears as the copy starts and a sharp one wipes
                        down over it as the fields map across. Each layer sits
                        in its own absolutely positioned wrapper because
                        ProductImage hardcodes `relative` on its root, and an
                        `absolute` passed in does not reliably win. */}
                    {/* Only while copying: once the sharp layer is down, the
                        mask's last 2% would otherwise show this layer as a
                        grey band along the bottom. */}
                    <div
                      className={`absolute inset-0 transition-opacity duration-300 ${
                        state === "copying" ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <ProductImage
                        type="tee"
                        hue={220}
                        src={loop.photo}
                        noBackdrop
                        className="h-full w-full rounded-xl"
                        imgClassName="crosslist-blurred"
                      />
                    </div>
                    <div className="absolute inset-0">
                      <ProductImage
                        type="tee"
                        hue={220}
                        src={loop.photo}
                        noBackdrop
                        className="h-full w-full rounded-xl"
                        imgClassName={`crosslist-fill ${state === "waiting" ? "" : "crosslist-fill-on"}`}
                      />
                    </div>
                  </>
                )}
              </div>
              {/* Fixed height and always rendered, so the photos never move as
                  the chip comes and goes. */}
              <span
                aria-hidden
                className={`flex h-5 items-center font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 ${
                  state === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : state === "original"
                      ? "text-zinc-600 dark:text-zinc-300"
                      : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {chip || " "}
              </span>
            </figure>
          );
          return col === 0
            ? [figure]
            : [
                <div key={`arrow-${col}`} className="cascade-item flex items-center justify-center">
                  <CrosslistArrow dir={arrowDir(col - 1)} />
                </div>,
                figure,
              ];
        })}
      </div>

      {/* A line that fills as the copies land, rather than a sentence
          describing it. Fixed width so it cannot shift as it fills, and the
          accessible name carries what the line shows. */}
      <div
        className="cascade-item flex w-full max-w-[180px] flex-col items-center gap-2"
        style={{ "--stagger-delay": "300ms" } as CSSProperties}
      >
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={targets.length}
          aria-valuenow={doneCount}
          aria-label={label}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] ease-linear ${
              copying !== undefined ? "duration-[2200ms]" : "duration-300"
            } ${
              doneCount === targets.length
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          aria-hidden
          className={`font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 ${
            doneCount === targets.length
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function ConversationsPanel() {
  // Live demo: messages appear one by one with a "typing" indicator from
  // whichever side is about to speak next. After all messages are visible,
  // the thread holds for a beat then restarts. Slowed to read realistically:
  // each phase is 3.2s (32 ticks at 100ms) so typing feels human, with a
  // longer hold at the end. Full cycle = 8 phases × 3.2s = 25.6s.
  const TICKS_PER_PHASE = 32;
  const PHASES = 8;
  const tick = useAnimationTick(100);
  const phase = Math.floor(tick / TICKS_PER_PHASE) % PHASES;

  type Msg = {
    hue: number;
    initial: string;
    text: string;
    time: string;
    mine: boolean;
  };
  // Three threads, rotated one per completed loop, so a visitor who watches the
  // scene twice does not see the same conversation twice.
  //
  // Every script is exactly six messages, alternating buyer then seller. The
  // phase machine below counts on both: PHASES is derived from the length, and
  // the typing indicator picks its side from whether the phase is odd or even.
  //
  // Kept short on purpose. This panel sits in a half-width column in the scroll
  // scene, so anything much longer wraps to three lines and the bubbles stop
  // reading as a chat.
  const SCRIPTS: Msg[][] = [
    [
      {
        hue: 178,
        initial: "L",
        text: "Still available?",
        time: "12:04",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "Yes, listed today.",
        time: "12:05",
        mine: true,
      },
      {
        hue: 178,
        initial: "L",
        text: "Would you take £18?",
        time: "12:07",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "Could do £20 today.",
        time: "12:08",
        mine: true,
      },
      {
        hue: 178,
        initial: "L",
        text: "Deal, paying now.",
        time: "12:10",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "Great, ships tomorrow.",
        time: "12:11",
        mine: true,
      },
    ],
    [
      {
        hue: 262,
        initial: "M",
        text: "Does it fit a UK 10?",
        time: "09:21",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "True to size, yes.",
        time: "09:22",
        mine: true,
      },
      {
        hue: 262,
        initial: "M",
        text: "Any marks on it?",
        time: "09:24",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "None, barely worn.",
        time: "09:25",
        mine: true,
      },
      {
        hue: 262,
        initial: "M",
        text: "I'll take it.",
        time: "09:27",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "Posting it today.",
        time: "09:28",
        mine: true,
      },
    ],
    [
      {
        hue: 32,
        initial: "J",
        text: "Can you do a bundle?",
        time: "17:45",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "Sure, which two?",
        time: "17:46",
        mine: true,
      },
      {
        hue: 32,
        initial: "J",
        text: "The tee and the cap.",
        time: "17:48",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "£28 for both?",
        time: "17:49",
        mine: true,
      },
      {
        hue: 32,
        initial: "J",
        text: "Perfect, sending now.",
        time: "17:51",
        mine: false,
      },
      {
        hue: 0,
        initial: "Y",
        text: "Thanks, out tomorrow.",
        time: "17:52",
        mine: true,
      },
    ],
  ];
  // Derived from tick, not stored in state, so the server and the first client
  // render both land on script 0 and nothing flickers on hydration.
  const scriptIndex = Math.floor(tick / (TICKS_PER_PHASE * PHASES)) % SCRIPTS.length;
  const messages: Msg[] = SCRIPTS[scriptIndex];
  // Each thread comes from a different shop, so the inbox reads as all three
  // in one place. The handle and the typing avatar follow the script's buyer.
  const THREADS: { platform: Platform; handle: string }[] = [
    { platform: "vinted", handle: "lila_resale" },
    { platform: "depop", handle: "maya.vtg" },
    { platform: "ebay", handle: "jordan_finds" },
  ];
  const thread = THREADS[scriptIndex];
  const buyer = messages.find((m) => !m.mine)!;

  // Phases (in order). Pattern: typing -> message appears -> next side typing.
  //   0: buyer typing, no messages yet
  //   1: msg 0 visible, me (seller) typing
  //   2: msgs 0-1 visible, buyer typing
  //   3: msgs 0-2 visible, me typing
  //   4: msgs 0-3 visible, buyer typing
  //   5: msgs 0-4 visible, me typing
  //   6: all 6 visible
  //   7: all 6 visible (extra hold before loop)
  const visibleCount = Math.min(phase, messages.length);
  const typingFrom: "buyer" | "me" | null =
    phase >= messages.length ? null : phase % 2 === 0 ? "buyer" : "me";
  return (
    <div className="cascade-list flex flex-col gap-2">
      <div
        className="cascade-item flex items-center justify-between gap-2 rounded-md border border-black/[0.06] bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ "--stagger-delay": `0ms` } as CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ProductImage
            type="tee"
            hue={220}
            src={PHOTO.starBeanie}
            className="size-9 flex-shrink-0 rounded"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <PlatformBadge platform={thread.platform} size={12} />
              <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                @{thread.handle}
              </span>
            </div>
            <div className="truncate text-[10px] text-zinc-500">
              Star beanie · £22
            </div>
          </div>
        </div>
        <span className="font-mono text-[9.5px] text-zinc-500">re: offer</span>
      </div>

      {/* Every message is always laid out; the ones that haven't "arrived" yet
          are hidden with visibility rather than left unmounted. Mounting them
          one at a time grew the panel on every phase, which shifted the page
          under the reader and, inside the scroll section, re-triggered the
          fit-to-viewport measurement mid-animation. The typing indicator is
          absolutely positioned over the next message's slot for the same
          reason: as a row of its own it added height that then disappeared. */}
      <ul className="cascade-list flex flex-col gap-1.5">
        {messages.map((m, i) => {
          const shown = i < visibleCount;
          const isTypingSlot = typingFrom !== null && i === visibleCount;
          const typingMine = typingFrom === "me";
          return (
            <li
              key={`msg-${i}`}
              className={`cascade-item relative flex items-end gap-1.5 ${m.mine ? "flex-row-reverse" : ""}`}
              style={{ "--stagger-delay": `0ms` } as CSSProperties}
              aria-hidden={!shown}
            >
              <span
                className={`flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${shown ? "" : "invisible"}`}
                style={avatarStyle(m.hue)}
              >
                {m.initial}
              </span>
              <div
                className={`${
                  m.mine
                    ? "max-w-[70%] rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-1.5 text-[11px] text-white dark:bg-white dark:text-zinc-900"
                    : "max-w-[70%] rounded-2xl rounded-bl-sm border border-black/[0.06] bg-white px-3 py-1.5 text-[11px] text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100"
                } ${shown ? "" : "invisible"}`}
              >
                {m.text}
              </div>
              <span
                className={`self-center font-mono text-[9px] text-zinc-400 ${shown ? "" : "invisible"}`}
              >
                {m.time}
              </span>

              {isTypingSlot ? (
                <span
                  className={`absolute inset-0 flex items-end gap-1.5 ${typingMine ? "flex-row-reverse" : ""}`}
                >
                  <span
                    className="flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                    style={avatarStyle(typingMine ? 0 : buyer.hue)}
                  >
                    {typingMine ? "Y" : buyer.initial}
                  </span>
                  <span
                    className={
                      typingMine
                        ? "rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 dark:bg-white"
                        : "rounded-2xl rounded-bl-sm border border-black/[0.06] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
                    }
                    aria-label="typing"
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={`hero-typing-dot size-1.5 rounded-full ${typingMine ? "bg-white/60 dark:bg-zinc-900/60" : "bg-zinc-400 dark:bg-zinc-500"}`}
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className={`hero-typing-dot size-1.5 rounded-full ${typingMine ? "bg-white/60 dark:bg-zinc-900/60" : "bg-zinc-400 dark:bg-zinc-500"}`}
                        style={{ animationDelay: "180ms" }}
                      />
                      <span
                        className={`hero-typing-dot size-1.5 rounded-full ${typingMine ? "bg-white/60 dark:bg-zinc-900/60" : "bg-zinc-400 dark:bg-zinc-500"}`}
                        style={{ animationDelay: "360ms" }}
                      />
                    </span>
                  </span>
                </span>
              ) : null}
            </li>
          );
        })}
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
          <span className="inline-flex items-center gap-1">
            <PlatformBadge platform="ebay" size={11} /> 2
          </span>
        </span>
      </div>
    </div>
  );
}

export function LabelsPanel() {
  // idle -> merging -> done -> idle. Driven by pressing the button rather than
  // looping on its own: the merge is the thing the button DOES, so showing it
  // unprompted made it wallpaper. Pressed, it is a demonstration.
  const [phase, setPhase] = useState<"idle" | "merging" | "done">("idle");
  const start = () => {
    if (phase !== "idle") return;
    setPhase("merging");
    // Rows clear and the stack builds, then the pile resolves into one doc,
    // then it resets so the next visitor can press it too.
    window.setTimeout(() => setPhase("done"), 1250);
    window.setTimeout(() => setPhase("idle"), 3800);
  };

  // Five orders from five countries, each posted with the carrier that
  // actually dominates resale shipping there - not the largest logistics
  // company on paper. The point of the panel is that the tab prints a label
  // wherever the seller is, so a UK-only list undersold it badly.
  //
  //   UK      Royal Mail      Vinted UK's default
  //   US      USPS            the US carrier on all three marketplaces
  //   France  Mondial Relay   Vinted FR is overwhelmingly point relais
  //   Spain   Correos         the national carrier Vinted ES leans on
  //   Germany DHL             the default almost everywhere in DE
  type Carrier = "rm" | "usps" | "mondial" | "correos" | "dhl";
  const orders: {
    buyer: string;
    item: string;
    type: ProductType;
    photo: string;
    platform: Platform;
    country: string;
    carrier: Carrier;
    hue: number;
  }[] = [
    {
      buyer: "lila_resale",
      item: "Grey star beanie",
      type: "tee",
      photo: PHOTO.greyStarBeanie,
      platform: "depop",
      country: "UK",
      carrier: "rm",
      hue: 220,
    },
    {
      buyer: "kai_pop",
      item: "Sport shades",
      type: "tee",
      photo: PHOTO.sportSunglasses,
      platform: "ebay",
      country: "US",
      carrier: "usps",
      hue: 210,
    },
    {
      buyer: "mia_v",
      item: "Rose charm",
      type: "tee",
      photo: PHOTO.roseCharm,
      platform: "vinted",
      country: "FR",
      carrier: "mondial",
      hue: 22,
    },
    {
      buyer: "sam_thrifts",
      item: "Crystal cross",
      type: "tee",
      photo: PHOTO.crystalCross,
      platform: "vinted",
      country: "ES",
      carrier: "correos",
      hue: 200,
    },
    {
      buyer: "ella_kw",
      item: "Cat ring",
      type: "tee",
      photo: PHOTO.catRing,
      platform: "vinted",
      country: "DE",
      carrier: "dhl",
      hue: 260,
    },
  ];
  // Carrier badges: brand symbol inside a small white rounded chip + the
  // carrier name. Symbols live under /public/brand/. USPS and Mondial Relay
  // publish no square symbol, so theirs are cropped off the left-hand end of
  // their lockups (see /tmp/shotkit/crop.mjs) to match the others' shape.
  //
  // The chip renders label-only when iconSrc is null; every carrier here has
  // a logo, so that branch is currently unused but kept for adding one later.
  const CARRIER: Record<
    Carrier,
    { label: string; iconSrc: string | null; chipClass: string }
  > = {
    rm: {
      label: "Royal Mail",
      iconSrc: "/brand/royal-mail.png",
      chipClass:
        "bg-[rgba(207,20,43,0.10)] text-[rgb(167,16,34)] dark:bg-[rgba(207,20,43,0.18)] dark:text-[rgb(255,140,150)]",
    },
    usps: {
      label: "USPS",
      iconSrc: "/brand/usps.png",
      chipClass:
        "bg-[rgba(19,73,141,0.10)] text-[rgb(19,73,141)] dark:bg-[rgba(19,73,141,0.28)] dark:text-[rgb(150,190,240)]",
    },
    mondial: {
      label: "Mondial Relay",
      iconSrc: "/brand/mondial-relay.png",
      chipClass:
        "bg-[rgba(158,20,79,0.10)] text-[rgb(140,18,70)] dark:bg-[rgba(158,20,79,0.26)] dark:text-[rgb(240,150,190)]",
    },
    correos: {
      label: "Correos",
      iconSrc: "/brand/correos.png",
      chipClass:
        "bg-[rgba(0,74,128,0.10)] text-[rgb(0,64,110)] dark:bg-[rgba(0,74,128,0.28)] dark:text-[rgb(140,190,230)]",
    },
    dhl: {
      label: "DHL",
      iconSrc: "/brand/dhl.svg",
      chipClass:
        "bg-[rgba(255,204,0,0.20)] text-[rgb(140,100,0)] dark:bg-[rgba(255,204,0,0.20)] dark:text-[rgb(255,204,0)]",
    },
  };
  return (
    <div className="cascade-list relative flex h-full flex-col gap-2">
      <ul
        className={`cascade-list flex flex-col gap-1.5 ${phase === "idle" ? "" : "labels-collapsing"}`}
      >
        {orders.map((o, i) => (
          <li
            key={o.buyer}
            className={`cascade-item flex items-center gap-2.5 rounded-md border border-black/[0.06] bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.02] ${platformBorder(o.platform)}`}
            style={
              {
                "--stagger-delay": `${i * 60}ms`,
                "--row-i": i,
              } as CSSProperties
            }
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
              <div className="flex items-center gap-1.5">
                <PlatformBadge platform={o.platform} size={12} />
                <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                  @{o.buyer}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate font-mono text-[9.5px] text-zinc-500">
                {/* Country code rather than a flag: the panel already carries
                    two logos per row, and CLAUDE.md rules out emoji. */}
                <span className="rounded-sm bg-black/[0.05] px-1 py-[1px] text-[8.5px] font-semibold tracking-[0.06em] text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  {o.country}
                </span>
                <span className="truncate">{o.item}</span>
              </div>
            </div>
            <span
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full py-[2px] pr-2 font-mono text-[10px] font-semibold tracking-[0.04em] ${
                CARRIER[o.carrier].iconSrc ? "pl-[2px]" : "pl-2"
              } ${CARRIER[o.carrier].chipClass}`}
            >
              {CARRIER[o.carrier].iconSrc ? (
                <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size carrier icon; next/image adds no value here */}
                  <img
                    src={CARRIER[o.carrier].iconSrc as string}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain"
                  />
                </span>
              ) : null}
              {CARRIER[o.carrier].label}
            </span>
          </li>
        ))}
      </ul>

      {/* Only present once pressed. Absolutely positioned over the list so
          the rows clearing and the stack building happen in the same place,
          rather than the panel changing height mid-animation. */}
      {phase !== "idle" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
          <div className="labels-merge" aria-hidden>
            <span className="labels-merge-doc" />
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="labels-merge-sheet"
                style={{ "--sheet-i": i } as CSSProperties}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {phase === "done" ? "one pdf, ready" : "merging 5 labels"}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={start}
        className="cascade-item mt-auto flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-[11.5px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        style={{ "--stagger-delay": `${4 * 60}ms` } as CSSProperties}
      >
        <svg
          viewBox="0 0 14 14"
          className="size-3"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 8v3h8V8M7 2v6m0 0L4.5 5.5M7 8l2.5-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download merged PDF
      </button>
    </div>
  );
}

export function FollowBotPanel() {
  // Live demo: every ~2.5s the bot follows a new account. The counter ticks
  // up smoothly, the progress bar advances, and a new card slides in at the
  // top of the recent-activity list (with stable keys, React only mounts the
  // new row; the other four reconcile in place instead of all 5 rebuilding).
  const TICKS_PER_FOLLOW = 25; // 2.5s — slower so the list doesn't churn
  const tick = useAnimationTick(100);
  const follows = Math.floor(tick / TICKS_PER_FOLLOW);
  const inFollow = tick % TICKS_PER_FOLLOW;
  const justFollowed = inFollow < 15; // hold the highlight for 1.5s

  // Counters (start at a nice round-ish number, climb from there).
  const followed = 218 + follows;
  const backRate = 0.29 + (follows % 7) * 0.005; // small jitter for realism
  const back = Math.round(followed * backRate);
  const rate = Math.round((back / followed) * 100);
  const target = 500;
  const progressPct = Math.min(100, (followed / target) * 100);
  // Two numbers, a bar and a line — the same shape as the crosslist and
  // restocker scenes.
  //
  // This used to be a five-row activity feed with coloured avatars, FOLLOWED /
  // FOLLOWED BACK pills, a three-up stats bar and a targeting header. It was
  // the busiest panel on the page, and none of it said anything the two
  // numbers do not: the bot follows people, and a share of them follow back.
  // Every other scene has an object at its centre — a photo you can look at.
  // Numbers alone made this the thinnest panel of the set, so the list is
  // back: it is the only part that shows the bot actually working, one
  // account at a time. What is not back is the old presentation — coloured
  // avatars, FOLLOWED / FOLLOWED BACK pills, a three-up stats bar and a
  // targeting header. These are plain lines, and a line is enough.
  const POOL = [
    "thriftedbyella",
    "vintage.rooms",
    "sourced.studio",
    "ninetyfive.co",
    "atelier.resale",
    "northgate.vtg",
    "seconds.london",
    "archive.folk",
  ];
  const ROWS = 4;
  // Deterministic, so the server and client render the same list and it does
  // not flicker on hydration. One in four, which is about the real rate and
  // guarantees exactly one green in a four-row window — a sparser pattern
  // left the list showing four greys at a time, which reads as "nobody
  // follows back".
  // Positive modulo: the rows below the newest are numbered follows-1 ..
  // follows-3, which are negative until the first few follows land, and JS
  // gives -3 % 4 === -3. A bare `n % 4 === 1` therefore matched nothing at
  // all on a freshly loaded page.
  const mod = (n: number, m: number): number => ((n % m) + m) % m;
  const followsBack = (n: number): boolean => mod(n, 4) === 1;
  // Hue by pool index, not by hashing the handle. Hashing looked tidier but
  // gave no guarantee of separation: the best variant still put two of the four
  // visible rows 8 degrees apart, which is the same colour to the eye. Even
  // spacing round the wheel means any two rows on screen are at least 360/POOL
  // apart by construction, and it stays deterministic across SSR and hydration.
  // The bot runs on every shop, so consecutive follows rotate through them.
  const FOLLOW_PLATFORMS: Platform[] = ["depop", "vinted", "ebay"];
  const recent = Array.from({ length: ROWS }, (_, i) => {
    const n = follows - i;
    const idx = mod(n, POOL.length);
    return {
      n,
      handle: POOL[idx],
      back: followsBack(n),
      hue: Math.round((idx * 360) / POOL.length),
      platform: FOLLOW_PLATFORMS[mod(n, FOLLOW_PLATFORMS.length)],
    };
  });

  return (
    <div className="cascade-list panel-fluid flex flex-col items-center gap-7 lg:gap-9">
      {/* Fixed height, clipped.
          The list always holds ROWS entries, so when a follow lands the newest
          row mounts while the oldest unmounts in the same frame. The enter
          animation grows the new row from zero height, so an auto-height
          container collapsed to three rows and climbed back to four over 450ms
          — which walked the counters and the rate line below it down and back
          up on every single follow. Pinning the height to exactly ROWS rows
          absorbs that entirely: the new row grows inside the box and the oldest
          slides out of the clip, and nothing outside the box moves. The row
          height is explicit for the same reason — it makes ROWS * ROW_H exact
          rather than something that drifts with font metrics. */}
      <div
        className="cascade-item flex w-full max-w-[260px] flex-col overflow-hidden lg:max-w-[340px]"
        style={
          {
            "--stagger-delay": "0ms",
            height: `calc(${ROWS} * var(--hero-follow-row-h))`,
            maskImage:
              "linear-gradient(to bottom, #000 0, #000 72%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, #000 0, #000 72%, transparent 100%)",
          } as CSSProperties
        }
      >
        {recent.map((row, i) => (
          // Keyed on the absolute follow number, so React mounts only the new
          // top row and the other three reconcile in place — the enter
          // animation runs once, on the row that actually just arrived.
          <div
            key={row.n}
            className={`hero-follow-row-enter hero-follow-row flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.05] last:border-0 dark:border-white/[0.07] ${
              i === 0 ? "" : "opacity-60"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="flex size-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold uppercase text-white lg:size-[20px] lg:text-[10px]"
                style={avatarStyle(row.hue)}
              >
                {row.handle[0]}
              </span>
              <PlatformBadge platform={row.platform} size={12} />
              <span className="truncate font-mono text-[11px] text-zinc-600 lg:text-[13px] dark:text-zinc-300">
                @{row.handle}
              </span>
            </span>
            <span
              className={`shrink-0 font-mono text-[8.5px] uppercase tracking-[0.14em] lg:text-[9.5px] ${
                row.back
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {row.back ? "follows back" : "followed"}
            </span>
          </div>
        ))}
      </div>

      <div
        className="cascade-item grid w-full max-w-[300px] grid-cols-2 gap-4 lg:max-w-[420px]"
        style={{ "--stagger-delay": "120ms" } as CSSProperties}
      >
        {(
          [
            ["Followed", followed, false],
            ["Followed back", back, true],
          ] as const
        ).map(([label, value, isBack]) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span
              className={`text-[34px] font-medium tabular-nums leading-none tracking-tight transition-colors duration-500 lg:text-[52px] ${
                isBack
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

      <div className="cascade-item flex w-full max-w-[220px] flex-col items-center gap-2.5 lg:max-w-[300px]">
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={followed}
          aria-label={`${followed} of ${target} followed, ${back} followed back`}
        >
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
              justFollowed
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span
          aria-hidden
          className="text-center font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 lg:text-[10px] dark:text-zinc-500"
        >
          {rate}% following back
        </span>
      </div>
    </div>
  );
}

export function OffersPanel({ onInteract }: { onInteract?: () => void }) {
  type Offer = {
    id: string;
    platform: Platform;
    username: string;
    item: string;
    type: ProductType;
    photo: string;
    hue: number;
    listed: number;
    offer: number;
  };
  // Seven offers, shown three at a time, the window advancing each time the
  // inbox empties — so a visitor who clears it twice does not get the same
  // three back.
  //
  // Seven, not six: a pool that is an exact multiple of the window size just
  // alternates two fixed sets (abc, def, abc, ...). Seven and three share no
  // factor, so the window walks the whole pool and takes seven rounds to
  // return to the start.
  const OFFER_POOL: Offer[] = [
    {
      id: "a",
      platform: "vinted",
      username: "lila_resale",
      item: "Union Jack beanie",
      type: "tee",
      photo: PHOTO.unionJackBeanie,
      hue: 220,
      listed: 22,
      offer: 18,
    },
    {
      id: "b",
      platform: "depop",
      username: "kai_pop",
      item: "Sport shades",
      type: "tee",
      photo: PHOTO.sportSunglasses,
      hue: 210,
      listed: 24,
      offer: 20,
    },
    {
      id: "c",
      platform: "ebay",
      username: "sam_thrifts",
      item: "Crystal cross",
      type: "tee",
      photo: PHOTO.crystalCross,
      hue: 200,
      listed: 28,
      offer: 24,
    },
    {
      id: "d",
      platform: "depop",
      username: "noor.vtg",
      item: "Western belt",
      type: "tee",
      photo: PHOTO.westernBelt,
      hue: 32,
      listed: 40,
      offer: 31,
    },
    {
      id: "e",
      platform: "vinted",
      username: "archive.folk",
      item: "Denim jacket",
      type: "tee",
      photo: PHOTO.sportSunglasses,
      hue: 262,
      listed: 35,
      offer: 27,
    },
    {
      id: "f",
      platform: "ebay",
      username: "seconds.london",
      item: "Knit vest",
      type: "tee",
      photo: PHOTO.crystalCross,
      hue: 96,
      listed: 26,
      offer: 21,
    },
    {
      id: "g",
      platform: "vinted",
      username: "northgate.vtg",
      item: "White star beanie",
      type: "tee",
      photo: PHOTO.whiteStarBeanie,
      hue: 300,
      listed: 30,
      offer: 23,
    },
  ];
  const PER_ROUND = 3;
  // Starts at 0 so the server render and the first client render agree; it only
  // moves once the visitor has actually cleared a round.
  const [round, setRound] = useState(0);
  const BASE_OFFERS = Array.from(
    { length: PER_ROUND },
    (_, i) => OFFER_POOL[(round * PER_ROUND + i) % OFFER_POOL.length],
  );

  type Resolution = "accepted" | "countered" | "declined";
  // Per-offer state machine, four phases:
  //   pending  → user hasn't acted yet, buttons visible
  //   resolved → user clicked, confirmation pill swaps in (~900ms hold)
  //   leaving  → exit animation playing (collapse + fade, ~350ms)
  //   gone     → unmounted from the list
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  const handle = (id: string, action: Resolution) => {
    if (resolved[id]) return; // ignore double-clicks
    onInteract?.();
    setResolved((r) => ({ ...r, [id]: action }));
    // Confirmation pill holds for 900ms so the user reads the action they
    // triggered, then the exit animation runs for 350ms, then we drop the
    // card from the DOM. Two timers keeps the choreography legible.
    window.setTimeout(() => {
      setLeaving((l) => ({ ...l, [id]: true }));
      window.setTimeout(() => {
        setRemoved((r) => ({ ...r, [id]: true }));
      }, 350);
    }, 900);
  };

  // Reset everything when nothing's left so the demo restores itself after a
  // few seconds of empty inbox. (Without this the visitor sees a permanently
  // empty panel after their first round of clicks.)
  const allDone = BASE_OFFERS.every((o) => removed[o.id]);
  useEffect(() => {
    if (!allDone) return;
    const t = window.setTimeout(() => {
      setResolved({});
      setLeaving({});
      setRemoved({});
      // Advance the window so the next round is a different three.
      setRound((r) => r + 1);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [allDone]);

  const remainingCount = BASE_OFFERS.filter((o) => !removed[o.id]).length;

  return (
    // min-height holds the panel at its full three-card size.
    //
    // Cards leave the list as the visitor accepts or declines them, and without
    // a floor the panel shrank with each one, walking the "Pending offers"
    // footer up the page and taking everything under it along. The footer's
    // mt-auto then does the rest: it stays pinned to the bottom edge while the
    // list empties above it, so the only thing that moves is the count.
    <div className="cascade-list flex min-h-[268px] flex-col gap-1.5">
      <ul className="cascade-list flex flex-col gap-1.5">
        {BASE_OFFERS.map((o, i) => {
          if (removed[o.id]) return null;
          const state = resolved[o.id];
          const isLeaving = leaving[o.id];
          return (
            <li
              key={o.id}
              className={`${isLeaving ? "hero-offer-row-exit" : "cascade-item"} flex flex-col gap-1.5 rounded-md border bg-white px-2.5 py-2 transition-colors duration-300 dark:bg-white/[0.02] ${platformBorder(o.platform)} ${
                state === "accepted"
                  ? "border-emerald-500/40 bg-emerald-500/[0.05] dark:border-emerald-400/40 dark:bg-emerald-400/[0.06]"
                  : state === "declined"
                    ? "border-zinc-400/40 opacity-60 dark:border-white/20"
                    : state === "countered"
                      ? "border-amber-500/40 bg-amber-500/[0.05] dark:border-amber-400/40 dark:bg-amber-400/[0.06]"
                      : "border-black/[0.06] dark:border-white/10"
              }`}
              style={{ "--stagger-delay": `${i * 70}ms` } as CSSProperties}
            >
              <div className="flex items-center gap-2.5">
                <ProductImage
                  type={o.type}
                  hue={o.hue}
                  src={o.photo}
                  className="size-8 flex-shrink-0 rounded"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {/* The coloured left border alone was too quiet to tell
                        visitors these offers arrive from three different
                        marketplaces, which is the whole point of the inbox. */}
                    <PlatformBadge platform={o.platform} size={13} />
                    <span className="truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
                      @{o.username}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-400">
                      ·
                    </span>
                    <span className="truncate text-[10.5px] text-zinc-500">
                      {o.item}
                    </span>
                  </div>
                  {/* Asking price and offer, and nothing else. The row also
                      carried a -N% chip and a "2m ago" stamp, which put four
                      numbers on one line for a card whose only question is
                      whether to take the offer. The percentage was arithmetic
                      the two prices already show. */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] text-zinc-500 line-through">
                      £{o.listed}
                    </span>
                    <Icon
                      name="arrow-right"
                      className="h-2.5 w-2.5 text-zinc-400"
                    />
                    <span className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                      £{o.offer}
                    </span>
                  </div>
                </div>
              </div>
              {state ? (
                /* Confirmation pill replacing the buttons for ~900ms */
                <div
                  className={`hero-offer-confirm-in flex items-center justify-center rounded px-2 py-1 text-[10.5px] font-semibold tracking-[0.06em] ${
                    state === "accepted"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : state === "countered"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-zinc-900/[0.06] text-zinc-500 dark:bg-white/10"
                  }`}
                >
                  {state === "accepted" && `Accepted at £${o.offer}`}
                  {state === "countered" &&
                    `Countered with £${Math.round((o.listed + o.offer) / 2)}`}
                  {state === "declined" && "Declined"}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handle(o.id, "accepted")}
                    className="flex-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 active:bg-emerald-500/40 dark:text-emerald-300"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(o.id, "countered")}
                    className="flex-1 rounded bg-zinc-900/[0.06] px-2 py-1 text-[10px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-900/10 active:bg-zinc-900/[0.18] dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                  >
                    Counter
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(o.id, "declined")}
                    className="flex-1 rounded px-2 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-900/[0.04] active:bg-zinc-900/[0.1] dark:hover:bg-white/[0.06]"
                  >
                    Decline
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {allDone && (
          <li className="rounded-md border border-dashed border-black/10 px-3 py-6 text-center text-[10.5px] text-zinc-500 dark:border-white/15">
            Inbox empty. New offers reappear in a moment…
          </li>
        )}
      </ul>
      <div className="mt-auto flex items-center justify-between border-t border-black/[0.06] pt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-500 dark:border-white/10">
        <span>Pending offers</span>
        <span className="font-mono text-[9.5px] text-zinc-600 tabular-nums dark:text-zinc-400">
          {remainingCount}
        </span>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────
