import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  getCurrentSubscription,
  isEntitled,
  trialDaysRemaining,
} from "@/lib/supabase/subscription";
import { getReferralSummary } from "@/lib/supabase/referrals";
import { SITE_URL } from "@/lib/site";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { ReferralDiscountBanner } from "@/components/ReferralDiscountBanner";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { AccountSecurityCard } from "@/components/AccountSecurityCard";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { ReferralsCard } from "@/components/ReferralsCard";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string }>;
};

// Private, auth-gated page: keep it out of search results.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({ params, searchParams }: Props) {
  const [{ locale }, qs] = await Promise.all([params, searchParams]);
  const justCheckedOut = qs.checkout === "success";
  const t = await getTranslations({ locale, namespace: "Account" });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const unverified = !user.email_confirmed_at;
  // Google-only accounts have no "email" (password) identity. The security
  // and delete cards adapt: no password prompt to a user who has none.
  const hasPassword =
    user.identities?.some((i) => i.provider === "email") ?? true;
  const [{ subscription, tier }, referrals] = await Promise.all([
    getCurrentSubscription(user.id),
    getReferralSummary(),
  ]);
  const entitled = isEntitled(subscription);
  const trialDaysLeft = trialDaysRemaining(subscription);

  const tierLabel = (id: string) => {
    try {
      return t(`tierLabel.${id as "free" | "starter" | "pro" | "business"}`);
    } catch {
      return id;
    }
  };
  const statusLabel = (s: string) => {
    const known: Record<string, string> = {
      active: t("statusLabel.active"),
      trialing: t("statusLabel.trialing"),
      past_due: t("statusLabel.past_due"),
      canceled: t("statusLabel.canceled"),
      incomplete: t("statusLabel.incomplete"),
    };
    return known[s] ?? s;
  };

  const dateFallback = t("dateFallback");
  const formatDate = (iso: string | null): string => {
    if (!iso) return dateFallback;
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <ReferralDiscountBanner />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-full border border-black/10 px-4 py-2 text-sm dark:border-white/20"
          >
            {t("signOut")}
          </button>
        </form>
      </div>

      {justCheckedOut && (
        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t("checkoutSuccess")}
        </div>
      )}

      {unverified && user.email && (
        <div className="mt-8">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}

      <section
        id="plan"
        className="mt-10 scroll-mt-24 rounded-2xl border border-black/10 p-6 dark:border-white/10"
      >
        <h2 className="text-xl font-semibold">{t("currentPlanTitle")}</h2>

        {!subscription ? (
          <>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t("noSubscriptionBody")}
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              {t("startTrial")}
            </Link>
          </>
        ) : (
          <>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">{t("tier")}</dt>
                <dd className="mt-0.5 text-base font-medium">
                  {tierLabel(subscription.tier_id)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">{t("status")}</dt>
                <dd className="mt-0.5 text-base font-medium">
                  {statusLabel(subscription.status)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">
                  {subscription.status === "canceled"
                    ? t("ended")
                    : subscription.cancel_at_period_end
                      ? t("ends")
                      : t("renews")}
                </dt>
                <dd className="mt-0.5 text-base font-medium">
                  {formatDate(subscription.current_period_end)}
                </dd>
              </div>
              {tier && (
                <div>
                  <dt className="text-zinc-500">{t("planVersion")}</dt>
                  <dd className="mt-0.5 text-base font-medium">
                    v{tier.version}
                  </dd>
                </div>
              )}
            </dl>

            {subscription.status === "trialing" && trialDaysLeft !== null && (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {trialDaysLeft <= 1
                  ? t("trialEndsTomorrow")
                  : t("trialEndsInDays", { days: trialDaysLeft })}
              </p>
            )}
            {subscription.status === "past_due" && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {t("pastDueNote")}
              </p>
            )}
            {!entitled &&
              subscription.status !== "past_due" &&
              subscription.status !== "trialing" && (
                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <p>{t("lockedNote")}</p>
                  <Link
                    href="/pricing"
                    className="mt-3 inline-block rounded-full bg-amber-900 px-4 py-2 text-xs font-medium text-amber-50 dark:bg-amber-200 dark:text-amber-950"
                  >
                    {t("seePricing")}
                  </Link>
                </div>
              )}
            {subscription.cancel_at_period_end &&
              subscription.status !== "canceled" && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {t("scheduledCancel", {
                    date: formatDate(subscription.current_period_end),
                  })}
                </p>
              )}

            {subscription.stripe_customer_id && (
              <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/10">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t("managePortalBody")}
                </p>
                <ManageSubscriptionButton />
              </div>
            )}
          </>
        )}
      </section>

      {user.email && (
        <AccountSecurityCard email={user.email} hasPassword={hasPassword} />
      )}

      {referrals.code && (
        <ReferralsCard
          link={`${SITE_URL}/r/${referrals.code}`}
          pending={referrals.pending}
          converting={referrals.converting}
          rewarded={referrals.rewarded}
          creditEarned={
            referrals.rewardedTotalCents > 0 && referrals.rewardCurrency
              ? new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: referrals.rewardCurrency.toUpperCase(),
                }).format(referrals.rewardedTotalCents / 100)
              : null
          }
        />
      )}

      <section
        id="support"
        className="mt-6 flex scroll-mt-24 flex-col items-start gap-4 rounded-2xl border border-black/10 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
      >
        <div>
          <h2 className="text-xl font-semibold">{t("supportTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("supportBody")}
          </p>
        </div>
        <Link
          href="/account/tickets"
          className="shrink-0 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
        >
          {t("supportCta")}
        </Link>
      </section>

      {user.email && (
        <DeleteAccountCard email={user.email} hasPassword={hasPassword} />
      )}
    </main>
  );
}
