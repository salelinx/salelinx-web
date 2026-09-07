// Retention and funnel math for the Analytics dashboard. Pure, like
// adoption.ts: raw admin RPC rows in, plain numbers out, pinned by
// tests/retention.test.ts.
//
// Two questions, both answered from tables the console already reads:
//
//   Signup funnel - of every account, how many linked a shop, ran anything,
//   and pay. States, not a strict sequence (someone can subscribe before
//   linking), so each stage is shown as a share of ACCOUNTS rather than of
//   the previous stage, which would otherwise be able to exceed 100%.
//
//   Churn watch - paying users who have stopped using the extension (quiet)
//   and paying users who have already asked to cancel (cancelling). The
//   first list is who to contact before the second list grows.

import { usageSource } from "@/lib/admin/usage-sources";
import type {
  AdminSubscriptionRow,
  AdminUsageRow,
  AdminUserRow,
} from "@/lib/types/admin";

const PAID_STATUSES = new Set(["active", "trialing"]);
const DAY_MS = 86_400_000;

export function isPaying(u: Pick<AdminUserRow, "tier_id" | "status">): boolean {
  return (
    (u.tier_id ?? "free") !== "free" &&
    u.status !== null &&
    PAID_STATUSES.has(u.status)
  );
}

// Latest usage_counters.updated_at per user across extension counters. The
// row timestamp is the last increment, so it is day-precise even for month
// buckets. Users with no rows in the fetched keys are absent.
export function lastActivityByUser(rows: AdminUsageRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.count <= 0 || usageSource(r.feature) !== "extension") continue;
    const cur = out.get(r.user_id);
    if (!cur || r.updated_at > cur) out.set(r.user_id, r.updated_at);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Signup funnel
// ---------------------------------------------------------------------------

export type FunnelStage = {
  key: "accounts" | "linked" | "active" | "paying";
  label: string;
  count: number;
  // Share of accounts, 0-100, or null when there are no accounts.
  share: number | null;
};

export function signupFunnel(
  users: AdminUserRow[],
  rows: AdminUsageRow[],
): FunnelStage[] {
  const acted = lastActivityByUser(rows);
  const accounts = users.length;
  const linked = users.filter((u) => u.linked_platforms.length > 0).length;
  const active = users.filter((u) => acted.has(u.user_id)).length;
  const paying = users.filter(isPaying).length;
  const share = (n: number) => (accounts === 0 ? null : (n / accounts) * 100);
  return [
    { key: "accounts", label: "Accounts", count: accounts, share: share(accounts) },
    { key: "linked", label: "Linked a shop", count: linked, share: share(linked) },
    { key: "active", label: "Ran an action", count: active, share: share(active) },
    { key: "paying", label: "Paying", count: paying, share: share(paying) },
  ];
}

// ---------------------------------------------------------------------------
// Churn watch
// ---------------------------------------------------------------------------

export type ChurnEntry = {
  user_id: string;
  tier_id: string;
  // Cancelling: days until the paid period ends. Quiet: days since the last
  // recorded action, or null when nothing is recorded in the fetched window.
  days: number | null;
};

export type ChurnWatch = {
  payingUsers: number;
  // Paying users with cancel_at_period_end set, soonest period end first.
  cancelling: ChurnEntry[];
  // Paying users (not already cancelling) with no extension activity for
  // `quietDays` or more; longest silence first, "never" ahead of everyone.
  quiet: ChurnEntry[];
};

export function churnWatch(input: {
  users: AdminUserRow[];
  subscriptions: AdminSubscriptionRow[];
  rows: AdminUsageRow[];
  now: Date;
  quietDays?: number;
}): ChurnWatch {
  const { users, subscriptions, rows, now } = input;
  const quietDays = input.quietDays ?? 30;
  const nowMs = now.getTime();
  const lastActive = lastActivityByUser(rows);
  const paying = users.filter(isPaying);

  // Latest subscription row per user, matching admin_list_users' join.
  const subByUser = new Map<string, AdminSubscriptionRow>();
  for (const s of subscriptions) {
    const cur = subByUser.get(s.user_id);
    if (!cur || s.updated_at > cur.updated_at) subByUser.set(s.user_id, s);
  }

  const cancelling: ChurnEntry[] = [];
  const cancellingIds = new Set<string>();
  for (const u of paying) {
    const s = subByUser.get(u.user_id);
    if (!s || !s.cancel_at_period_end) continue;
    cancellingIds.add(u.user_id);
    const end = s.current_period_end ? Date.parse(s.current_period_end) : NaN;
    cancelling.push({
      user_id: u.user_id,
      tier_id: u.tier_id ?? "free",
      days: Number.isNaN(end) ? null : Math.max(0, Math.ceil((end - nowMs) / DAY_MS)),
    });
  }
  cancelling.sort(
    (a, b) => (a.days ?? Infinity) - (b.days ?? Infinity) || a.user_id.localeCompare(b.user_id),
  );

  const quiet: ChurnEntry[] = [];
  for (const u of paying) {
    if (cancellingIds.has(u.user_id)) continue;
    const last = lastActive.get(u.user_id);
    if (!last) {
      quiet.push({ user_id: u.user_id, tier_id: u.tier_id ?? "free", days: null });
      continue;
    }
    const days = Math.floor((nowMs - Date.parse(last)) / DAY_MS);
    if (days >= quietDays) {
      quiet.push({ user_id: u.user_id, tier_id: u.tier_id ?? "free", days });
    }
  }
  quiet.sort(
    (a, b) => (b.days ?? Infinity) - (a.days ?? Infinity) || a.user_id.localeCompare(b.user_id),
  );

  return { payingUsers: paying.length, cancelling, quiet };
}
