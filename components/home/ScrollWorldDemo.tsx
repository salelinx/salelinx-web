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
  bodyKey: string;
  /** A few words for phones, where the full `bodyKey` sentence is longer than
   *  the animation it introduces. Falls back to bodyKey when absent. */
  shortKey?: string;
  /** 'split' is the default copy-beside-visual scene. 'full' centres the copy
   *  above a full-width visual, for the closing overview. */
  layout?: "split" | "full";
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
  // A single moving line rather than the ruled grid: sixteen names read as a
  // list you have to work through, where a ticker reads as "and there is more
  // where that came from" without asking for attention.
  //
  // The row is rendered twice. The animation shifts by exactly -50%, so the
  // second copy is under the cursor at the moment the first runs out and the
  // loop has no seam. The duplicate is aria-hidden: to a screen reader this is
  // one list of sixteen, read once.
  return (
    <div className="feature-ticker-viewport relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="feature-ticker flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0">
            {ALL_FEATURES.map((f) => (
              <div
                key={f.key}
                className="flex w-[124px] shrink-0 flex-col items-center gap-2.5 px-2 text-center lg:w-[144px]"
              >
                <Icon
                  name={f.icon}
                  className="h-5 w-5 flex-shrink-0 text-zinc-400 dark:text-zinc-500"
                />
                <span className="text-[12.5px] leading-snug text-zinc-700 lg:text-[13.5px] dark:text-zinc-300">
                  {tf(`${f.key}.name`)}
                </span>
              </div>
            ))}
          </div>
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
      <h3 className="mt-3 text-balance text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900 sm:text-3xl lg:text-4xl dark:text-zinc-50">
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
        <div className="flex flex-col divide-y divide-black/[0.08] dark:divide-white/10">
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
                    ? "flex flex-col items-center justify-center gap-6 px-6 py-14 text-center sm:px-0 sm:py-24"
                    : `grid grid-cols-1 content-center items-center gap-7 px-6 py-14 sm:gap-8 sm:px-0 sm:py-24 lg:gap-14 ${
                        visualFirst
                          ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
                          : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                      }`
                }
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
                  {full ? s.render() : <SceneFrame>{s.render()}</SceneFrame>}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
