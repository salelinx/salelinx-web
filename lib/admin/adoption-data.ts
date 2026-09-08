import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import { foldAdoption } from "@/lib/admin/adoption";
import type { AdoptionReport, AdoptionWindow } from "@/lib/admin/adoption";
import type {
  AdminSubscriptionRow,
  AdminUsageEventRow,
  AdminUsageRow,
  AdminUserRow,
} from "@/lib/types/admin";
import type { TierConfig } from "@/lib/types/tiers";

// Server loaders for the adoption and analytics views. They fetch the raw
// rows and hand them to the pure folds (adoption.ts, retention.ts). Every
// read goes through the is_admin()-gated RPCs the other usage modules use,
// so this adds no data path (see docs/ADMIN.md).
//
// Why row-level rows rather than a rollup RPC: adoption is DISTINCT USERS per
// feature, split by tier, which needs user ids client-side anyway. The period
// keys are generated server-side from a bounded month window (widest: the
// epoch to now), so the read stays bounded the same way /admin/usage's does.
// If the base outgrows this, the follow-up is an admin_feature_usage_rollup
// RPC returning (feature, month, tier_id, user_count, total_count).

export type AnalyticsSource = {
  window: AdoptionWindow;
  rows: AdminUsageRow[];
  users: AdminUserRow[];
  // Only fetched when asked for (the churn box needs cancel_at_period_end).
  subscriptions: AdminSubscriptionRow[];
  tiers: TierConfig[];
};

export async function loadAnalyticsSource(
  window: AdoptionWindow,
  opts: { withSubscriptions?: boolean } = {},
): Promise<AnalyticsSource> {
  const supabase = await createServerClient();

  // A trailing window (window.kind === "window") is answered from
  // usage_events, reshaped into counter rows under the synthetic buckets the
  // fold expects; everything else reads the bucketed counters by key.
  const usageQuery = window.events
    ? loadEventRows(supabase, window.events)
    : supabase.rpc("admin_list_usage", { p_period_keys: window.keys });

  const [usageRes, usersRes, tiers, subsRes] = await Promise.all([
    usageQuery,
    supabase.rpc("admin_list_users"),
    getTierConfigs(),
    opts.withSubscriptions
      ? supabase.rpc("admin_list_subscriptions")
      : Promise.resolve({ data: null }),
  ]);

  return {
    window,
    rows: (usageRes.data as AdminUsageRow[] | null) ?? [],
    users: (usersRes.data as AdminUserRow[] | null) ?? [],
    subscriptions: (subsRes.data as AdminSubscriptionRow[] | null) ?? [],
    tiers,
  };
}

export async function loadAdoptionReport(
  window: AdoptionWindow,
): Promise<AdoptionReport> {
  return foldAdoption(await loadAnalyticsSource(window));
}

// Emails for a handful of user ids (the boxes that name people), via the
// is_admin()-gated admin_user_emails RPC. Kept out of the folds so they stay
// free of personal data until a view actually needs to name someone.
export async function loadUserEmails(
  userIds: string[],
): Promise<Record<string, string>> {
  const emails: Record<string, string> = {};
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return emails;
  const supabase = await createServerClient();
  const { data } = await supabase.rpc("admin_user_emails", {
    p_user_ids: ids,
  });
  for (const row of (data as { user_id: string; email: string }[] | null) ??
    []) {
    emails[row.user_id] = row.email;
  }
  return emails;
}

// usage_events totals for the window (bucket "window") and, when present,
// the comparison window (bucket "compare"), in the counter row shape.
async function loadEventRows(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  events: NonNullable<AdoptionWindow["events"]>,
): Promise<{ data: AdminUsageRow[] }> {
  const fetchWindow = async (
    since: string,
    until: string,
    bucket: string,
  ): Promise<AdminUsageRow[]> => {
    const { data } = await supabase.rpc("admin_list_usage_events", {
      p_since: since,
      p_until: until,
    });
    return ((data as AdminUsageEventRow[] | null) ?? []).map((e) => ({
      user_id: e.user_id,
      feature: e.feature,
      period_key: bucket,
      count: Number(e.count),
      updated_at: e.last_at,
    }));
  };
  const [current, compare] = await Promise.all([
    fetchWindow(events.since, events.until, "window"),
    events.compareSince && events.compareUntil
      ? fetchWindow(events.compareSince, events.compareUntil, "compare")
      : Promise.resolve([] as AdminUsageRow[]),
  ]);
  return { data: [...current, ...compare] };
}
