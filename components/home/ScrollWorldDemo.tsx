"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
  // Imports for the parked scenes below. Uncomment alongside the scene.
  // AutoOffersPanel,
  // ListingsPanel,
  // PriceDropsPanel,
  // RelisterPanel,
  // RestockerPanel,
  // ShopDesignerPanel,
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
  bodyKey: string;
  /** A few words for phones, where the full `bodyKey` sentence is longer than
   *  the animation it introduces. Falls back to bodyKey when absent. */
  shortKey?: string;
  /** 'split' is the default copy-beside-visual scene. 'full' centres the copy
   *  above a full-width visual, for the closing overview. */
  layout?: "split" | "full";
  /** The panel reflows down to phone width on its own, so the stacked mobile
   *  fallback renders it at natural size instead of scaling it.
   *
   *  Scaling is what made panel text unreadable on a phone: FitWidth renders at
   *  a 680px design width and scales to the ~345px available, so 9px labels
   *  came out at roughly 4.5px. A panel that reflows needs none of that. Set
   *  this only once the panel genuinely works at 360px. */
  fluid?: boolean;
  render: () => ReactNode;
}

/**
 * Every feature the extension ships, for the closing overview. Both the name
 * and the one-line description come from the /features page's own chapter tree
 * (Features.chapter.*.items.*), which is already translated into all six
 * locales, so the grid stays in step with that page without a second set of
 * strings to maintain. Only the icon is chosen here.
 */
// Deliberately excludes anything already shown as a scene above, so the
// heading ("Everything else SaleLinx does") is literally true rather than
// repeating the five features the visitor just scrolled through. The six left
// out are: crosslisting.items.bidirectional, sales.items.restocker,
// visibility.items.followBot, sales.items.offersInbox, sales.items.messages
// and sales.items.shipping. Re-add a key here if its scene is ever parked.
const ALL_FEATURES: { key: string; icon: IconName }[] = [
  { key: "crosslisting.items.autoMap", icon: "puzzle" },
  { key: "sales.items.relister", icon: "rotate" },
  { key: "visibility.items.refresher", icon: "refresh" },
  { key: "visibility.items.scheduler", icon: "clock" },
  { key: "visibility.items.autoMarkdown", icon: "tag" },
  { key: "visibility.items.deadStock", icon: "search" },
  { key: "visibility.items.filters", icon: "filter" },
  { key: "sales.items.autoOffers", icon: "sparkle" },
  { key: "crosslisting.items.shopDesigner", icon: "layout" },
  { key: "crosslisting.items.csvImport", icon: "upload" },
  { key: "listings.items.dashboard", icon: "grid" },
  { key: "listings.items.linkAccounts", icon: "link" },
  { key: "listings.items.backup", icon: "cloud" },
  { key: "listings.items.sync", icon: "sync" },
  { key: "visibility.items.activityLog", icon: "list" },
  { key: "listings.items.multilanguage", icon: "globe" },
];

// Width the panels are actually designed for. Several of them use fixed grid
// tracks (28px/36px/56px columns, side-by-side marketplace cards), so below
// this they don't reflow, they overflow and get clipped by the body's
// overflow-x: clip. Rendering at this width and scaling down keeps the
// intended layout and just makes it smaller.
const DESIGN_WIDTH = 680;

/**
 * Renders children at DESIGN_WIDTH and scales them down to whatever width is
 * actually available. Used by the stacked mobile fallback; the pinned desktop
 * stage has room for the panels at full size and does its own height fit.
 */
function FitWidth({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);
  // The stacked fallback mounts every scene at once, so without this all of
  // them run their interval-driven animations the whole time you are on the
  // page. Unmounting the ones you are not looking at stops that work; the
  // measured height stays on the outer box, so nothing collapses or shifts
  // when a panel drops out and comes back.
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
      const next = Math.min(1, width / DESIGN_WIDTH);
      setScale(next);
      // offsetHeight is the pre-transform layout height, so this can't feed
      // back into itself through the height we set on the outer box.
      const h = Math.max(tallestRef.current, inner.offsetHeight * next);
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
        <div
          ref={innerRef}
          dir="ltr"
          style={{
            width: DESIGN_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function FeatureOverview() {
  const tf = useTranslations("Features.chapter");
  // Sixteen bordered cards read as a wall: sixteen boxes, sixteen icon
  // badges, sixteen two-line descriptions, all competing at once. It was the
  // busiest block on the page and it closes a section whose whole argument is
  // that the product is calm.
  //
  // So: no boxes. A ruled list of names, which is what "everything else"
  // wants to be - you scan it for the one you came for. The detail lines are
  // gone rather than hidden; /features carries them, and the names already
  // say what each feature is.
  return (
    <div className="grid w-full grid-cols-2 gap-x-7 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-10">
      {ALL_FEATURES.map((f, i) => (
        <div
          key={f.key}
          className="cascade-item flex items-center gap-2.5 border-b border-black/[0.06] py-2.5 text-start lg:py-3 dark:border-white/[0.08]"
          style={{ "--stagger-delay": `${i * 28}ms` } as CSSProperties}
        >
          <Icon
            name={f.icon}
            className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500"
          />
          <span className="min-w-0 truncate text-[12.5px] leading-snug text-zinc-700 lg:text-[13.5px] dark:text-zinc-300">
            {tf(`${f.key}.name`)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Every scene reuses copy that already exists (and is already translated into
// all six locales) on the /features page, so adding the scroll didn't mean
// inventing 11 new descriptions and machine-translating them.
const SCENES: Scene[] = [
  {
    id: "crosslist",
    fluid: true,
    icon: "swap",
    titleKey: "chapter.crosslisting.items.bidirectional.label",
    bodyKey: "chapter.crosslisting.items.bidirectional.detail",
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
    bodyKey: "chapter.sales.items.restocker.detail",
    shortKey: "chapter.sales.items.restocker.name",
    render: () => <RestockerScene />,
  },
  // Shop designer and My listings are parked, not deleted: both panels are
  // still exported from HeroPreview and their copy is still in every locale,
  // so re-enabling either is just uncommenting its scene (and its import).
  // {
  //   id: 'shopDesigner',
  //   icon: 'layout',
  //   titleKey: 'chapter.crosslisting.items.shopDesigner.label',
  //   bodyKey: 'chapter.crosslisting.items.shopDesigner.detail',
  //   render: () => <ShopDesignerPanel />,
  // },
  // {
  //   id: 'listings',
  //   icon: 'grid',
  //   titleKey: 'chapter.listings.items.dashboard.label',
  //   bodyKey: 'chapter.listings.items.dashboard.detail',
  //   render: () => <ListingsPanel />,
  // },
  // {
  //   id: 'relister',
  //   icon: 'rotate',
  //   titleKey: 'chapter.sales.items.relister.label',
  //   bodyKey: 'chapter.sales.items.relister.detail',
  //   render: () => <RelisterPanel />,
  // },
  // {
  //   id: 'priceDrops',
  //   icon: 'tag',
  //   titleKey: 'chapter.visibility.items.autoMarkdown.label',
  //   bodyKey: 'chapter.visibility.items.autoMarkdown.detail',
  //   render: () => <PriceDropsPanel />,
  // },
  {
    id: "followBot",
    icon: "users",
    titleKey: "chapter.visibility.items.followBot.label",
    bodyKey: "chapter.visibility.items.followBot.detail",
    shortKey: "chapter.visibility.items.followBot.name",
    render: () => <FollowBotPanel />,
  },
  {
    // Side by side rather than stacked: stacking would roughly double the
    // tallest scene, and every other scene scales down to match that ceiling.
    id: "inbox",
    icon: "message",
    titleKey: "headlines.items.oneInbox.title",
    bodyKey: "headlines.items.oneInbox.body",
    // items-stretch, not items-start: both panels are flex columns whose footer
    // ("Pending offers" / "Inbox") sits on mt-auto, so stretching them to a
    // shared height lands both footers on the same line. With items-start each
    // panel was its own height and the two footers sat at different levels,
    // which read as one column being unfinished.
    render: () => (
      <div className="grid grid-cols-2 items-stretch gap-4">
        <OffersPanel />
        <ConversationsPanel />
      </div>
    ),
  },
  // {
  //   id: 'autoOffers',
  //   icon: 'sparkle',
  //   titleKey: 'chapter.sales.items.autoOffers.label',
  //   bodyKey: 'chapter.sales.items.autoOffers.detail',
  //   render: () => <AutoOffersPanel />,
  // },
  {
    id: "labels",
    icon: "box",
    titleKey: "chapter.sales.items.shipping.label",
    bodyKey: "chapter.sales.items.shipping.detail",
    shortKey: "chapter.sales.items.shipping.name",
    render: () => <LabelsPanel />,
  },
  {
    // Closing overview: the scenes above are a handful of the features, so the
    // scroll ends by naming all of them at once rather than implying that is
    // the whole product.
    id: "more",
    icon: "sparkle",
    titleKey: "sectionHeader.title",
    bodyKey: "overviewBody",
    layout: "full",
    render: () => <FeatureOverview />,
  },
];

const SEGMENTS = SCENES.length;
export function ScrollWorldDemo() {
  const t = useTranslations("Home");
  const tf = useTranslations("Features");

  // Copy block for a scene.
  const sceneCopy = (s: Scene, i: number, compact: boolean) => (
    <div className={compact ? "" : "max-w-md"}>
      <span className="inline-flex items-center gap-2.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
        <span className="text-emerald-600 dark:text-emerald-400">
          <Icon name={s.icon} className="h-3.5 w-3.5" />
        </span>
        {String(i + 1).padStart(2, "0")} / {String(SEGMENTS).padStart(2, "0")}
      </span>
      <h3 className="mt-3 text-balance text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900 sm:text-3xl dark:text-zinc-50">
        {tf(s.titleKey)}
      </h3>
      {/* Hidden on phones: with one scene per screen the heading and the
          animation carry it, and a sentence underneath was the only thing
          making a scene feel crowded. */}
      <p className="mt-3 hidden max-w-[42ch] text-pretty text-sm leading-relaxed text-zinc-500 sm:block dark:text-zinc-500">
        {tf(s.bodyKey)}
      </p>
    </div>
  );

  return (
    <section
      id="features"
      aria-label={t("previewEyebrow")}
      className="relative scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-6xl pb-12 pt-4 sm:px-6 sm:py-12">
        {/* One scene per screen on phones, scrolled vertically like the rest of
            the page; two alternating columns from lg up.

            min-height rather than scroll snapping: snapping the document needs
            scroll-snap-type on the scroll container itself, and an inner
            scroller that traps touch is worse than no snap at all on iOS.

            svh, not vh: on iOS vh is the tallest the viewport ever gets, so a
            100vh scene is always slightly taller than the screen with the
            address bar showing, and the next scene's heading peeks in. */}
        <div className="flex flex-col sm:gap-20">
          {SCENES.map((s, i) => {
            // Alternate which side the animation sits on as you move down.
            // Split layouts only: the closing overview stacks vertically, so
            // the same CSS order would push its heading underneath the grid
            // instead of swapping columns.
            const visualFirst = s.layout !== "full" && i % 2 === 1;
            const full = s.layout === "full";
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
                className={
                  full
                    ? "flex min-h-[100svh] flex-col items-center justify-center gap-6 px-6 text-center sm:min-h-0 sm:px-0"
                    : `grid min-h-[100svh] grid-cols-1 items-center gap-4 px-6 sm:min-h-0 sm:gap-8 sm:px-0 lg:gap-14 ${
                        visualFirst
                          ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
                          : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                      }`
                }
              >
                {/* Sides are swapped with CSS order rather than by reordering
                    the markup, so the copy still comes first in the DOM and
                    screen readers and keyboard focus meet the heading before
                    the decorative panel on every scene. */}
                <div
                  dir="auto"
                  className={
                    full
                      ? "max-w-xl"
                      : visualFirst
                        ? "lg:order-2"
                        : "lg:order-1"
                  }
                >
                  {sceneCopy(s, i, full)}
                </div>

                {/* Pinned LTR because the panels mock an extension UI that is
                    laid out left to right. The overview is a responsive text
                    grid and reads fine at any width, so it renders at full
                    size. The other panels don't reflow below their design
                    width, so they get scaled. */}
                <div
                  className={`w-full min-w-0 ${
                    full ? "" : visualFirst ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  {full || s.fluid ? (
                    s.render()
                  ) : (
                    <FitWidth>{s.render()}</FitWidth>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
