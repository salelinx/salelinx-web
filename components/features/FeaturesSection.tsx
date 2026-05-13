import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";

type Marketplace = "depop" | "vinted" | "both";

type FeatureItem = {
  id: string;
  icon: IconName;
  on: Marketplace;
  href: string;
};

type ChapterId = "listings" | "crosslisting" | "visibility" | "sales";

type Chapter = {
  id: ChapterId;
  items: FeatureItem[];
};

const CHAPTERS: Chapter[] = [
  {
    id: "listings",
    items: [
      {
        id: "dashboard",
        icon: "grid",
        on: "both",
        href: "/docs/listings/manage-inventory",
      },
      {
        id: "linkAccounts",
        icon: "link",
        on: "both",
        href: "/docs/getting-started/connect-your-first-marketplace",
      },
      {
        id: "backup",
        icon: "lock",
        on: "both",
        href: "/docs/listings/manage-inventory",
      },
      {
        id: "sync",
        icon: "sync",
        on: "both",
        href: "/docs/listings/manage-inventory",
      },
      {
        id: "multilanguage",
        icon: "globe",
        on: "both",
        href: "/docs/listings/manage-inventory",
      },
    ],
  },
  {
    id: "crosslisting",
    items: [
      {
        id: "bidirectional",
        icon: "swap",
        on: "both",
        href: "/docs/crosslisting/crosslist-your-first-item",
      },
      {
        id: "autoMap",
        icon: "tree",
        on: "both",
        href: "/docs/crosslisting/crosslist-your-first-item",
      },
      {
        id: "csvImport",
        icon: "upload",
        on: "both",
        href: "/docs/crosslisting/csv-import",
      },
      {
        id: "shopDesigner",
        icon: "layout",
        on: "depop",
        href: "/docs/crosslisting/shop-designer",
      },
    ],
  },
  {
    id: "visibility",
    items: [
      { id: "refresher", icon: "refresh", on: "depop", href: "/docs/listings" },
      { id: "scheduler", icon: "clock", on: "depop", href: "/docs/listings" },
      { id: "followBot", icon: "users", on: "both", href: "/docs" },
      { id: "filters", icon: "filter", on: "both", href: "/docs" },
      {
        id: "deadStock",
        icon: "search",
        on: "both",
        href: "/docs/listings/manage-inventory",
      },
      {
        id: "autoMarkdown",
        icon: "sparkle",
        on: "both",
        href: "/docs/visibility/auto-price-drops",
      },
      { id: "activityLog", icon: "list", on: "both", href: "/docs" },
    ],
  },
  {
    id: "sales",
    items: [
      { id: "offersInbox", icon: "tag", on: "both", href: "/docs/sales" },
      {
        id: "autoOffers",
        icon: "zap",
        on: "both",
        href: "/docs/sales/auto-offers",
      },
      { id: "messages", icon: "message", on: "both", href: "/docs/sales" },
      {
        id: "shipping",
        icon: "box",
        on: "both",
        href: "/docs/sales/shipping-labels",
      },
      {
        id: "relister",
        icon: "rotate",
        on: "both",
        href: "/docs/sales/relister",
      },
      {
        id: "restocker",
        icon: "wave",
        on: "both",
        href: "/docs/sales/restocker",
      },
    ],
  },
];

// Per-chapter accent. Used on the giant chapter number, the icon halo on
// hover, and a thin gradient bar at the top of each chapter card. Light +
// dark variants tuned to read against the page background without dominating.
const CHAPTER_ACCENT: Record<
  ChapterId,
  {
    text: string;
    bar: string;
    iconHover: string;
    glow: string;
  }
> = {
  listings: {
    text: "text-amber-500 dark:text-amber-400",
    bar: "from-amber-400/70 via-amber-500/40 to-transparent",
    iconHover: "group-hover:text-amber-500 dark:group-hover:text-amber-400",
    glow: "bg-amber-500/10 dark:bg-amber-400/10",
  },
  crosslisting: {
    text: "text-violet-500 dark:text-violet-400",
    bar: "from-violet-400/70 via-violet-500/40 to-transparent",
    iconHover: "group-hover:text-violet-500 dark:group-hover:text-violet-400",
    glow: "bg-violet-500/10 dark:bg-violet-400/10",
  },
  visibility: {
    text: "text-emerald-500 dark:text-emerald-400",
    bar: "from-emerald-400/70 via-emerald-500/40 to-transparent",
    iconHover: "group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
    glow: "bg-emerald-500/10 dark:bg-emerald-400/10",
  },
  sales: {
    text: "text-sky-500 dark:text-sky-400",
    bar: "from-sky-400/70 via-sky-500/40 to-transparent",
    iconHover: "group-hover:text-sky-500 dark:group-hover:text-sky-400",
    glow: "bg-sky-500/10 dark:bg-sky-400/10",
  },
};

const MONO = "font-mono text-[0.68rem] uppercase tracking-[0.12em]";

function MarketplaceBadge({ on, label }: { on: Marketplace; label: string }) {
  if (on === "both") return null;
  return (
    <span
      className={`${MONO} ml-2 inline-block shrink-0 rounded border border-black/10 px-1.5 py-0.5 text-zinc-600 dark:border-white/15 dark:text-zinc-400`}
    >
      {label}
    </span>
  );
}

export async function FeaturesSection() {
  const t = await getTranslations("Features");

  return (
    <section id="features" className="scroll-mt-20 pt-16 pb-8">
      <Reveal as="div" className="pb-10">
        <span className={`${MONO} text-zinc-500`}>
          {t("sectionHeader.eyebrow")}
        </span>
        <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {t("sectionHeader.title")}
        </h2>
      </Reveal>

      {CHAPTERS.map((chapter, chapterIdx) => {
        const accent = CHAPTER_ACCENT[chapter.id];
        return (
          <Reveal
            key={chapter.id}
            as="article"
            className={`relative grid grid-cols-1 gap-10 border-t border-black/10 py-20 md:grid-cols-12 md:gap-12 dark:border-white/10 ${
              chapterIdx === 0 ? "pt-14" : ""
            }`}
          >
            {/* Accent bar runs along the top, fades into the page. Anchors
                each chapter visually without imagery. */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent.bar}`}
              aria-hidden
            />

            <header className="md:col-span-5 md:sticky md:top-24 md:self-start">
              {/* Giant chapter number anchors the gutter, accent-coloured so
                  chapters are scan-able at a glance. */}
              <span
                className={`block font-mono text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl ${accent.text}`}
                aria-hidden
              >
                {t(`chapter.${chapter.id}.number`)}
              </span>
              <h3 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t(`chapter.${chapter.id}.title`)}
              </h3>
              <p className="mt-5 max-w-md text-base text-zinc-600 dark:text-zinc-400">
                {t(`chapter.${chapter.id}.blurb`)}
              </p>
            </header>

            <ul className="cascade-list md:col-span-6 md:col-start-7 md:space-y-2">
              {chapter.items.map((item, itemIdx) => (
                <li
                  key={item.id}
                  className="cascade-item"
                  style={
                    {
                      "--stagger-delay": `${Math.min(itemIdx * 70, 420)}ms`,
                    } as CSSProperties
                  }
                >
                  <Link
                    href={item.href}
                    className="group flex gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-black/[0.06] hover:bg-black/[0.02] dark:hover:border-white/[0.08] dark:hover:bg-white/[0.03]"
                  >
                    <span
                      className={`relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition-colors dark:text-zinc-300 ${accent.iconHover}`}
                    >
                      <span
                        className={`absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100 ${accent.glow}`}
                        aria-hidden
                      />
                      <Icon name={item.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline">
                        <span className="font-medium underline-offset-4 group-hover:underline">
                          {t(`chapter.${chapter.id}.items.${item.id}.label`)}
                        </span>
                        <MarketplaceBadge
                          on={item.on}
                          label={t("marketplaceOnly", { marketplace: item.on })}
                        />
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {t(`chapter.${chapter.id}.items.${item.id}.detail`)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        );
      })}
    </section>
  );
}
