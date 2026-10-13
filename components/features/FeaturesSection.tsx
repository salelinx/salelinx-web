import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { FeatureScene, type SceneId } from "@/components/features/FeatureScenes";

type Feature = {
  id: SceneId;
  only?: "depop" | "vinted";
  href: string;
};

// The panel's own tabs, in sidebar order.
const FEATURES: Feature[] = [
  { id: "listings", href: "/docs/inventory/listings" },
  { id: "grow", href: "/features/depop-vinted-follow-bot" },
  { id: "relist", href: "/features/relist-depop-vinted" },
  { id: "refresh", only: "depop", href: "/features/depop-auto-refresh" },
  { id: "crosslist", href: "/features/crosslist-depop-vinted" },
  { id: "shopDesigner", only: "depop", href: "/docs/inventory/shop-designer" },
  { id: "deadStock", href: "/docs/automate/dead-stock" },
  { id: "autoOffers", only: "vinted", href: "/docs/automate/auto-offers" },
  { id: "linking", href: "/docs/automate/linking" },
  { id: "restocker", href: "/docs/automate/restocker" },
  { id: "priceDrops", href: "/features/automatic-price-drops" },
  { id: "offers", href: "/features/auto-accept-offers" },
  { id: "messages", href: "/docs/buyers/messages" },
  { id: "labels", href: "/features/print-shipping-labels" },
];

const MONO = "font-mono text-[0.68rem] uppercase tracking-[0.12em]";

export async function FeaturesSection() {
  const t = await getTranslations("Features");

  return (
    <div className="mx-auto max-w-6xl divide-y divide-black/[0.08] py-10 dark:divide-white/10">
      {FEATURES.map((f, i) => {
        const sceneFirst = i % 2 === 1;
        return (
          <Reveal
            key={f.id}
            as="section"
            className="grid grid-cols-1 items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-20"
          >
            <div className={sceneFirst ? "lg:order-2" : ""}>
              <div className="flex items-center gap-3">
                <span className={`${MONO} text-zinc-500 dark:text-zinc-400`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {f.only && (
                  <span className={`${MONO} rounded-full border border-black/15 px-2 py-0.5 text-zinc-600 dark:border-white/20 dark:text-zinc-400`}>
                    {t(`only.${f.only}`)}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t(`list.${f.id}.name`)}
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`list.${f.id}.detail`)}
              </p>
              <Link
                href={f.href}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
              >
                {t("learnMore")}
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div
              className={`rounded-3xl border border-black/[0.08] bg-zinc-50 p-6 sm:p-10 dark:border-white/10 dark:bg-zinc-100 ${sceneFirst ? "lg:order-1" : ""}`}
            >
              <FeatureScene id={f.id} />
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
