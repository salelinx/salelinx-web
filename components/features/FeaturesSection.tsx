import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";
import {
  ConversationsPanel,
  CrosslistPanel,
  FollowBotPanel,
  OffersPanel,
} from "@/components/home/HeroPreview";
import { RestockerScene } from "@/components/home/RestockerScene";
import { SceneFrame } from "@/components/home/ScrollWorldDemo";

type Feature = {
  id: string;
  icon: IconName;
  only?: "depop" | "vinted";
  href: string;
};

type Section = {
  id: "crosslisting" | "visibility" | "sales" | "stock";
  panel: ReactNode;
  features: Feature[];
};

const SECTIONS: Section[] = [
  {
    id: "crosslisting",
    panel: <CrosslistPanel />,
    features: [
      { id: "crosslist", icon: "crosslist-arrows", href: "/features/crosslist-depop-vinted" },
      { id: "linking", icon: "link", href: "/docs/automate/linking" },
      { id: "csvImport", icon: "upload", href: "/docs/inventory/csv-import" },
    ],
  },
  {
    id: "visibility",
    panel: <FollowBotPanel />,
    features: [
      { id: "relist", icon: "relist", href: "/features/relist-depop-vinted" },
      { id: "refresh", icon: "refresh", only: "depop", href: "/features/depop-auto-refresh" },
      { id: "followBot", icon: "users", href: "/features/depop-vinted-follow-bot" },
      { id: "priceDrops", icon: "sparkle", href: "/features/automatic-price-drops" },
      { id: "deadStock", icon: "filter", href: "/docs/automate/dead-stock" },
      { id: "shopDesigner", icon: "layout", only: "depop", href: "/docs/inventory/shop-designer" },
    ],
  },
  {
    id: "sales",
    panel: (
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
        <OffersPanel />
        <ConversationsPanel />
      </div>
    ),
    features: [
      { id: "messages", icon: "chat-bubble", href: "/docs/buyers/messages" },
      { id: "offers", icon: "tag", href: "/docs/buyers/offers" },
      { id: "autoAccept", icon: "zap", href: "/features/auto-accept-offers" },
      { id: "offerLikers", icon: "wave", only: "vinted", href: "/docs/automate/auto-offers" },
      { id: "labels", icon: "truck", href: "/features/print-shipping-labels" },
      { id: "feedbackBot", icon: "message", only: "vinted", href: "/docs/buyers/labels" },
    ],
  },
  {
    id: "stock",
    panel: <RestockerScene />,
    features: [
      { id: "restocker", icon: "cube", href: "/docs/automate/restocker" },
      { id: "listings", icon: "grid", href: "/docs/inventory/listings" },
      { id: "bulkEdit", icon: "hammer", href: "/docs/inventory/listings" },
      { id: "activityLog", icon: "list", href: "/docs/inventory/listings" },
      { id: "backup", icon: "cloud", href: "/docs/inventory/cloud-sync" },
      { id: "sync", icon: "sync", href: "/docs/inventory/cloud-sync" },
      {
        id: "accounts",
        icon: "lock",
        href: "/docs/getting-started/connect-your-first-marketplace",
      },
      { id: "languages", icon: "globe", href: "/docs/inventory/listings" },
    ],
  },
];

const MONO = "font-mono text-[0.68rem] uppercase tracking-[0.12em]";

export async function FeaturesSection() {
  const t = await getTranslations("Features");

  return (
    <div className="mx-auto max-w-6xl divide-y divide-black/[0.08] dark:divide-white/10">
      {SECTIONS.map((section, i) => {
        const panelFirst = i % 2 === 1;
        return (
          <section key={section.id} className="py-20 sm:py-28">
            {/* panel, not the default reveal: the mock panels are built from
                .cascade-item elements that only show under .panel-swap. */}
            <Reveal
              panel
              dir="ltr"
              className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div dir="auto" className={panelFirst ? "lg:order-2" : ""}>
                <span className={`${MONO} text-zinc-500 dark:text-zinc-400`}>
                  {String(i + 1).padStart(2, "0")} / {String(SECTIONS.length).padStart(2, "0")}
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  {t(`sections.${section.id}.title`)}
                </h2>
                <p className="mt-4 max-w-md text-base text-zinc-600 dark:text-zinc-400">
                  {t(`sections.${section.id}.blurb`)}
                </p>
              </div>
              <div className={`min-w-0 ${panelFirst ? "lg:order-1" : ""}`}>
                <SceneFrame>{section.panel}</SceneFrame>
              </div>
            </Reveal>

            <ul className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
              {section.features.map((f, j) => (
                <Reveal as="li" pop delay={(j % 2) * 80} key={f.id}>
                  <Link
                    href={f.href}
                    className="group flex h-full gap-4 rounded-2xl border border-black/[0.08] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-lg hover:shadow-black/[0.06] dark:border-white/[0.08] dark:bg-zinc-950 dark:hover:border-white/20"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 transition duration-200 group-hover:scale-110 group-hover:bg-black group-hover:text-white dark:bg-white/[0.06] dark:text-zinc-100 dark:group-hover:bg-white dark:group-hover:text-black">
                      <Icon name={f.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                        {t(`list.${f.id}.name`)}
                        {f.only && (
                          <span className="rounded-full border border-black/15 px-2 py-0.5 font-mono text-[0.65rem] font-normal uppercase tracking-[0.12em] text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                            {t(`only.${f.only}`)}
                          </span>
                        )}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {t(`list.${f.id}.detail`)}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
