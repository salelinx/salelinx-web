"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/Icon";
import {
  ConversationsPanel,
  CrosslistPanel,
  FollowBotPanel,
  LabelsPanel,
  OffersPanel,
} from "./HeroPreview";
import { RestockerScene } from "./RestockerScene";
import { Reveal } from "@/components/Reveal";

/**
 * Feature scenes, stacked down the page.
 *
 * Each scene is one capability: copy on one side, the feature's animation on
 * the other, floating free rather than boxed inside mock app chrome. Sides
 * alternate as you move down.
 *
 * Scenes animate when they scroll into view and the page scrolls normally
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
  /** Equal columns on desktop, for a panel too narrow for the wide side. */
  even?: boolean;
  /** Tab label in the phone carousel. Falls back to titleKey when absent. */
  shortKey?: string;
  /** Lighter panel for the phone carousel, where every card shares the
   *  tallest card's height. */
  mobileRender?: () => ReactNode;
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
 * once, so without it all six run their interval-driven animations for as
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

/**
 * Phones and tablets: one card per feature, swiped sideways, with tabs that
 * track the current card. Stacked vertically the five scenes ran to several
 * screens and it was easy to lose track of which feature an animation showed.
 * SceneFrame unmounts cards clipped out of view, so each animation restarts
 * from the beginning when its card is swiped in.
 */
function MobileScenes() {
  const tf = useTranslations("Features");
  const th = useTranslations("Home");
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
    // Scroll the tab row itself, never the page.
    const tabs = tabsRef.current!;
    const tab = tabs.children[active] as HTMLElement;
    tabs.scrollTo({ left: tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const goTo = (i: number) => {
    const track = trackRef.current!;
    const card = track.children[i] as HTMLElement;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
  };

  return (
    <div className="pt-8 pb-10 sm:pt-10 lg:hidden">
      <div
        ref={tabsRef}
        role="tablist"
        className="flex gap-2 overflow-x-auto px-6 pb-5 [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden"
      >
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => goTo(i)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              i === active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-black/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
            }`}
          >
            <Icon name={s.icon} className="h-3.5 w-3.5" />
            {tf(s.shortKey ?? s.titleKey)}
          </button>
        ))}
      </div>

      <Reveal panel>
        <div
          ref={trackRef}
          dir="ltr"
          onScroll={onScroll}
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-[4%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SCENES.map((s, i) => (
            <article
              key={s.id}
              aria-label={tf(s.titleKey)}
              className="flex w-[92%] max-w-xl shrink-0 snap-center flex-col rounded-3xl border border-black/[0.08] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900"
            >
              <div dir="auto">
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {i + 1} / {SEGMENTS}
                </span>
                <h3 className="mt-2 text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                  {tf(s.titleKey)}
                </h3>
                <p className="mt-2 text-pretty text-[0.95rem] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {th(`featuresSection.scenes.${s.id}`)}
                </p>
              </div>
              <div className="mt-5 min-w-0 flex-1">
                <SceneFrame>{(s.mobileRender ?? s.render)()}</SceneFrame>
              </div>
            </article>
          ))}
        </div>
      </Reveal>

      <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
        {SCENES.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-5 bg-zinc-900 dark:bg-white" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Every scene reuses copy that already exists (and is already translated into
// all six locales) on the /features page, so adding the scroll didn't mean
// inventing 11 new descriptions and machine-translating them.
// Exported for the dev-only /preview harness, which maps over this array
// rather than keeping its own copy. A second list drifted: it listed a panel
// the homepage had stopped showing and omitted one it had added.
export const SCENES: Scene[] = [
  {
    id: "crosslist",
    icon: "swap",
    titleKey: "chapter.crosslisting.items.bidirectional.label",
    shortKey: "chapter.crosslisting.items.bidirectional.name",
    render: () => <CrosslistPanel />,
  },
  {
    id: "restocker",
    icon: "refresh",
    // Named rather than described: "Restocker" is what the feature is called
    // in the panel and the pricing table, so the scene teaches the word. Its
    // own key rather than the plain `name` because the scene wants the
    // cross-platform framing that the grid tile doesn't have room for.
    titleKey: "chapter.sales.items.restocker.sceneTitle",
    shortKey: "chapter.sales.items.restocker.name",
    render: () => <RestockerScene />,
  },
  {
    id: "followBot",
    icon: "users",
    titleKey: "chapter.visibility.items.followBot.label",
    shortKey: "chapter.visibility.items.followBot.name",
    render: () => <FollowBotPanel />,
  },
  {
    // Side by side rather than stacked: stacking would roughly double the
    // tallest scene, and every other scene scales down to match that ceiling.
    id: "inbox",
    icon: "message",
    titleKey: "headlines.items.oneInbox.title",
    shortKey: "chapter.sales.items.offersInbox.name",
    mobileRender: () => <OffersPanel />,
    // items-stretch, not items-start: both panels are flex columns whose footer
    // ("Pending offers" / "Inbox") sits on mt-auto, so stretching them to a
    // shared height lands both footers on the same line. With items-start each
    // panel was its own height and the two footers sat at different levels,
    // which read as one column being unfinished.
    // One column on phones. Two 171px panels side by side inside a 342px
    // screen is unreadable, and each one reflows fine on its own. The old
    // objection to stacking (it doubles the tallest scene, and every other
    // scene scaled down to match that ceiling) died with the pinned stage:
    // scenes are independently sized now.
    render: () => (
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
        <OffersPanel />
        <ConversationsPanel />
      </div>
    ),
  },
  {
    id: "labels",
    icon: "box",
    titleKey: "chapter.sales.items.shipping.label",
    shortKey: "chapter.sales.items.shipping.name",
    // A list of short rows: in the wide visual column the rows stretch thin.
    even: true,
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
  const tf = useTranslations("Features");

  // Copy block for a scene.
  const sceneCopy = (s: Scene, i: number) => (
    <div className="max-w-md">
      <span className="inline-flex items-center gap-2.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
        <span className="text-emerald-600 dark:text-emerald-400">
          <Icon name={s.icon} className="h-3.5 w-3.5" />
        </span>
        {String(i + 1).padStart(2, "0")} / {String(SEGMENTS).padStart(2, "0")}
      </span>
      <h3 className="mt-3 text-balance text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900 sm:text-3xl lg:text-4xl dark:text-zinc-50">
        {tf(s.titleKey)}
      </h3>
      <p className="mt-4 max-w-[42ch] text-pretty text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
        {t(`featuresSection.scenes.${s.id}`)}
      </p>
    </div>
  );

  return (
    <section
      id="features"
      aria-label={t("previewEyebrow")}
      className="relative scroll-mt-20 border-t border-black/10 dark:border-white/10"
    >
      <div className="mx-auto w-full max-w-7xl pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-4">
        <Reveal as="div" className="px-6 pt-10 text-center sm:px-0 sm:pt-14">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
            {t("featuresSection.eyebrow")}
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            {t("featuresSection.title")}
          </h2>
        </Reveal>
        {/* Scenes are content-height, one column on phones and two alternating
            columns from lg up.

            They used to be min-h-[100svh] each, so one filled a phone screen.
            That was the only thing separating them, and it cost a lot of air:
            content of about 450px centred in 844px left roughly 170px dead
            above the heading and below the panel, which read as sparse and
            made the section a long scroll of nearly-empty screens. The rule
            between scenes does the separating now, so the height can go. */}
        {/* A hairline between scenes rather than a gap alone: at 80px of empty
            space the scenes read as one long section, and the eyebrow counter
            ("01 / 06") was the only thing saying otherwise. The rule sits
            midway because the space comes from each scene's own padding, not
            from a flex gap, so there is equal air above and below it. */}
        <MobileScenes />
        <div className="hidden flex-col divide-y divide-black/[0.08] lg:flex dark:divide-white/10">
          {SCENES.map((s, i) => {
            // Alternate which side the animation sits on as you move down.
            const visualFirst = i % 2 === 1;
            return (
              /* Reveal's `panel` variant puts `panel-swap` on this block once
                 it scrolls into view, which is load-bearing rather than
                 decoration: every panel is built from .cascade-item elements,
                 which globals.css starts at opacity 0 and only reveals through
                 `.panel-swap .cascade-item`. Without it the panels render
                 perfectly and are entirely invisible. It has to be
                 panel-swap and not `.in-view`, because that rule only reaches
                 direct children and the items are nested deeper. */
              <Reveal
                panel
                key={s.id}
                dir="ltr"
                className={`grid grid-cols-1 content-center items-center gap-7 px-6 py-14 sm:gap-8 sm:px-0 sm:py-20 lg:gap-14 ${
                  s.even
                    ? "lg:grid-cols-2"
                    : visualFirst
                    ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]"
                    : "lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]"
                }`}
              >
                {/* content-center matters on phones: the scene is
                    min-h-[100svh] and a grid's default align-content is
                    stretch, so the two auto rows each grew to half the screen
                    and the heading ended up centred a half-viewport above the
                    panel it labels. content-center keeps the rows their own
                    height and centres the pair together. */}
                {/* Sides are swapped with CSS order rather than by reordering
                    the markup, so the copy still comes first in the DOM and
                    screen readers and keyboard focus meet the heading before
                    the decorative panel on every scene. */}
                <div
                  dir="auto"
                  className={visualFirst ? "lg:order-2" : "lg:order-1"}
                >
                  {sceneCopy(s, i)}
                </div>

                <div className={`w-full min-w-0 ${visualFirst ? "lg:order-1" : "lg:order-2"}`}>
                  <SceneFrame>{s.render()}</SceneFrame>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
