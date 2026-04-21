import Link from "next/link";
import { SubscribeButton } from "@/components/SubscribeButton";
import { Icon, type IconName } from "@/components/Icon";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import type { TierId } from "@/lib/types/tiers";

export const revalidate = 60;

const TIER_ORDER: TierId[] = ["free", "starter", "pro", "business"];

const PRICE_IDS: Partial<Record<TierId, string | undefined>> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  business: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS,
};

const TIER_META: Record<
  TierId,
  { name: string; price: string; tagline: string; highlight?: boolean }
> = {
  free: { name: "Free", price: "£0", tagline: "Try before you buy" },
  starter: { name: "Starter", price: "£7.99", tagline: "Hobbyists" },
  pro: {
    name: "Pro",
    price: "£14.99",
    tagline: "Active resellers",
    highlight: true,
  },
  business: {
    name: "Business",
    price: "£29.99",
    tagline: "Power sellers & multi-shop",
  },
};

const LIMIT_LABELS: Record<string, string> = {
  crosslists_per_month: "Crosslists / month",
  relists_per_month: "Relists / month",
  refreshes_per_day: "Refreshes / day",
  follows_per_day: "Follows / day",
  unfollows_per_day: "Unfollows / day",
  cloud_storage_bytes: "Cloud storage",
  linked_shops: "Linked shops",
  support_response_days: "Support response",
  support_response_hours: "Support response",
};

const FEATURE_LABELS: Record<string, string> = {
  auto_refresh: "Auto-refresh",
  cloud_sync: "Cloud sync",
  shop_designer: "Shop designer",
  dead_stock: "Dead stock analytics",
  restocker: "Restocker",
  auto_offer: "Auto-offers",
  shipping_labels: "Shipping labels",
  messages: "Messages",
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
};

const LIMIT_ORDER = [
  "crosslists_per_month",
  "relists_per_month",
  "refreshes_per_day",
  "follows_per_day",
  "unfollows_per_day",
  "linked_shops",
  "cloud_storage_bytes",
];

const FEATURE_ORDER = [
  "messages",
  "shipping_labels",
  "auto_offer",
  "auto_refresh",
  "restocker",
  "dead_stock",
  "shop_designer",
];

function formatLimit(key: string, value: number | null): string {
  if (value === null) return "Unlimited";
  if (key === "cloud_storage_bytes") {
    const gb = value / 1024 ** 3;
    return `${gb} GB`;
  }
  if (key === "support_response_hours") return `${value}h`;
  if (key === "support_response_days") return `${value} days`;
  return value.toLocaleString();
}

export default async function PricingPage() {
  const tiers = await getTierConfigs();
  const ordered = TIER_ORDER.map((id) =>
    tiers.find((t) => t.tier_id === id),
  ).filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Pricing
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Pick a plan. Switch any time. Cancel any time.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {ordered.map((tier) => {
          const meta = TIER_META[tier.tier_id];
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
                <h2 className="text-xl font-semibold">{meta.name}</h2>
                {meta.highlight && (
                  <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white dark:bg-white dark:text-black">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">{meta.tagline}</p>

              <p className="mt-6 text-4xl font-bold">
                {meta.price}
                <span className="text-base font-normal text-zinc-500">
                  {tier.tier_id === "free" ? "" : "/mo"}
                </span>
              </p>

              {tier.tier_id === "free" ? (
                <Link
                  href="/auth/signup"
                  className={`mt-6 block w-full rounded-full py-2.5 text-center text-sm font-medium ${
                    meta.highlight
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "border border-black/10 dark:border-white/20"
                  }`}
                >
                  Install extension
                </Link>
              ) : PRICE_IDS[tier.tier_id] ? (
                <SubscribeButton
                  priceId={PRICE_IDS[tier.tier_id]!}
                  label="Subscribe"
                  highlight={meta.highlight}
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-6 w-full rounded-full border border-black/10 py-2.5 text-sm font-medium opacity-60 dark:border-white/20"
                >
                  Coming soon
                </button>
              )}

              <ul className="mt-6 space-y-2 text-sm">
                {LIMIT_ORDER.filter(
                  (k) =>
                    k !== "cloud_storage_bytes" &&
                    tier.limits[k] !== undefined,
                ).map((key) => (
                  <li key={key} className="flex justify-between gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {LIMIT_LABELS[key] ?? key}
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
                        Cloud storage
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
                      <Icon
                        name={FEATURE_ICONS[key]}
                        className="h-4 w-4 shrink-0"
                      />
                      <span
                        className={
                          included
                            ? ""
                            : "line-through decoration-zinc-300 dark:decoration-zinc-700"
                        }
                      >
                        {FEATURE_LABELS[key] ?? key}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
