import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { BrandWordmark } from "@/components/BrandWordmark";

type Feature = {
  id: string;
  icon: IconName;
  only?: "depop" | "vinted";
  href: string;
};

const FEATURES: Feature[] = [
  { id: "crosslist", icon: "crosslist-arrows", href: "/features/crosslist-depop-vinted" },
  { id: "relist", icon: "relist", href: "/features/relist-depop-vinted" },
  { id: "refresh", icon: "refresh", only: "depop", href: "/features/depop-auto-refresh" },
  { id: "restocker", icon: "cube", href: "/docs/automate/restocker" },
  { id: "linking", icon: "link", href: "/docs/automate/linking" },
  { id: "messages", icon: "chat-bubble", href: "/docs/buyers/messages" },
  { id: "offers", icon: "tag", href: "/docs/buyers/offers" },
  { id: "autoAccept", icon: "zap", href: "/features/auto-accept-offers" },
  { id: "offerLikers", icon: "wave", only: "vinted", href: "/docs/automate/auto-offers" },
  { id: "priceDrops", icon: "sparkle", href: "/features/automatic-price-drops" },
  { id: "deadStock", icon: "filter", href: "/docs/automate/dead-stock" },
  { id: "followBot", icon: "users", href: "/features/depop-vinted-follow-bot" },
  { id: "labels", icon: "truck", href: "/features/print-shipping-labels" },
  { id: "feedbackBot", icon: "message", only: "vinted", href: "/docs/buyers/labels" },
  { id: "listings", icon: "grid", href: "/docs/inventory/listings" },
  { id: "bulkEdit", icon: "hammer", href: "/docs/inventory/listings" },
  { id: "shopDesigner", icon: "layout", only: "depop", href: "/docs/inventory/shop-designer" },
  { id: "csvImport", icon: "upload", href: "/docs/inventory/csv-import" },
  { id: "activityLog", icon: "list", href: "/docs/inventory/listings" },
  { id: "backup", icon: "cloud", href: "/docs/inventory/cloud-sync" },
  { id: "sync", icon: "sync", href: "/docs/inventory/cloud-sync" },
  {
    id: "accounts",
    icon: "lock",
    href: "/docs/getting-started/connect-your-first-marketplace",
  },
  { id: "languages", icon: "globe", href: "/docs/inventory/listings" },
];

export async function FeaturesSection() {
  const t = await getTranslations("Features");

  return (
    <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-4 py-20 md:grid-cols-2">
      {FEATURES.map((f) => (
        <li key={f.id}>
          <Link
            href={f.href}
            className="group flex h-full gap-4 rounded-2xl border border-black/[0.08] p-6 transition-colors hover:border-black/20 hover:bg-black/[0.02] dark:border-white/[0.08] dark:hover:border-white/20 dark:hover:bg-white/[0.03]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
              <Icon name={f.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
                {t(`list.${f.id}.name`)}
                {f.only && (
                  <span className="inline-flex items-center gap-1 rounded border border-black/10 px-1.5 py-0.5 font-mono text-[0.65rem] font-normal uppercase tracking-[0.12em] text-zinc-600 dark:border-white/15 dark:text-zinc-400">
                    {t.rich("marketplaceOnly", {
                      marketplace: () => <BrandWordmark brand={f.only!} height="0.85em" />,
                    })}
                  </span>
                )}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`list.${f.id}.detail`)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
