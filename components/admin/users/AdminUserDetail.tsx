"use client";

// Right-hand detail drawer for one user. Read-only: no actions. On open it
// fetches admin_user_detail() (an is_admin()-gated RPC returning a JSONB
// bundle: subscription + usage for the current periods + ticket count + the
// target user's admin status) in a single round-trip. Usage is shown against
// the tier's caps (tier configs are passed in from the page, public-read).
// Models AdminTicketDetail.tsx minus all mutations.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import type { TierConfig } from "@/lib/types/tiers";
import type { AdminUserRow, AdminUserDetail as Detail } from "@/lib/types/admin";
import { currentPeriodKeys, isMonthlyFeature } from "@/lib/admin/period";
import { capForFeature, percentOfCap } from "@/lib/admin/usage-caps";

type Props = {
  user: AdminUserRow;
  tiers: TierConfig[];
  onClose: () => void;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminUserDetail({ user, tiers, onClose }: Props) {
  const supabase = createBrowserClient();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The parent gives this drawer a `key={user.user_id}`, so it remounts per
  // user and the initial state (loading, no detail) is already correct - no
  // synchronous setState in the effect body is needed (which would trigger a
  // cascading render). The effect only sets state asynchronously, when the RPC
  // resolves.
  useEffect(() => {
    let cancelled = false;
    const { month, day } = currentPeriodKeys(new Date());

    supabase
      .rpc("admin_user_detail", {
        p_user_id: user.user_id,
        p_period_keys: [month, day],
      })
      .then(({ data, error: rpcErr }) => {
        if (cancelled) return;
        if (rpcErr) {
          setError("Could not load this user's detail.");
          setLoading(false);
          return;
        }
        setDetail((data as Detail | null) ?? null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.user_id, supabase]);

  const sub = detail?.subscription ?? null;
  // Resolve the tier config for this user's current tier so usage can be shown
  // against caps. Subscriptions carry a tier_version; match it, else fall back
  // to the active config for the tier id.
  const tierConfig =
    (sub &&
      tiers.find(
        (t) => t.tier_id === sub.tier_id && t.version === sub.tier_version,
      )) ||
    tiers.find((t) => t.tier_id === (sub?.tier_id ?? user.tier_id ?? "free")) ||
    null;

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {user.email ?? "User"}
          </span>
          {detail?.is_admin && (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
              Admin
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Close detail"
        >
          x
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-xs">
          <Meta label="User ID">
            <span className="font-mono break-all">{user.user_id}</span>
          </Meta>
          {user.email && <Meta label="Email">{user.email}</Meta>}
          <Meta label="Joined">{formatWhen(user.created_at)}</Meta>
          <Meta label="Last sign-in">{formatWhen(user.last_sign_in_at)}</Meta>
        </dl>

        {loading && (
          <p className="mt-4 text-sm text-zinc-500">Loading...</p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {detail && !loading && (
          <>
            <Section title="Subscription">
              {sub ? (
                <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <Meta label="Tier">
                    <span className="capitalize">{sub.tier_id}</span>{" "}
                    <span className="text-zinc-400">v{sub.tier_version}</span>
                  </Meta>
                  <Meta label="Status">{sub.status}</Meta>
                  <Meta label="Renews">
                    {formatWhen(sub.current_period_end)}
                    {sub.cancel_at_period_end && (
                      <span className="ml-1 text-amber-700">
                        (cancels at period end)
                      </span>
                    )}
                  </Meta>
                  {sub.stripe_customer_id && (
                    <Meta label="Stripe cust.">
                      <span className="font-mono break-all text-zinc-500">
                        {sub.stripe_customer_id}
                      </span>
                    </Meta>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-zinc-500">
                  No subscription (free tier).
                </p>
              )}
            </Section>

            <Section title="Usage this period">
              {detail.usage.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No usage recorded this period.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.usage.map((u) => {
                    const cap = capForFeature(u.feature, tierConfig);
                    const pct = percentOfCap(u.count, cap);
                    return (
                      <li
                        key={`${u.feature}:${u.period_key}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-zinc-700">
                          {u.feature}
                          <span className="ml-1 text-xs text-zinc-400">
                            {isMonthlyFeature(u.feature) ? "mo" : "day"}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-zinc-800">
                          {u.count}
                          {" / "}
                          {cap === null ? (
                            <span className="text-zinc-400">unlimited</span>
                          ) : (
                            cap
                          )}
                          {pct !== null && (
                            <span
                              className={
                                "ml-2 " +
                                (pct >= 90
                                  ? "text-red-600"
                                  : pct >= 75
                                    ? "text-amber-700"
                                    : "text-zinc-400")
                              }
                            >
                              {Math.round(pct)}%
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Support tickets">
              {detail.ticket_count === 0 ? (
                <p className="text-sm text-zinc-500">No tickets.</p>
              ) : (
                <p className="text-sm text-zinc-700">
                  {detail.ticket_count}{" "}
                  {detail.ticket_count === 1 ? "ticket" : "tickets"}.{" "}
                  <Link
                    href="/admin/support"
                    className="text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                  >
                    Open Support
                  </Link>
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-800">{children}</dd>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-[var(--admin-border)] pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  );
}
