"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/Icon";
import {
  ConversationsPanel,
  CrosslistPanel,
  FollowBotPanel,
  LabelsPanel,
  OffersPanel,
} from "./HeroPreview";
import { RestockerScene } from "./RestockerScene";
import { DeadStockScene } from "./DeadStockScene";
import { PriceDropScene } from "./PriceDropScene";
import { RefresherScene } from "./RefresherScene";
import { AutoOffersScene } from "./AutoOffersScene";
import { Reveal } from "@/components/Reveal";

/**
 * Feature scenes, one card per capability in a sideways carousel, with tabs
 * that track the current card.
 *
 * This used to be phones only. From lg up the scenes were stacked down the
 * page in alternating two-column rows, which with five scenes already ran to
 * several screens and could not take more without becoming a very long
 * scroll. The carousel holds any number of scenes in one screen's height, so
 * desktop now gets it too, with each card laid out copy-left, panel-right.
 *
 * Scenes animate when their card is on screen and the page scrolls normally
 * throughout. This deliberately replaced a pinned scroll-scrub stage (ported
 * from oso95/scroll-world) that held the viewport and remapped scroll distance
 * onto fixed segments: the animations were the point, not the scroll-jacking,
 * and hijacking the wheel to advance them made the page feel unresponsive.
 * Don't reintroduce a pinned stage here.
 */

interface Scene {
  id: string;
  icon: IconName;
  /** Keys under the `Features` namespace. Paths rather than a single prefix
   *  because the per-feature copy lives under `chapter.*.items.*` as
   *  label/detail, while the merged inbox scene reuses the headline pair
   *  under `headlines.items.*` as title/body. */
  titleKey: string;
  /** Tab label. Falls back to titleKey when absent. */
  shortKey?: string;
  /** The docs guide behind the "Learn more" link on desktop cards. */
  href: string;
  /** Lighter panel below xl: on phones the card is phone-width, and from lg
   *  to xl the panel column is too narrow for anything laid out in two. */
  compactRender?: () => ReactNode;
  render: () => ReactNode;
}

/**
 * Holds a scene's panel: keeps its measured height, and unmounts it while it
 * is off screen.
 *
 * It used to also scale the panel, rendering it at a 680px design width and
 * transforming it down to whatever the column gave it. That is gone. Every
 * panel is responsive on its own, and the scaling was the cause of the
 * long-standing mobile complaint: at 342px the factor was about 0.50, and the
 * panels set type in hard pixels as small as 8.5px, so labels rendered near
 * 4px. Check a panel at phone width in /preview rather than reintroducing a
 * transform.
 *
 * The unmounting is not an optimisation to drop: every scene is mounted at
 * once, so without it all of them run their interval-driven animations for as
 * long as the page is open. The outer box keeps the measured height so
 * nothing collapses or shifts when a panel drops out and comes back.
 */
function SceneFrame({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const heightRef = useRef<number | null>(null);
  // Tallest this scene has ever needed. The box takes this rather than the
  // current measurement, so a panel that changes height mid-animation can
  // never shrink the box back and shove the rest of the page up. Reset only
  // on a width change, where the natural height legitimately differs.
  const tallestRef = useRef(0);
  const widthRef = useRef(0);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // Never deactivate before the first measurement, or the box would
        // have no height to hold its place with.
        if (entry.isIntersecting) setActive(true);
        else if (heightRef.current !== null) setActive(false);
      },
      // Wake a screenful early so a panel is already running by the time it
      // scrolls into view rather than starting from a dead frame.
      { rootMargin: "300px 0px" },
    );
    io.observe(outer);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const width = outer.clientWidth;
      if (width !== widthRef.current) {
        widthRef.current = width;
        tallestRef.current = 0;
      }
      const h = Math.max(tallestRef.current, inner.offsetHeight);
      tallestRef.current = h;
      heightRef.current = h;
      setHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [active]);

  return (
    <div
      ref={outerRef}
      // overflow-hidden is the backstop: with a fixed height, anything the
      // panel does internally is clipped rather than allowed to reflow the
      // page. overflow-anchor:none stops the browser trying to "helpfully"
      // compensate for changes in here by moving the scroll position, which
      // is what reads as the page jumping up and settling back.
      className="w-full overflow-hidden [overflow-anchor:none]"
      style={height !== null ? { height } : undefined}
    >
      {active ? (
        <div ref={innerRef} dir="ltr" className="w-full">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Tailwind's xl breakpoint. Below it a scene uses its compactRender: at lg
 *  the card is two columns and the panel side is only about 400px wide. */
const WIDE_QUERY = "(min-width: 80rem)";

function useIsWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    // Phone first on the server; the client corrects on hydration.
    () => false,
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`h-3.5 w-3.5 ${flip ? "rotate-180" : ""}`}
    >
      <path
        d="M5.5 3.5L9 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One card per feature, swiped sideways, with tabs that track the current
 * card. Stacked vertically the scenes ran to several screens and it was easy
 * to lose track of which feature an animation showed. SceneFrame unmounts
 * cards clipped out of view, so each animation restarts from the beginning
 * when its card comes in.
 *
 * Desktop has no swipe and a mouse wheel does not scroll sideways, so there
 * are prev/next buttons beside the dots, a peeking neighbour card is itself a
 * button to move to it, and the arrow keys work along the tab row.
 */
function SceneCarousel() {
  const tf = useTranslations("Features");
  const th = useTranslations("Home");
  const isWide = useIsWide();
  const trackRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const track = trackRef.current!;
    const mid = track.scrollLeft + track.clientWidth / 2;
    const cards = [...track.children] as HTMLElement[];
    const i = cards.reduce(
      (best, c, j) =>
        Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) <
        Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - mid)
          ? j
          : best,
      0,
    );
    setActive(i);
  };

  useEffect(() => {
    // Scroll the tab row itself, never the page. A no-op from lg up, where
    // the row wraps instead of scrolling.
    const tabs = tabsRef.current!;
    const tab = tabs.children[active] as HTMLElement;
    tabs.scrollTo({ left: tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const goTo = (i: number) => {
    const track = trackRef.current!;
    const card = track.children[i] as HTMLElement;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
  };

  const step = (by: number) => goTo((active + by + SEGMENTS) % SEGMENTS);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + SEGMENTS) % SEGMENTS;
    goTo(next);
    (tabsRef.current!.children[next] as HTMLElement).focus();
  };

  // A click anywhere on a neighbouring card brings it to the centre, and is
  // swallowed so it cannot also press a button inside a panel the visitor
  // can only half see.
  const onCardClick = (i: number) => (e: MouseEvent) => {
    if (i === active) return;
    e.preventDefault();
    e.stopPropagation();
    goTo(i);
  };

  return (
    <div className="pt-8 pb-10 sm:pt-10 lg:pb-14">
      {/* The first/last auto margins centre the row when it fits and let it
          scroll from the true start when it does not. justify-center on an
          overflowing row clips the first tabs off the left edge with no way
          to scroll back to them. */}
      <div
        ref={tabsRef}
        role="tablist"
        onKeyDown={onTabKey}
        className="relative flex gap-2 overflow-x-auto px-6 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>:first-child]:ms-auto [&>:last-child]:me-auto lg:mx-auto lg:max-w-6xl lg:flex-wrap lg:justify-center lg:overflow-visible lg:pb-8 lg:[&>:first-child]:ms-0 lg:[&>:last-child]:me-0"
      >
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => goTo(i)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              i === active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-black/[0.04] text-zinc-600 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1]"
            }`}
          >
            <Icon name={s.icon} className="h-3.5 w-3.5" />
            {tf(s.shortKey ?? s.titleKey)}
          </button>
        ))}
      </div>

      <Reveal panel>
        {/* `relative` makes the track the cards' offsetParent, so their
            offsetLeft is measured in the same space as scrollLeft.

            From lg up each card is the track's full content width and the
            side padding is what is left of the screen, so the first and last
            cards can centre and the neighbours peek in from the edges. */}
        <div
          ref={trackRef}
          dir="ltr"
          onScroll={onScroll}
          className="relative flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-[4%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-6 lg:px-[max(5rem,calc(50%-34rem))]"
        >
          {SCENES.map((s, i) => (
            <article
              key={s.id}
              aria-label={tf(s.titleKey)}
              onClickCapture={onCardClick(i)}
              className={`flex w-[92%] max-w-xl shrink-0 snap-center flex-col rounded-3xl border border-black/[0.08] bg-white p-4 shadow-sm transition-opacity duration-300 lg:grid lg:w-full lg:max-w-none lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14 lg:p-12 dark:border-white/10 dark:bg-zinc-900 ${
                i === active ? "" : "lg:cursor-pointer lg:opacity-45"
              }`}
            >
              <div dir="auto">
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {i + 1} / {SEGMENTS}
                </span>
                <h3 className="mt-2 text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-900 lg:mt-4 lg:text-[2rem] lg:leading-[1.15] lg:tracking-[-0.02em] dark:text-zinc-50">
                  {tf(s.titleKey)}
                </h3>
                <p className="mt-2 text-pretty text-[0.95rem] leading-relaxed text-zinc-600 lg:mt-4 lg:max-w-[38ch] lg:text-base dark:text-zinc-400">
                  {th(`featuresSection.scenes.${s.id}`)}
                </p>
                {/* Desktop only: the phone card is already as tall as the
                    tallest panel, and the tab row carries the navigation. */}
                <Link
                  href={s.href}
                  tabIndex={i === active ? undefined : -1}
                  className="group mt-7 hidden items-center gap-1.5 text-sm font-medium text-zinc-900 lg:inline-flex dark:text-zinc-100"
                >
                  {tf("headlines.learnMore")}
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180">
                    <Chevron />
                  </span>
                </Link>
              </div>
              <div className="mt-5 min-w-0 flex-1 lg:mt-0">
                <SceneFrame>
                  {(isWide ? s.render : (s.compactRender ?? s.render))()}
                </SceneFrame>
              </div>
            </article>
          ))}
        </div>
      </Reveal>

      <div className="mt-5 flex items-center justify-center gap-4 lg:mt-8">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={th("featuresSection.prev")}
          className="grid h-9 w-9 place-items-center rounded-full border border-black/10 text-zinc-700 transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/15 dark:text-zinc-300 dark:hover:border-white/25 dark:hover:bg-white/[0.06]"
        >
          <Chevron flip />
        </button>
        <div className="flex justify-center gap-1.5" aria-hidden>
          {SCENES.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-zinc-900 dark:bg-white" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={th("featuresSection.next")}
          className="grid h-9 w-9 place-items-center rounded-full border border-black/10 text-zinc-700 transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/15 dark:text-zinc-300 dark:hover:border-white/25 dark:hover:bg-white/[0.06]"
        >
          <Chevron />
        </button>
      </div>
    </div>
  );
}

// Titles and tab labels reuse copy that already exists (and is already
// translated into all six locales) on the /features page; only the one-line
// description under each title is homepage-specific.
// Exported for the dev-only /preview harness, which maps over this array
// rather than keeping its own copy. A second list drifted: it listed a panel
// the homepage had stopped showing and omitted one it had added.
//
// Ordered as a seller meets the problems: get stock onto both shops and keep
// it in sync, deal with what is not selling, find buyers, then handle offers
// and ship.
export const SCENES: Scene[] = [
  {
    id: "crosslist",
    icon: "swap",
    titleKey: "chapter.crosslisting.items.bidirectional.label",
    shortKey: "chapter.crosslisting.items.bidirectional.name",
    href: "/docs/inventory/crosslist",
    render: () => <CrosslistPanel />,
  },
  {
    id: "restocker",
    // "wave" to match /features. It was "refresh", which now belongs to the
    // refresher scene a few tabs along.
    icon: "wave",
    // Named rather than described: "Restocker" is what the feature is called
    // in the panel and the pricing table, so the scene teaches the word. Its
    // own key rather than the plain `name` because the scene wants the
    // cross-platform framing that the grid tile doesn't have room for.
    titleKey: "chapter.sales.items.restocker.sceneTitle",
    shortKey: "chapter.sales.items.restocker.name",
    href: "/docs/automate/restocker",
    render: () => <RestockerScene />,
  },
  {
    id: "deadStock",
    icon: "search",
    titleKey: "chapter.visibility.items.deadStock.label",
    shortKey: "chapter.visibility.items.deadStock.name",
    href: "/docs/automate/dead-stock",
    render: () => <DeadStockScene />,
  },
  {
    id: "priceDrops",
    icon: "sparkle",
    titleKey: "chapter.visibility.items.autoMarkdown.label",
    shortKey: "chapter.visibility.items.autoMarkdown.name",
    href: "/docs/automate/price-drops",
    render: () => <PriceDropScene />,
  },
  {
    id: "refresher",
    icon: "refresh",
    titleKey: "chapter.visibility.items.refresher.label",
    shortKey: "chapter.visibility.items.refresher.name",
    href: "/docs/inventory/refresh",
    render: () => <RefresherScene />,
  },
  {
    id: "followBot",
    icon: "users",
    titleKey: "chapter.visibility.items.followBot.label",
    shortKey: "chapter.visibility.items.followBot.name",
    href: "/docs/inventory/bots",
    render: () => <FollowBotPanel />,
  },
  {
    id: "inbox",
    icon: "message",
    titleKey: "headlines.items.oneInbox.title",
    shortKey: "chapter.sales.items.offersInbox.name",
    href: "/docs/buyers/offers",
    compactRender: () => <OffersPanel />,
    // items-stretch, not items-start: both panels are flex columns whose footer
    // ("Pending offers" / "Inbox") sits on mt-auto, so stretching them to a
    // shared height lands both footers on the same line. With items-start each
    // panel was its own height and the two footers sat at different levels,
    // which read as one column being unfinished.
    // One column on phones. Two 171px panels side by side inside a 342px
    // screen is unreadable, and each one reflows fine on its own.
    render: () => (
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
        <OffersPanel />
        <ConversationsPanel />
      </div>
    ),
  },
  {
    id: "autoOffers",
    icon: "zap",
    titleKey: "chapter.sales.items.autoOffers.label",
    shortKey: "chapter.sales.items.autoOffers.name",
    href: "/docs/automate/auto-offers",
    render: () => <AutoOffersScene />,
  },
  {
    id: "labels",
    icon: "box",
    titleKey: "chapter.sales.items.shipping.label",
    shortKey: "chapter.sales.items.shipping.name",
    href: "/docs/buyers/labels",
    render: () => (
      <div className="mx-auto max-w-xl">
        <LabelsPanel />
      </div>
    ),
  },
];

const SEGMENTS = SCENES.length;

export function ScrollWorldDemo() {
  const t = useTranslations("Home");

  return (
    <section
      id="features"
      aria-label={t("previewEyebrow")}
      className="relative scroll-mt-20 border-t border-black/10 dark:border-white/10"
    >
      <Reveal as="div" className="mx-auto w-full max-w-7xl px-6 pt-14 text-center sm:pt-16">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
          {t("featuresSection.eyebrow")}
        </span>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("featuresSection.title")}
        </h2>
      </Reveal>
      {/* Full bleed, outside the max-w container, so the neighbouring cards
          peek in from the screen edges rather than being cut off at an
          invisible column line. */}
      <SceneCarousel />
    </section>
  );
}
