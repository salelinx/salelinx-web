"use client";

// Right-hand detail drawer for one user. On open it fetches
// admin_user_detail() (an is_admin()-gated RPC returning a JSONB bundle:
// subscription + usage for the current periods + ticket count + the target
// user's admin status) in a single round-trip. Usage is shown against the
// tier's caps (tier configs are passed in from the page, public-read).
//
// Two mutations, deliberately separate:
//
// 1. "Edit" - entitlement override (tier / version / status) via the
//    admin_set_user_subscription() RPC (008_admin_edit_subscription.sql).
//    Changes OUR subscriptions row only; Stripe billing is untouched.
//    Reversible (the audit log records the old value), so it uses a
//    confirm-style form, not step-up reauth, per docs/ADMIN.md. When the row
//    is Stripe-managed we warn that the next webhook event will overwrite
//    the override.
//
// 2. "Change plan" - the REAL paid plan change via the admin-change-plan
//    Edge Function, shown only for entitled Stripe-managed subscriptions.
//    It swaps the price on the live Stripe subscription (prorated); the
//    stripe-webhook then syncs tier_id back onto our row. It charges the
//    customer money, so it is gated behind step-up reauth like ticket
//    deletion.
//
// Plus the danger zone: "Delete account" runs the GDPR erasure runbook via
// the admin-delete-user Edge Function (storage objects, Stripe customer,
// then the auth user, which cascades every user-owned row - see
// docs/GDPR.md). Irreversible, so step-up reauth. Hidden for admins (the
// function refuses to delete admins or the caller themselves).
//
// The read-only observability sections (linked accounts, devices, listings +
// storage) come from the same admin_user_detail() bundle, widened in migration
// 025_admin_user_observability.sql. They add no round-trips and no mutations.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { requireReauth } from "@/lib/admin/reauth";
import { ReauthModal } from "@/components/admin/ReauthModal";
import type { TierConfig } from "@/lib/types/tiers";
import type {
  AdminLinkedAccount,
  AdminSubscriptionRow,
  AdminUserDevice,
  AdminUserListings,
  AdminUserRow,
  AdminUserDetail as Detail,
} from "@/lib/types/admin";
import {
  USAGE_EPOCH,
  currentPeriodKeys,
  isMonthlyFeature,
  periodKeysForRange,
} from "@/lib/admin/period";
import { capForFeature, percentOfCap } from "@/lib/admin/usage-caps";
import { platformLabel, platformProfileUrl } from "@/lib/admin/platform-links";
import { formatBytes } from "@/lib/admin/format-bytes";
import {
  relativeAge,
  staleness,
  STALENESS_TONE,
} from "@/lib/admin/relative-time";
import { useClientNow } from "@/lib/admin/use-client-now";

type Props = {
  user: AdminUserRow;
  tiers: TierConfig[];
  onClose: () => void;
  onSubscriptionChange: (
    userId: string,
    tierId: string,
    status: string,
  ) => void;
  onDeleted: (userId: string) => void;
};

const STATUS_OPTIONS = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
] as const;

// Periods the drawer's usage section can show. "current" keeps the original
// count-vs-cap view (this month + today); the wider ranges answer "has this
// user ever used the thing" and show plain totals, because caps are per-period
// and a percent against a multi-period sum would mislead.
const USAGE_RANGES = [
  { value: "current", label: "This period" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
] as const;

type UsageRange = (typeof USAGE_RANGES)[number]["value"];

function usagePeriodKeysFor(range: UsageRange): string[] {
  const now = new Date();
  const { month, day } = currentPeriodKeys(now);
  if (range === "current") return [month, day];
  if (range === "all") return periodKeysForRange(USAGE_EPOCH, day);
  const from = currentPeriodKeys(
    new Date(now.getTime() - 29 * 86_400_000),
  ).day;
  return periodKeysForRange(from < USAGE_EPOCH ? USAGE_EPOCH : from, day);
}

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

// The extension writes listings.last_synced_at as epoch MILLISECONDS, and 0 is
// the column default meaning "never synced" - so it is not a 1970 timestamp.
function formatEpochMs(ms: number | null): string {
  if (!ms) return "never";
  return formatWhen(new Date(ms).toISOString());
}

// Shorten a self-reported user agent to something scannable. Deliberately
// crude: this is a display hint in a staff tool, never a decision input, and
// the full string is kept in the title attribute.
function browserLabel(ua: string | null): string {
  if (!ua) return "Unknown browser";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Brave\//.test(ua)) return "Brave";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return ua.slice(0, 32);
}

// Which OS the install runs on, for telling one seller's two machines apart.
function platformOsLabel(ua: string | null): string | null {
  if (!ua) return null;
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

export function AdminUserDetail({
  user,
  tiers,
  onClose,
  onSubscriptionChange,
  onDeleted,
}: Props) {
  const supabase = createBrowserClient();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscription edit form. tierSel is a "tier_id:version" key into the
  // active tier configs (the same rows the tiers/flags modules edit).
  const [editing, setEditing] = useState(false);
  const [tierSel, setTierSel] = useState("");
  const [statusSel, setStatusSel] = useState<string>("active");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Stripe plan-change form (entitled Stripe-managed subscriptions only).
  const [planOpen, setPlanOpen] = useState(false);
  const [planTierSel, setPlanTierSel] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  // Which action the step-up reauth modal is confirming.
  const [reauthFor, setReauthFor] = useState<"plan" | "delete" | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Bumped after a plan change so the effect refetches the detail bundle
  // (the webhook syncs the row a few seconds after Stripe accepts).
  const [refreshKey, setRefreshKey] = useState(0);
  // Which period the usage section shows; changing it refetches the bundle
  // with the matching period keys. The stale numbers stay visible during the
  // round trip, like any refetch here.
  const [usageRange, setUsageRange] = useState<UsageRange>("current");

  // Null on the server and through hydration, a ticking timestamp afterwards,
  // so relative ages cannot cause a mismatch. See lib/admin/use-client-now.ts.
  const now = useClientNow();

  // The parent gives this drawer a `key={user.user_id}`, so it remounts per
  // user and the initial state (loading, no detail) is already correct - no
  // synchronous setState in the effect body is needed (which would trigger a
  // cascading render). The effect only sets state asynchronously, when the RPC
  // resolves.
  useEffect(() => {
    let cancelled = false;

    supabase
      .rpc("admin_user_detail", {
        p_user_id: user.user_id,
        p_period_keys: usagePeriodKeysFor(usageRange),
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
  }, [user.user_id, supabase, refreshKey, usageRange]);

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

  function startEdit() {
    const current =
      sub &&
      tiers.some(
        (t) => t.tier_id === sub.tier_id && t.version === sub.tier_version,
      )
        ? `${sub.tier_id}:${sub.tier_version}`
        : tiers.length > 0
          ? `${tiers[0].tier_id}:${tiers[0].version}`
          : "";
    setTierSel(current);
    setStatusSel(sub?.status ?? "active");
    setSaveError(null);
    setNotice(null);
    setEditing(true);
  }

  async function saveSubscription() {
    if (saving || !tierSel) return;

    // tierSel is "tier_id:version"; split on the LAST colon so a tier id
    // containing separators can never break the parse.
    const split = tierSel.lastIndexOf(":");
    const tierId = tierSel.slice(0, split);
    const tierVersion = Number(tierSel.slice(split + 1));

    if (
      sub &&
      sub.tier_id === tierId &&
      sub.tier_version === tierVersion &&
      sub.status === statusSel
    ) {
      setSaveError("No change: that is already the current subscription.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    const { data, error: rpcErr } = await supabase.rpc(
      "admin_set_user_subscription",
      {
        p_user_id: user.user_id,
        p_tier_id: tierId,
        p_tier_version: tierVersion,
        p_status: statusSel,
      },
    );
    setSaving(false);
    if (rpcErr || !data) {
      setSaveError(`Update failed: ${rpcErr?.message ?? "no row returned"}`);
      return;
    }

    const row = data as AdminSubscriptionRow;
    setDetail((prev) => (prev ? { ...prev, subscription: row } : prev));
    setEditing(false);
    setNotice(
      `Subscription set to ${row.tier_id} v${row.tier_version} (${row.status}).`,
    );
    onSubscriptionChange(user.user_id, row.tier_id, row.status);
  }

  // Stripe plan change: only meaningful for a live Stripe subscription. Comp
  // rows and lapsed subscriptions have nothing to change in Stripe.
  const canChangePlan =
    !!sub?.stripe_subscription_id &&
    ["active", "trialing", "past_due"].includes(sub.status);
  // Stripe prices are keyed by tier_id metadata only (versions are a DB
  // concept), so the plan options are the distinct paid tier ids.
  const paidTierIds = Array.from(
    new Set(tiers.map((t) => t.tier_id).filter((t) => t !== "free")),
  );

  function startPlanChange() {
    setPlanTierSel(
      paidTierIds.find((t) => t !== sub?.tier_id) ?? paidTierIds[0] ?? "",
    );
    setPlanError(null);
    setNotice(null);
    setEditing(false);
    setPlanOpen(true);
  }

  async function confirmPlanChange(password: string) {
    if (planBusy || !planTierSel) return;
    setPlanBusy(true);
    setPlanError(null);

    try {
      await requireReauth(password);
    } catch (err) {
      setPlanBusy(false);
      setPlanError(
        err instanceof Error ? err.message : "Re-authentication failed.",
      );
      return;
    }

    // Session AFTER reauth (signInWithPassword rotates it).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setPlanBusy(false);
      setPlanError("Could not verify your session. Please sign in again.");
      return;
    }

    let res: Response;
    try {
      res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-change-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.user_id, tierId: planTierSel }),
        },
      );
    } catch {
      setPlanBusy(false);
      setPlanError("Could not reach the plan-change function.");
      return;
    }

    if (!res.ok) {
      let message = `Plan change failed (${res.status}).`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = `Plan change failed: ${body.error}`;
      } catch {
        // non-JSON error body; keep the status message
      }
      setPlanBusy(false);
      setPlanError(message);
      return;
    }

    setPlanBusy(false);
    setReauthFor(null);
    setPlanOpen(false);
    setNotice(
      `Stripe accepted the change to ${planTierSel}. The subscription row syncs when the webhook lands (usually a few seconds); reopen this drawer to see it.`,
    );
    setRefreshKey((k) => k + 1);
  }

  async function confirmAccountDelete(password: string) {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await requireReauth(password);
    } catch (err) {
      setDeleteBusy(false);
      setDeleteError(
        err instanceof Error ? err.message : "Re-authentication failed.",
      );
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setDeleteBusy(false);
      setDeleteError("Could not verify your session. Please sign in again.");
      return;
    }

    let res: Response;
    try {
      res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.user_id }),
        },
      );
    } catch {
      setDeleteBusy(false);
      setDeleteError("Could not reach the deletion function.");
      return;
    }

    if (!res.ok) {
      let message = `Deletion failed (${res.status}).`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = `Deletion failed: ${body.error}`;
      } catch {
        // non-JSON error body; keep the status message
      }
      setDeleteBusy(false);
      setDeleteError(message);
      return;
    }

    setDeleteBusy(false);
    setReauthFor(null);
    onDeleted(user.user_id);
    onClose();
  }

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
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
          <Meta label="User ID">
            <span className="font-mono break-all">{user.user_id}</span>
          </Meta>
          {user.email && <Meta label="Email">{user.email}</Meta>}
          <Meta label="Joined">
            <When iso={user.created_at} now={now} />
          </Meta>
          <Meta label="Last sign-in">
            <When iso={user.last_sign_in_at} now={now} tone />
          </Meta>
          {/* The freshest extension heartbeat. Usually more recent than the
              sign-in above, because a refresh token keeps the session alive
              without the user ever signing in again. */}
          <Meta label="Last seen">
            <When iso={user.last_device_seen_at} now={now} tone />
          </Meta>
        </dl>

        {loading && (
          <p className="mt-4 text-sm text-zinc-500">Loading...</p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {detail && !loading && (
          <>
            <Section
              title="Subscription"
              action={
                !editing &&
                !planOpen && (
                  <div className="flex gap-1.5">
                    {canChangePlan && (
                      <button
                        type="button"
                        onClick={startPlanChange}
                        className="rounded border border-[var(--admin-border)] px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
                      >
                        Change plan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded border border-[var(--admin-border)] px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
                    >
                      Edit
                    </button>
                  </div>
                )
              }
            >
              {notice && !editing && !planOpen && (
                <p className="mb-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  {notice}
                </p>
              )}
              {planOpen ? (
                <div className="space-y-2 rounded-md border border-[var(--admin-border)] bg-sky-50 p-3 text-xs">
                  <p className="text-zinc-600">
                    Changes the customer&apos;s PAID plan in Stripe: the live
                    subscription switches to the new tier&apos;s price with an
                    immediate prorated charge or credit. Our database syncs
                    automatically via the webhook. Currently{" "}
                    <span className="font-medium capitalize">
                      {sub?.tier_id}
                    </span>{" "}
                    ({sub?.status}).
                  </p>
                  <label className="flex items-center gap-2">
                    <span className="w-12 text-zinc-500">Plan</span>
                    <select
                      value={planTierSel}
                      disabled={planBusy}
                      onChange={(e) => setPlanTierSel(e.target.value)}
                      className="rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 outline-none focus:border-zinc-400"
                    >
                      {paidTierIds.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  {planError && reauthFor === null && (
                    <p className="text-red-600">{planError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPlanError(null);
                        setReauthFor("plan");
                      }}
                      disabled={planBusy || !planTierSel}
                      className="rounded bg-zinc-900 px-3 py-1 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanOpen(false)}
                      disabled={planBusy}
                      className="rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : editing ? (
                <div className="space-y-2 rounded-md border border-[var(--admin-border)] bg-amber-50 p-3 text-xs">
                  <p className="text-zinc-600">
                    Currently{" "}
                    {sub ? (
                      <>
                        <span className="font-medium capitalize">
                          {sub.tier_id}
                        </span>{" "}
                        v{sub.tier_version} ({sub.status})
                      </>
                    ) : (
                      "no subscription (free tier); saving creates a comp row"
                    )}
                    . Audit-logged.
                  </p>
                  {sub?.stripe_subscription_id && (
                    <p className="text-amber-800">
                      This subscription is managed by Stripe: the next webhook
                      event for it will overwrite this override, and the amount
                      Stripe charges does not change. Real plan changes for
                      paying users belong in Stripe.
                    </p>
                  )}
                  <label className="flex items-center gap-2">
                    <span className="w-12 text-zinc-500">Tier</span>
                    <select
                      value={tierSel}
                      disabled={saving}
                      onChange={(e) => setTierSel(e.target.value)}
                      className="rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 outline-none focus:border-zinc-400"
                    >
                      {tiers.map((t) => (
                        <option
                          key={`${t.tier_id}:${t.version}`}
                          value={`${t.tier_id}:${t.version}`}
                        >
                          {t.tier_id} v{t.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-12 text-zinc-500">Status</span>
                    <select
                      value={statusSel}
                      disabled={saving}
                      onChange={(e) => setStatusSel(e.target.value)}
                      className="rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 outline-none focus:border-zinc-400"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  {saveError && <p className="text-red-600">{saveError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void saveSubscription()}
                      disabled={saving}
                      className="rounded bg-zinc-900 px-3 py-1 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      className="rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : sub ? (
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

            <Section title="Linked accounts">
              <LinkedAccounts accounts={detail.linked_accounts ?? []} />
            </Section>

            <Section title="Devices">
              <Devices devices={detail.devices ?? []} now={now} />
            </Section>

            <Section title="Listings and storage">
              <ListingsSummary
                listings={detail.listings}
                storageBytes={detail.storage_bytes}
                now={now}
              />
            </Section>

            <Section
              title="Usage"
              action={
                <select
                  value={usageRange}
                  onChange={(e) => setUsageRange(e.target.value as UsageRange)}
                  className="rounded border border-[var(--admin-border)] bg-white px-1.5 py-0.5 text-xs text-zinc-600 outline-none focus:border-zinc-400"
                  aria-label="Usage period"
                >
                  {USAGE_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              }
            >
              {detail.usage.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No usage recorded in this range.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {/* A range spans many period keys, so sum per feature; the
                      current period is a month key + a day key holding
                      different features, so summing is a no-op there. */}
                  {Array.from(
                    detail.usage
                      .reduce((m, u) => {
                        m.set(u.feature, (m.get(u.feature) ?? 0) + u.count);
                        return m;
                      }, new Map<string, number>())
                      .entries(),
                  ).map(([feature, count]) => {
                    // Caps are per-period; only the current-period view can
                    // measure against them.
                    const cap =
                      usageRange === "current"
                        ? capForFeature(feature, tierConfig)
                        : null;
                    const pct = percentOfCap(count, cap);
                    return (
                      <li
                        key={feature}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-zinc-700">
                          {feature}
                          <span className="ml-1 text-xs text-zinc-400">
                            {isMonthlyFeature(feature) ? "mo" : "day"}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-zinc-800">
                          {count}
                          {usageRange === "current" && (
                            <>
                              {" / "}
                              {cap === null ? (
                                <span className="text-zinc-400">unlimited</span>
                              ) : (
                                cap
                              )}
                            </>
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

            {!detail.is_admin && (
              <Section title="Danger zone">
                <p className="mb-2 text-xs text-zinc-500">
                  Deletes the account and everything it owns: listings, images,
                  linked accounts, usage, tickets, and the Stripe customer
                  (cancelling any subscription). This is the GDPR erasure
                  runbook; it cannot be undone. Remember the manual follow-up:
                  purge their threads from the support inbox (docs/GDPR.md).
                </p>
                {deleteError && reauthFor === null && (
                  <p className="mb-2 text-xs text-red-600">{deleteError}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setReauthFor("delete");
                  }}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete account
                </button>
              </Section>
            )}
          </>
        )}
      </div>

      {reauthFor === "plan" && (
        <ReauthModal
          title="Confirm plan change"
          description={
            <>
              This switches the customer&apos;s live Stripe subscription to{" "}
              <span className="font-medium capitalize">{planTierSel}</span> and
              applies a prorated charge or credit immediately.
            </>
          }
          confirmLabel="Change plan"
          busyLabel="Changing..."
          danger={false}
          busy={planBusy}
          error={planError}
          onCancel={() => {
            setReauthFor(null);
            setPlanError(null);
          }}
          onConfirm={(password) => void confirmPlanChange(password)}
        />
      )}
      {reauthFor === "delete" && (
        <ReauthModal
          title="Confirm account deletion"
          description={
            <>
              This permanently deletes{" "}
              <span className="font-medium">{user.email ?? user.user_id}</span>{" "}
              and everything they own, and cancels any Stripe subscription.
              This cannot be undone.
            </>
          }
          confirmLabel="Delete account"
          busyLabel="Deleting..."
          danger
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            setReauthFor(null);
            setDeleteError(null);
          }}
          onConfirm={(password) => void confirmAccountDelete(password)}
        />
      )}
    </div>
  );
}

// An absolute timestamp with its age beside it. `now` is null until the parent
// mounts, and until then only the absolute date renders, so the server and
// client agree on the markup.
function When({
  iso,
  now,
  tone = false,
}: {
  iso: string | null;
  now: number | null;
  tone?: boolean;
}) {
  if (!iso) return <span className="text-zinc-400">never</span>;
  const age = now === null ? null : relativeAge(iso, now);
  return (
    <>
      {formatWhen(iso)}
      {age && (
        <span
          className={
            "ml-1.5 " +
            (tone && now !== null
              ? STALENESS_TONE[staleness(iso, now)]
              : "text-zinc-400")
          }
        >
          ({age})
        </span>
      )}
    </>
  );
}

// The seller's Depop / Vinted accounts, each linking out to the public shop so
// an admin can see the storefront behind a ticket in one click. A Depop row
// with no captured username is not linkable (Depop profile URLs are keyed by
// username, never the numeric id), so it degrades to plain text rather than a
// dead link. See lib/admin/platform-links.ts.
function LinkedAccounts({ accounts }: { accounts: AdminLinkedAccount[] }) {
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No marketplace accounts linked. The extension links one the first time
        it detects a signed-in Depop or Vinted session.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {accounts.map((a) => {
        const href = platformProfileUrl(
          a.platform,
          a.platform_user_id,
          a.platform_username,
        );
        return (
          <li
            key={a.platform}
            className="rounded-md border border-[var(--admin-border)] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-800">
                {platformLabel(a.platform)}
              </span>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 rounded border border-[var(--admin-border)] px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  Open shop
                </a>
              ) : (
                <span className="shrink-0 text-xs text-zinc-400">
                  No username on record
                </span>
              )}
            </div>
            <dl className="mt-1.5 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 text-xs">
              <Meta label="Username">
                {a.platform_username ?? (
                  <span className="text-zinc-400">-</span>
                )}
              </Meta>
              <Meta label="Account ID">
                <span className="font-mono break-all text-zinc-500">
                  {a.platform_user_id}
                </span>
              </Meta>
              <Meta label="Linked">{formatWhen(a.linked_at)}</Meta>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

// Extension installs, freshest first (the RPC caps this at 10). Two of these
// heartbeating at the same time is what the concurrent-device cap acts on, so
// several live rows here is the shape account sharing takes.
function Devices({
  devices,
  now,
}: {
  devices: AdminUserDevice[];
  now: number | null;
}) {
  if (devices.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No extension installs have checked in. Rows idle for 30 days are pruned
        automatically, so this is also what a long-dormant account looks like.
      </p>
    );
  }

  return (
    <>
      <p className="mb-2 text-xs text-zinc-500">
        {devices.length} {devices.length === 1 ? "install" : "installs"} seen
        recently.
      </p>
      <ul className="space-y-1.5">
        {devices.map((d) => {
          const os = platformOsLabel(d.user_agent);
          return (
            <li
              key={d.device_id}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <span className="min-w-0">
                <span className="text-zinc-700" title={d.user_agent ?? ""}>
                  {browserLabel(d.user_agent)}
                  {os && <span className="text-zinc-400"> on {os}</span>}
                </span>
                {/* Per install, not per user: two machines can sit on
                    different builds, and which one produced a bug report is
                    exactly what support needs. Null on a build older than
                    migration 041, which reported no version. */}
                {d.extension_version ? (
                  <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">
                    v{d.extension_version}
                  </span>
                ) : (
                  <span className="ml-1.5 text-zinc-400" title="This install has not reported a version yet">
                    v?
                  </span>
                )}
                <span className="ml-1.5 font-mono text-zinc-400">
                  {d.device_id.slice(0, 8)}
                </span>
              </span>
              <span
                className={
                  "shrink-0 " +
                  (now === null
                    ? "text-zinc-500"
                    : STALENESS_TONE[staleness(d.last_seen_at, now)])
                }
              >
                {(now !== null && relativeAge(d.last_seen_at, now)) ||
                  formatWhen(d.last_seen_at)}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// What the account has actually synced: how many listings, split by platform
// and status, and when the sync last ran. A paying user with zero listings, or
// one whose last sync is weeks old, is the case worth spotting here.
function ListingsSummary({
  listings,
  storageBytes,
  now,
}: {
  listings: AdminUserListings | undefined;
  storageBytes: number | null;
  now: number | null;
}) {
  const total = listings?.total ?? 0;
  const breakdown = listings?.by_platform_status ?? [];

  // Group by platform so the statuses read as one line per marketplace.
  const byPlatform = new Map<string, { status: string; count: number }[]>();
  for (const row of breakdown) {
    const existing = byPlatform.get(row.platform) ?? [];
    existing.push({ status: row.status, count: row.count });
    byPlatform.set(row.platform, existing);
  }

  return (
    <>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
        <Meta label="Listings">
          {total === 0 ? (
            <span className="text-zinc-400">none synced</span>
          ) : (
            <span className="text-zinc-800">{total}</span>
          )}
        </Meta>
        <Meta label="Last sync">
          {/* Server-side write time, so it is trustworthy. The extension's own
              last_synced_at is shown beside it only when the two disagree
              noticeably. */}
          <When iso={listings?.last_cloud_update_at ?? null} now={now} tone />
        </Meta>
        <Meta label="Extension clock">
          <span className="text-zinc-500">
            {formatEpochMs(listings?.last_synced_at ?? null)}
          </span>
        </Meta>
        <Meta label="Storage">
          {storageBytes === null ? (
            <span className="text-zinc-400">nothing uploaded</span>
          ) : (
            formatBytes(storageBytes)
          )}
        </Meta>
      </dl>

      {byPlatform.size > 0 && (
        <ul className="mt-2 space-y-1">
          {Array.from(byPlatform.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([platform, rows]) => (
              <li key={platform} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="w-14 shrink-0 capitalize text-zinc-500">
                  {platform}
                </span>
                {rows
                  .sort((a, b) => b.count - a.count)
                  .map((r) => (
                    <span key={r.status} className="text-zinc-700">
                      {r.count}{" "}
                      <span className="text-zinc-400">{r.status}</span>
                    </span>
                  ))}
              </li>
            ))}
        </ul>
      )}
    </>
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
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-[var(--admin-border)] pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
