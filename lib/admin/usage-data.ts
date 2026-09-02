import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import { currentUsagePeriod } from "@/lib/admin/period";
import type { UsagePeriod } from "@/lib/admin/period";
import { capForFeature, percentOfCap } from "@/lib/admin/usage-caps";
import { usageSource, webCounterLimit } from "@/lib/admin/usage-sources";
import { EXTENSION_FEATURES } from "@/lib/admin/extension-features";
import type {
  AdminUsageRow,
  AdminUserRow,
  AdminSubscriptionRow,
} from "@/lib/types/admin";
import type { UsageTableRow } from "@/components/admin/usage/AdminUsageTable";
import type {
  UserUsageFeatureRow,
  UserUsageGroup,
} from "@/components/admin/usage/AdminUserUsageGroups";
import type { UsageSource } from "@/lib/admin/usage-sources";

// Shared loader for the two usage modules. Both read the SAME usage_counters
// rows for the selected period and differ only in which source they keep and
// how the cap is resolved, so the query work lives here once. The default
// period is the current one (this month + today); the Extension usage page can
// pass a wider range resolved from its URL params.
//
// Every read below still goes through the is_admin()-gated RPCs; splitting the
// page did not add a data path (see docs/ADMIN.md).
export async function loadUsageRows(
  source: UsageSource,
  period: UsagePeriod = currentUsagePeriod(new Date()),
): Promise<{
  rows: UsageTableRow[];
  periodLabel: string;
}> {
  const supabase = await createServerClient();

  // These four reads are independent of each other, so they resolve together.
  const [usageRes, usersRes, subsRes, tiers] = await Promise.all([
    supabase.rpc("admin_list_usage", { p_period_keys: period.keys }),
    supabase.rpc("admin_list_users"),
    supabase.rpc("admin_list_subscriptions"),
    getTierConfigs(),
  ]);

  const all = (usageRes.data as AdminUsageRow[] | null) ?? [];
  const usage = all.filter((u) => usageSource(u.feature) === source);

  const users = (usersRes.data as AdminUserRow[] | null) ?? [];
  const tierByUser: Record<string, string> = {};
  for (const u of users) tierByUser[u.user_id] = u.tier_id ?? "free";

  const subs = (subsRes.data as AdminSubscriptionRow[] | null) ?? [];
  const versionByUser: Record<string, number> = {};
  for (const s of subs) versionByUser[s.user_id] = s.tier_version;

  // Resolve emails only for the users who survived the source filter.
  const emails: Record<string, string> = {};
  const userIds = Array.from(new Set(usage.map((u) => u.user_id)));
  if (userIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: userIds,
    });
    for (const row of (emailRows as
      { user_id: string; email: string }[] | null) ?? []) {
      emails[row.user_id] = row.email;
    }
  }

  const rows: UsageTableRow[] = usage.map((u) => {
    const tierId = tierByUser[u.user_id] ?? "free";
    const version = versionByUser[u.user_id];
    const tierConfig =
      (version !== undefined &&
        tiers.find((t) => t.tier_id === tierId && t.version === version)) ||
      tiers.find((t) => t.tier_id === tierId) ||
      null;

    // Extension counters are capped by the user's tier. Web counters are capped
    // by a fixed constant in the calling code, identical for every tier, so the
    // tier config is irrelevant to them. Caps are per-period, so a multi-period
    // range carries no cap at all (see UsagePeriod.capped).
    const cap = !period.capped
      ? null
      : source === "web"
        ? webCounterLimit(u.feature)
        : capForFeature(u.feature, tierConfig);

    return {
      key: `${u.user_id}:${u.feature}:${u.period_key}`,
      user_id: u.user_id,
      email: emails[u.user_id] ?? null,
      tier_id: tierId,
      feature: u.feature,
      period_key: u.period_key,
      count: u.count,
      cap,
      percent: percentOfCap(u.count, cap),
    };
  });

  return { rows, periodLabel: period.label };
}

// Grouped loader for the Extension usage page: one entry per user, and inside
// it one row per feature in the FULL extension roster (zero-count rows
// included, so an unused feature reads as "0" rather than being invisible).
// Counters the roster does not know about yet are appended after it, so a new
// extension counter still shows up before this file learns its label.
export async function loadExtensionUsageByUser(period?: UsagePeriod): Promise<{
  groups: UserUsageGroup[];
  periodLabel: string;
}> {
  const { rows, periodLabel } = await loadUsageRows("extension", period);

  // A feature can surface under several period keys (month + many days in a
  // range view); sum them so each (user, feature) renders once.
  const byUser = new Map<string, Map<string, UsageTableRow[]>>();
  for (const r of rows) {
    const features = byUser.get(r.user_id) ?? new Map<string, UsageTableRow[]>();
    const list = features.get(r.feature) ?? [];
    list.push(r);
    features.set(r.feature, list);
    byUser.set(r.user_id, features);
  }

  const rosterOrder = EXTENSION_FEATURES.map((f) => f.counter);

  const groups: UserUsageGroup[] = Array.from(byUser.entries()).map(
    ([userId, features]) => {
      const anyRow = features.values().next().value![0];

      const featureRows: UserUsageFeatureRow[] = [];
      const emit = (counter: string) => {
        const forFeature = features.get(counter) ?? [];
        const count = forFeature.reduce((sum, r) => sum + r.count, 0);
        // The cap was resolved server-side on whichever row exists; a
        // zero-count roster feature has no row, and only the five metered
        // verbs have caps anyway, so null is correct for those.
        const cap = forFeature[0]?.cap ?? null;
        featureRows.push({
          feature: counter,
          count,
          cap,
          percent: percentOfCap(count, cap),
        });
      };
      for (const counter of rosterOrder) emit(counter);
      for (const counter of Array.from(features.keys()).sort()) {
        if (!rosterOrder.includes(counter)) emit(counter);
      }

      return {
        user_id: userId,
        email: anyRow.email,
        tier_id: anyRow.tier_id,
        features: featureRows,
        totalCount: featureRows.reduce((sum, f) => sum + f.count, 0),
        maxPercent: featureRows.reduce<number | null>(
          (max, f) =>
            f.percent === null ? max : Math.max(max ?? 0, f.percent),
          null,
        ),
      };
    },
  );

  groups.sort((a, b) => b.totalCount - a.totalCount);
  return { groups, periodLabel };
}
