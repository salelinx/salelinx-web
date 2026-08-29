"use client";

import {
  useCallback,
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

/**
 * Scroll-scrubbed feature scenes.
 *
 * The mechanic is ported from oso95/scroll-world's scrub engine: a stage is
 * pinned to the viewport while the page scrolls past a tall spacer, and scroll
 * distance is remapped onto a series of fixed-width segments. scroll-world
 * scrubs `video.currentTime` inside each segment against a rendered camera
 * flight; we have live React animations instead, so a segment picks the scene
 * and drives a settle/crossfade at the seams.
 *
 * Each scene is one capability: copy on one side, the feature's animation on
 * the other, floating free rather than boxed inside mock app chrome.
 *
 * Degrades to a plain stacked list of the same scenes on narrow screens and
 * under prefers-reduced-motion.
 */

// Viewport-heights of scroll spent on each scene. scroll-world's default
// `diveScroll` is 1.3 per scene, tuned for a camera flight you want to linger
// in; a UI vignette is read in a beat, so holding one this long just felt like
// the page had stopped responding.
const SEGMENT_SCROLL = 0.55;

// scroll-world's `linger`: how much of a segment is spent settled on the scene
// rather than moving between them. 0 is linear, 1 is fully eased.
const LINGER = 0.55;

// Fraction of a segment at each end treated as the seam, where the outgoing
// scene fades out and the incoming one fades in.
const SEAM = 0.14;

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

/**
 * How much scroll the first scene gets, as a fraction of a normal segment.
 *
 * `travelled` is clamped at 0 until the section's top reaches the viewport top,
 * so scene 1 is already pinned and on screen for the whole time the hero
 * scrolls past - and only then does its own segment start. It was costing a
 * hero's worth of scroll more than every other scene to get off. Shrinking its
 * segment hands that back, so all the scenes feel like they last the same.
 *
 * It cannot go to zero: about 540px of that head start is the pre-pin travel,
 * which is fixed by the hero's height, so a quarter-segment is roughly where
 * the first scene stops outlasting the rest without leaving its cross-fade
 * seam too short to read.
 */
const FIRST_SEGMENT_SCALE = 0.25;

/** Total segment-widths of scroll, with the first one shortened. */
const SEGMENT_WEIGHT = SEGMENTS - 1 + FIRST_SEGMENT_SCALE;

/**
 * Map 0..1 across the spacer onto a scene and how far through it we are.
 * Uniform for every segment but the first, which is FIRST_SEGMENT_SCALE wide.
 */
function segmentAt(raw: number): { index: number; within: number } {
  const w = raw * SEGMENT_WEIGHT;
  if (w < FIRST_SEGMENT_SCALE) {
    return { index: 0, within: clamp01(w / FIRST_SEGMENT_SCALE) };
  }
  const rest = w - FIRST_SEGMENT_SCALE;
  const index = Math.min(SEGMENTS - 1, 1 + Math.floor(rest));
  return { index, within: clamp01(rest - (index - 1)) };
}

/** Scroll offset of a segment's midpoint, as a fraction of the spacer. */
function segmentMidpoint(i: number): number {
  const start = i === 0 ? 0 : FIRST_SEGMENT_SCALE + (i - 1);
  const width = i === 0 ? FIRST_SEGMENT_SCALE : 1;
  return (start + width / 2) / SEGMENT_WEIGHT;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * scroll-world's `lingerEase`: blends linear progress with a cubic centred on
 * the segment midpoint. The cubic is flat around its centre and steep at the
 * edges, so the scene holds still mid-segment and moves quickly through the
 * boundary. L of 0 leaves progress linear.
 */
function lingerEase(x: number, L: number): number {
  const c = x - 0.5;
  return (1 - L) * x + L * (4 * c * c * c + 0.5);
}

export function ScrollWorldDemo() {
  const t = useTranslations("Home");
  const tf = useTranslations("Features");

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [driving, setDriving] = useState(false);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  // Scale that keeps the tallest scene inside one viewport, plus the layout
  // height that scale implies.
  const [fit, setFit] = useState(1);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  // The site header is sticky, so the pinned stage starts below it.
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia(
      "(min-height: 600px) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => setDriving(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Fit-to-viewport, measured per scene.
  //
  // This used to size every scene to the tallest one ever seen, which meant
  // the 22-tile overview dragged all five others down to its scale and left
  // them small and adrift in the middle of the viewport. Each scene now gets
  // its own scale. Within a scene we still keep the tallest frame it reaches,
  // so a panel animating its own height doesn't rescale the stage mid-play.
  const naturalsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!driving) return;
    const sceneId = SCENES[index]?.id;
    if (!sceneId) return;

    const recalc = () => {
      const stage = stageRef.current;
      if (!stage) return;
      // offsetHeight is the pre-transform layout height, so reading it back
      // while the stage is scaled can't feed into itself.
      const measured = stage.offsetHeight;
      if (!measured) return;
      const natural = Math.max(naturalsRef.current[sceneId] ?? 0, measured);
      naturalsRef.current[sceneId] = natural;

      const header = document.querySelector("header")?.offsetHeight ?? 0;
      setHeaderH(header);

      const available = window.innerHeight - header - 56;
      const next = Math.min(1, Math.max(0.45, available / natural));
      setFit(next);
      setFitHeight(natural * next);
    };

    const onResize = () => {
      // Natural heights depend on width, so let them grow back on a resize
      // rather than staying stuck at the tallest they ever were.
      naturalsRef.current = {};
      recalc();
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [driving, index]);

  useEffect(() => {
    if (!driving) return;

    let frame = 0;
    let currentIndex = -1;

    const measure = () => {
      frame = 0;
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;

      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const rect = section.getBoundingClientRect();
      const travelled = -rect.top;
      const raw = clamp01(travelled / scrollable);

      // Remap 0..1 across the whole spacer onto 0..SEGMENTS, then split into
      // the segment we're in and how far through it we are.
      const { index: nextIndex, within } = segmentAt(raw);
      const eased = lingerEase(within, LINGER);

      // 1 while settled on a scene, easing to 0 at both segment edges so
      // consecutive scenes cross-fade through each other.
      //
      // The outer edges of the whole scroll are deliberately exempt. Without
      // that, the first scene sits at opacity 0 until you scroll into it, so
      // the section reads as blank space under the hero and there is nothing
      // to tell you it is worth scrolling. Same at the far end, where the last
      // scene would fade out into nothing before the next section arrives.
      const atFirstEdge = nextIndex === 0 && eased < SEAM;
      const atLastEdge = nextIndex === SEGMENTS - 1 && eased > 1 - SEAM;
      const seam =
        atFirstEdge || atLastEdge
          ? 1
          : eased < SEAM
            ? eased / SEAM
            : eased > 1 - SEAM
              ? (1 - eased) / SEAM
              : 1;

      // Written straight to CSS custom properties rather than through state:
      // this runs every scroll frame and re-rendering a scene at that rate
      // would drop frames. Only the segment index goes through React.
      stage.style.setProperty("--seam", seam.toFixed(4));
      stage.style.setProperty("--settle", (0.985 + seam * 0.015).toFixed(4));

      // Entry lift. While the section is still coming up the page the scene
      // rides at the top of the pinned box, so it is fully in frame under the
      // hero instead of sitting half a viewport down. As the section reaches
      // its pinned position it eases back down into the centre.
      //
      // The lift is capped at the free space above the scene, so it can never
      // pull the scene up past the section's own top edge and over the hero.

      if (nextIndex !== currentIndex) {
        currentIndex = nextIndex;
        setIndex(nextIndex);
      }
      if (raw > 0.002) setStarted(true);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // headerH feeds the entry-lift maths, so re-subscribe if it changes.
  }, [driving, headerH]);

  const scrollToSegment = useCallback((i: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    window.scrollTo({
      top: section.offsetTop + scrollable * segmentMidpoint(i),
      behavior: "smooth",
    });
  }, []);

  const scene = SCENES[index] ?? SCENES[0];
  // Alternate which side the animation sits on as you move down the scenes.
  // Split layouts only: the closing overview stacks vertically, so the same
  // CSS order would push its heading underneath the grid instead of swapping
  // columns.
  const visualFirst = scene.layout !== "full" && index % 2 === 1;

  // Copy block for a scene. Shared by the pinned stage and the stacked
  // fallback so the two can't drift apart.
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

  // Unpinned fallback: the same scenes stacked down the page.
  if (!driving) {
    return (
      <section
        ref={sectionRef}
        id="features"
        aria-label={t("previewEyebrow")}
        className="relative scroll-mt-20"
      >
        <div className="mx-auto w-full max-w-6xl pb-12 pt-4 sm:px-6 sm:py-12">
          {/* One scene per screen on phones, scrolled vertically like the rest
              of the page. A horizontal deck was tried first and read as the
              animations being laid out side by side, which is the opposite of
              the intent; the desktop stage moves through them on VERTICAL
              scroll, so mobile should too.

              min-height rather than scroll snapping: snapping the document
              needs scroll-snap-type on the scroll container itself, and an
              inner scroller that traps touch is worse than no snap at all on
              iOS. A full-height scene gets the one-at-a-time reading with
              nothing to fight.

              svh, not vh: on iOS vh is the tallest the viewport ever gets, so
              a 100vh scene is always slightly taller than the screen with the
              address bar showing, and the next scene's heading peeks in. */}
          <div className="flex flex-col sm:gap-20">
            {SCENES.map((s, i) => (
              <div
                key={s.id}
                className="flex min-h-[100svh] flex-col justify-center gap-4 px-6 sm:min-h-0 sm:gap-8 sm:px-0"
              >
                {sceneCopy(s, i, false)}
                {/* panel-swap is load-bearing, not decoration: every panel is
                    built from .cascade-item elements, which globals.css starts
                    at opacity 0 and only reveals through `.panel-swap
                    .cascade-item` or an `.in-view` ancestor. Without it the
                    panels render perfectly and are entirely invisible.

                    The overview is a responsive text grid and reads fine at
                    any width, so it renders at full size. The panels don't
                    reflow below their design width, so they get scaled. */}
                {s.layout === "full" || s.fluid ? (
                  <div className="panel-swap min-w-0">{s.render()}</div>
                ) : (
                  <FitWidth>
                    <div className="panel-swap">{s.render()}</div>
                  </FitWidth>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="features"
      aria-label={t("previewEyebrow")}
      className="relative scroll-mt-20"
      style={{ height: `${SEGMENT_WEIGHT * SEGMENT_SCROLL * 100 + 100}vh` }}
    >
      {/* Centred in the pinned viewport. Before the section pins, this box
          sits at the section's top, which the negative margin above has
          tucked under the hero, so the scene reads as being right below it.
          Once pinned, it is centred in the viewport. That travel is the
          "settles into the middle as you scroll" behaviour, and it comes from
          sticky itself rather than a per-frame offset. */}
      {/* paddingBottom matches the header height on purpose.
          The box starts below the sticky header and is that much shorter, so
          centring inside it put the scene half a header below the middle of
          what the reader actually sees - on a phone that read as a big gap
          above the scene and a small one under it. Padding the bottom by the
          same amount pulls the centre back onto the viewport's. */}
      <div
        className="sticky flex flex-col justify-center"
        style={{
          top: headerH,
          height: `calc(100vh - ${headerH}px)`,
          paddingBottom: headerH,
        }}
      >
        {/* Outer box carries the scaled height for layout; the stage inside
            keeps its natural size and is scaled by transform. Transforms don't
            affect layout, so the two can't feed back into each other. */}
        <div
          className="w-full"
          style={fitHeight !== null ? { height: fitHeight } : undefined}
        >
          <div
            ref={stageRef}
            dir="ltr"
            className={
              scene.layout === "full"
                ? "mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 text-center will-change-transform"
                : // Odd-numbered scenes put the visual first so the page
                  // alternates sides instead of pinning every animation to the
                  // right. The column ratio flips with it, so the copy column
                  // stays the narrower of the two either way.
                  // gap-10 stacked, not gap-6: the panels lead with a brand
                  // wordmark, which reads as a second heading, so at 24px it
                  // crowded the real one. Two columns need less, since the
                  // separation there is horizontal.
                  `mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 will-change-transform lg:gap-14 ${
                    visualFirst
                      ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
                      : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                  }`
            }
            style={{
              transformOrigin: "top center",
              // --settle is the per-frame seam nudge written by the scroll
              // handler; fit is the scale that keeps this scene on screen.
              transform: `scale(calc(${fit} * var(--settle, 1)))`,
            }}
          >
            {/* Scene transitions ride on the panel-swap keyframes keyed by
                scene id. Opacity is deliberately NOT bound to --seam: doing
                that left whichever scene sat at a segment boundary stranded
                at opacity 0, which is what made scenes vanish at the start
                and end of the scroll. */}
            {/* Sides are swapped with CSS order rather than by reordering the
                markup, so the copy still comes first in the DOM and screen
                readers and keyboard focus meet the heading before the
                decorative panel on every scene. */}
            <div
              key={scene.id}
              dir="auto"
              className={`panel-swap ${scene.layout === "full" ? "max-w-xl" : ""} ${
                visualFirst ? "lg:order-2" : "lg:order-1"
              }`}
            >
              {sceneCopy(scene, index, true)}
            </div>

            {/* Pinned LTR because the panels mock an extension UI that is
                laid out left to right. */}
            <div
              key={`${scene.id}-visual`}
              className={`panel-swap w-full min-w-0 ${visualFirst ? "lg:order-1" : "lg:order-2"}`}
            >
              {scene.render()}
            </div>
          </div>
        </div>

        {/* Route dots, scroll-world's side nav. Held in a real rail rather
            than floating loose against the page edge, which read as stray
            icons overlapping the scene.

            Desktop only. At phone width there is no margin beside the content
            for it to sit in, so it overlapped the animation itself — and the
            eyebrow already counts the scenes ("01 / 06"), which is the part
            worth keeping. */}
        <div className="pointer-events-none absolute inset-y-0 end-3 hidden items-center lg:flex xl:end-5">
          <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-full border border-black/[0.07] bg-white/80 p-1.5 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.3)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/70">
            {SCENES.map((s, i) => {
              const isActive = i === index;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSegment(i)}
                  title={tf(s.titleKey)}
                  className={
                    isActive
                      ? "flex size-6 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 transition dark:text-emerald-400"
                      : "flex size-6 items-center justify-center rounded-full text-zinc-400 transition hover:bg-black/[0.05] hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-white/[0.08] dark:hover:text-zinc-300"
                  }
                >
                  <Icon name={s.icon} className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Scroll hint, fades out once the visitor takes the cue. */}
        <div
          className={
            started
              ? "pointer-events-none absolute inset-x-0 bottom-6 flex justify-center opacity-0 transition-opacity duration-500"
              : "pointer-events-none absolute inset-x-0 bottom-6 flex justify-center opacity-100 transition-opacity duration-500"
          }
        >
          <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
            {t("previewScrollHint")}
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              className="hero-preview-arrow"
            >
              <path
                d="M7 3.5v6.5M4 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </section>
  );
}
