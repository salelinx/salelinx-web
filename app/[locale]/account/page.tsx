import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/supabase/subscription";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { AccountSecurityCard } from "@/components/AccountSecurityCard";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Payment failed",
  canceled: "Canceled",
  incomplete: "Incomplete",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Props = { searchParams: Promise<{ checkout?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const params = await searchParams;
  const justCheckedOut = params.checkout === "success";

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const unverified = !user.email_confirmed_at;
  const { subscription, tier } = await getCurrentSubscription(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your account
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
            Sign out
          </button>
        </form>
      </div>

      {justCheckedOut && (
        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Subscription activated. It may take a few seconds for the details
          below to refresh.
        </div>
      )}

      {unverified && user.email && (
        <div className="mt-8">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}

      <section className="mt-10 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold">Current plan</h2>

        {!subscription ? (
          <>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              You're on the Free tier. Upgrade any time.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              See pricing
            </Link>
          </>
        ) : (
          <>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Tier</dt>
                <dd className="mt-0.5 text-base font-medium">
                  {TIER_LABEL[subscription.tier_id] ?? subscription.tier_id}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Status</dt>
                <dd className="mt-0.5 text-base font-medium">
                  {STATUS_LABEL[subscription.status] ?? subscription.status}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">
                  {subscription.status === "canceled"
                    ? "Ended"
                    : subscription.cancel_at_period_end
                      ? "Ends"
                      : "Renews"}
                </dt>
                <dd className="mt-0.5 text-base font-medium">
                  {formatDate(subscription.current_period_end)}
                </dd>
              </div>
              {tier && (
                <div>
                  <dt className="text-zinc-500">Plan version</dt>
                  <dd className="mt-0.5 text-base font-medium">
                    v{tier.version}
                  </dd>
                </div>
              )}
            </dl>

            {subscription.status === "past_due" && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                A recent payment failed. Update your payment method below to
                avoid losing access.
              </p>
            )}
            {subscription.cancel_at_period_end &&
              subscription.status !== "canceled" && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Scheduled to cancel on{" "}
                  {formatDate(subscription.current_period_end)}. You can resume
                  any time before then via Manage subscription.
                </p>
              )}

            {subscription.stripe_customer_id && (
              <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/10">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Update your plan, change your payment method, download
                  invoices, or cancel in Stripe's billing portal.
                </p>
                <ManageSubscriptionButton />
              </div>
            )}
          </>
        )}
      </section>

      {user.email && <AccountSecurityCard email={user.email} />}
    </main>
  );
}
