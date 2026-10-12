import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/supabase/subscription";
import { redirect } from "@/i18n/navigation";
import { PlanStartedView } from "@/components/PlanStartedView";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; tier?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PlanStarted" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function PlanStartedPage({ params, searchParams }: Props) {
  const [{ locale }, qs] = await Promise.all([params, searchParams]);
  const tAccount = await getTranslations({ locale, namespace: "Account" });

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const { subscription } = await getCurrentSubscription(user.id);

  // change-plan passes type=paid because the row still says trialing until
  // the webhook lands. A Checkout return has to wait for that row instead.
  const kind =
    qs.type === "paid" || qs.type === "trial"
      ? qs.type
      : subscription?.status === "trialing"
        ? "trial"
        : subscription?.status === "active"
          ? "paid"
          : "pending";

  const tierId = qs.tier ?? subscription?.tier_id ?? "starter";
  const plan = (() => {
    try {
      return tAccount(`tierLabel.${tierId as "starter" | "pro" | "business"}`);
    } catch {
      return tierId;
    }
  })();
  const date = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <PlanStartedView locale={locale} kind={kind} plan={plan} date={date} />
  );
}
