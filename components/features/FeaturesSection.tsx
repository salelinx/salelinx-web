import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";

type Accent = "violet" | "emerald" | "fuchsia" | "amber" | "rose" | "sky";

type Feature = {
  id: string;
  icon: IconName;
  accent: Accent;
  only?: "depop" | "vinted";
  href: string;
};

// Full class strings so Tailwind can see them.
const ACCENT: Record<Accent, { tile: string; glow: string; border: string }> = {
  violet: {
    tile: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    glow: "bg-violet-400/20",
    border: "hover:border-violet-300 dark:hover:border-violet-500/40",
  },
  emerald: {
    tile: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    glow: "bg-emerald-400/20",
    border: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
  },
  fuchsia: {
    tile: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    glow: "bg-fuchsia-400/20",
    border: "hover:border-fuchsia-300 dark:hover:border-fuchsia-500/40",
  },
  amber: {
    tile: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    glow: "bg-amber-400/25",
    border: "hover:border-amber-300 dark:hover:border-amber-500/40",
  },
  rose: {
    tile: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    glow: "bg-rose-400/20",
    border: "hover:border-rose-300 dark:hover:border-rose-500/40",
  },
  sky: {
    tile: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
    glow: "bg-sky-400/20",
    border: "hover:border-sky-300 dark:hover:border-sky-500/40",
  },
};

const ONLY_PILL = {
  depop: "bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
  vinted: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30",
};

const FEATURES: Feature[] = [
  { id: "crosslist", icon: "crosslist-arrows", accent: "violet", href: "/features/crosslist-depop-vinted" },
  { id: "relist", icon: "relist", accent: "emerald", href: "/features/relist-depop-vinted" },
  { id: "refresh", icon: "refresh", accent: "emerald", only: "depop", href: "/features/depop-auto-refresh" },
  { id: "restocker", icon: "cube", accent: "fuchsia", href: "/docs/automate/restocker" },
  { id: "linking", icon: "link", accent: "violet", href: "/docs/automate/linking" },
  { id: "messages", icon: "chat-bubble", accent: "amber", href: "/docs/buyers/messages" },
  { id: "offers", icon: "tag", accent: "amber", href: "/docs/buyers/offers" },
  { id: "autoAccept", icon: "zap", accent: "amber", href: "/features/auto-accept-offers" },
  { id: "offerLikers", icon: "wave", accent: "amber", only: "vinted", href: "/docs/automate/auto-offers" },
  { id: "priceDrops", icon: "sparkle", accent: "rose", href: "/features/automatic-price-drops" },
  { id: "deadStock", icon: "filter", accent: "rose", href: "/docs/automate/dead-stock" },
  { id: "followBot", icon: "users", accent: "emerald", href: "/features/depop-vinted-follow-bot" },
  { id: "labels", icon: "truck", accent: "rose", href: "/features/print-shipping-labels" },
  { id: "feedbackBot", icon: "message", accent: "amber", only: "vinted", href: "/docs/buyers/labels" },
  { id: "listings", icon: "grid", accent: "fuchsia", href: "/docs/inventory/listings" },
  { id: "bulkEdit", icon: "hammer", accent: "fuchsia", href: "/docs/inventory/listings" },
  { id: "shopDesigner", icon: "layout", accent: "emerald", only: "depop", href: "/docs/inventory/shop-designer" },
  { id: "csvImport", icon: "upload", accent: "violet", href: "/docs/inventory/csv-import" },
  { id: "activityLog", icon: "list", accent: "sky", href: "/docs/inventory/listings" },
  { id: "backup", icon: "cloud", accent: "sky", href: "/docs/inventory/cloud-sync" },
  { id: "sync", icon: "sync", accent: "sky", href: "/docs/inventory/cloud-sync" },
  {
    id: "accounts",
    icon: "lock",
    accent: "sky",
    href: "/docs/getting-started/connect-your-first-marketplace",
  },
  { id: "languages", icon: "globe", accent: "sky", href: "/docs/inventory/listings" },
];

export async function FeaturesSection() {
  const t = await getTranslations("Features");

  return (
    <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-4 py-20 md:grid-cols-2">
      {FEATURES.map((f, i) => {
        const accent = ACCENT[f.accent];
        return (
          <Reveal as="li" pop delay={(i % 2) * 80} key={f.id}>
            <Link
              href={f.href}
              className={`group relative flex h-full gap-4 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.06] dark:border-white/[0.08] dark:bg-zinc-950 ${accent.border}`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-150 ${accent.glow}`}
              />
              <span
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${accent.tile}`}
              >
                <Icon name={f.icon} />
              </span>
              <div className="relative min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                  {t(`list.${f.id}.name`)}
                  {f.only && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ONLY_PILL[f.only]}`}
                    >
                      {t(`only.${f.only}`)}
                    </span>
                  )}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(`list.${f.id}.detail`)}
                </p>
              </div>
            </Link>
          </Reveal>
        );
      })}
    </ul>
  );
}
