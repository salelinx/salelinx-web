import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { FeatureScene, type SceneId } from "@/components/features/FeatureScenes";

type Feature = {
  id: SceneId;
  only?: "depop" | "vinted";
  href: string;
};

// The 14 panel tabs, most wanted first: in-app usage, then reseller search interest.
const FEATURES: Feature[] = [
  { id: "crosslist", href: "/features/crosslist-depop-vinted" },
  { id: "relist", href: "/features/relist-depop-vinted" },
  { id: "refresh", only: "depop", href: "/features/depop-auto-refresh" },
  { id: "grow", href: "/features/depop-vinted-follow-bot" },
  { id: "listings", href: "/docs/inventory/listings" },
  { id: "restocker", href: "/docs/automate/restocker" },
  { id: "offers", href: "/features/auto-accept-offers" },
  { id: "autoOffers", only: "vinted", href: "/docs/automate/auto-offers" },
  { id: "labels", href: "/features/print-shipping-labels" },
  { id: "shopDesigner", only: "depop", href: "/docs/inventory/shop-designer" },
  { id: "priceDrops", href: "/features/automatic-price-drops" },
  { id: "messages", href: "/docs/buyers/messages" },
  { id: "linking", href: "/docs/automate/linking" },
  { id: "deadStock", href: "/docs/automate/dead-stock" },
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
              className={`rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] sm:p-10 ${sceneFirst ? "lg:order-1" : ""}`}
            >
              <FeatureScene id={f.id} />
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
