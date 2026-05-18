import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SubscribeButton } from "@/components/SubscribeButton";
import { Icon, type IconName } from "@/components/Icon";
import type { TierConfig, TierId } from "@/lib/types/tiers";

const MONO = "font-mono text-[0.68rem] uppercase tracking-[0.12em]";

const TRIAL_DAYS = 7;
const PAID_TIER_ORDER: TierId[] = ["starter", "pro", "business"];

const PRICE_IDS: Partial<Record<TierId, string | undefined>> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  business: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS,
};

const TIER_META: Record<
  Exclude<TierId, "free">,
  { name: string; price: string; highlight?: boolean }
> = {
  starter: { name: "Starter", price: "£7.99" },
  pro: { name: "Pro", price: "£14.99", highlight: true },
  business: { name: "Business", price: "£24.99" },
};

const FEATURE_ICONS: Record<string, IconName> = {
  auto_refresh: "clock",
  cloud_sync: "lock",
  shop_designer: "layout",
  dead_stock: "search",
  restocker: "rotate",
  auto_offer: "zap",
  shipping_labels: "box",
  messages: "message",
  offers: "tag",
  auto_markdown: "sparkle",
  account_linking: "link",
};

const LIMIT_ORDER = [
  "crosslists_per_month",
  "relists_per_month",
  "refreshes_per_day",
  "follows_per_day",
  "unfollows_per_day",
  "cloud_storage_bytes",
  "support_response_days",
  "support_response_hours",
] as const;

const FEATURE_ORDER = [
  "messages",
  "offers",
  "dead_stock",
  "shop_designer",
  "auto_offer",
  "auto_refresh",
  "account_linking",
  "shipping_labels",
  "restocker",
  "auto_markdown",
] as const;

type LimitKey = (typeof LIMIT_ORDER)[number];

function makeFormatLimit(
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return (key: LimitKey, value: number | null): string => {
    if (value === null) return t("unlimited");
    if (key === "cloud_storage_bytes") {
      // Sub-1 GB shows as whole MB so a 500 MB cap reads "500 MB" instead
      // of "0.488 GB". 1 GB and up drops to whole GB unless there's a
      // fractional part, in which case one decimal is shown ("1.5 GB").
      const GB = 1024 ** 3;
      const MB = 1024 ** 2;
      if (value < GB) {
        const mb = Math.round(value / MB);
        return t("storageMb", { value: mb });
      }
      const gb = value / GB;
      const display = Number.isInteger(gb) ? gb : Number(gb.toFixed(1));
      return t("storageGb", { value: display });
    }
    if (key === "support_response_hours") return t("supportHours", { value });
    if (key === "support_response_days") return t("supportDays", { value });
    return value.toLocaleString();
  };
}

function FeatureList({
  tier,
  formatLimit,
  t,
}: {
  tier: TierConfig;
  formatLimit: (key: LimitKey, value: number | null) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <ul className="mt-6 space-y-2 text-sm">
      {LIMIT_ORDER.filter(
        (k) => k !== "cloud_storage_bytes" && tier.limits[k] !== undefined,
      ).map((key) => (
        <li key={key} className="flex justify-between gap-2">
          <span className="text-zinc-600 dark:text-zinc-400">
            {t(`limit.${key}`)}
          </span>
          <span className="font-medium">
            {formatLimit(key, tier.limits[key])}
          </span>
        </li>
      ))}

      {(() => {
        const storage = tier.limits.cloud_storage_bytes;
        const included =
          storage !== undefined && (storage === null || storage > 0);
        return (
          <li
            className={`flex items-center gap-2 ${
              included ? "" : "text-zinc-400 dark:text-zinc-600"
            }`}
          >
            <Icon name="cloud" className="h-4 w-4 shrink-0" />
            <span
              className={`flex-1 ${included ? "" : "line-through decoration-zinc-300 dark:decoration-zinc-700"}`}
            >
              {t("cloudStorage")}
            </span>
            {included && storage !== undefined && (
              <span className="font-medium">
                {formatLimit("cloud_storage_bytes", storage)}
              </span>
            )}
          </li>
        );
      })()}

      {FEATURE_ORDER.map((key) => {
        const included = Boolean(tier.features[key]);
        return (
          <li
            key={key}
            className={`flex items-center gap-2 ${
              included ? "" : "text-zinc-400 dark:text-zinc-600"
            }`}
          >
            <Icon name={FEATURE_ICONS[key]} className="h-4 w-4 shrink-0" />
            <span
              className={
                included
                  ? ""
                  : "line-through decoration-zinc-300 dark:decoration-zinc-700"
              }
            >
              {t(`feature.${key}`)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export async function PricingSection({ tiers }: { tiers: TierConfig[] }) {
  const t = await getTranslations("Pricing");
  const formatLimit = makeFormatLimit(t);

  const paidTiers = PAID_TIER_ORDER.map((id) =>
    tiers.find((tier) => tier.tier_id === id),
  ).filter((tier): tier is NonNullable<typeof tier> => Boolean(tier));

  const starterTier = paidTiers.find((tier) => tier.tier_id === "starter");
  const starterPriceId = PRICE_IDS.starter;

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-black/10 py-20 dark:border-white/10"
    >
      <div className="pb-12">
        <span className={`${MONO} text-zinc-500`}>
          {t("sectionHeader.eyebrow")}
        </span>
        <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {t("sectionHeader.title")}
        </h2>
        <p className="mt-5 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          {t("sectionHeader.body")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {starterTier && (
          <div className="rounded-2xl border border-black/10 p-6 dark:border-white/10">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-semibold">{t("trial.name")}</h3>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{t("trial.tagline")}</p>

            <p className="mt-6 text-4xl font-bold">
              £0
              <span className="text-base font-normal text-zinc-500">
                {" "}
                {t("trial.priceSuffix", { days: TRIAL_DAYS })}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t("trial.thenPrice", { price: TIER_META.starter.price })}
            </p>

            {starterPriceId ? (
              <SubscribeButton
                priceId={starterPriceId}
                trialDays={TRIAL_DAYS}
                label={t("trial.cta")}
              />
            ) : (
              <Link
                href="/auth/signup"
                className="mt-6 block w-full rounded-full border border-black/10 py-2.5 text-center text-sm font-medium dark:border-white/20"
              >
                {t("trial.cta")}
              </Link>
            )}

            <FeatureList tier={starterTier} formatLimit={formatLimit} t={t} />
          </div>
        )}

        {paidTiers.map((tier) => {
          const meta = TIER_META[tier.tier_id as Exclude<TierId, "free">];
          return (
            <div
              key={tier.tier_id}
              className={`rounded-2xl border p-6 ${
                meta.highlight
                  ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold">{meta.name}</h3>
                {meta.highlight && (
                  <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white dark:bg-white dark:text-black">
                    {t("popular")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {t(`tier.${tier.tier_id}.tagline`)}
              </p>

              <p className="mt-6 text-4xl font-bold">
                {meta.price}
                <span className="text-base font-normal text-zinc-500">
                  {t("perMonth")}
                </span>
              </p>

              {PRICE_IDS[tier.tier_id] ? (
                <SubscribeButton
                  priceId={PRICE_IDS[tier.tier_id]!}
                  highlight={meta.highlight}
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-6 w-full rounded-full border border-black/10 py-2.5 text-sm font-medium opacity-60 dark:border-white/20"
                >
                  {t("comingSoon")}
                </button>
              )}

              <FeatureList tier={tier} formatLimit={formatLimit} t={t} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
