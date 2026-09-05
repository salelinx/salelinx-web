// Shapes for the admin console modules (Users, Subscriptions, Usage, Audit
// log). These mirror the return types of the admin_* RPCs in migration
// 009_admin_console.sql (admin_set_user_subscription also returns an
// AdminSubscriptionRow).

// The platforms a linked account can belong to, matching the CHECK constraint
// on linked_accounts.platform (migration 001_core_schema.sql).
export type LinkedPlatform = "depop" | "vinted";

// Row from admin_list_users(): one auth.users user joined to their current
// subscription (tier/status may be null when the user has no subscription row).
// is_admin flags membership in admin_users (display-only).
export type AdminUserRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  tier_id: string | null;
  status: string | null;
  is_admin: boolean;
  // Which marketplaces this user has connected. Empty array (never null) for a
  // user who has linked nothing.
  linked_platforms: LinkedPlatform[];
  // Freshest device_sessions heartbeat across their extension installs, or null
  // if the extension has never checked in. A better liveness signal than
  // last_sign_in_at, which a long-lived refresh token leaves stale.
  last_device_seen_at: string | null;
};

// Row from admin_list_subscriptions(): a full subscriptions row.
export type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier_id: string;
  tier_version: number;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

// Row from admin_list_usage(): one usage counter for one (user, feature, period).
export type AdminUsageRow = {
  user_id: string;
  feature: string;
  period_key: string;
  count: number;
  updated_at: string;
};

// One usage counter inside the admin_user_detail() bundle (no user_id; it is
// scoped to the one user the bundle is for).
export type AdminUserUsageEntry = {
  feature: string;
  period_key: string;
  count: number;
  updated_at: string;
};

// One linked marketplace account inside the admin_user_detail() bundle
// (linked_accounts, migration 001_core_schema.sql). platform_username is null
// on rows written before the extension started capturing it; without it a Depop
// profile cannot be linked (Depop URLs are keyed by username, not numeric id).
export type AdminLinkedAccount = {
  platform: LinkedPlatform;
  platform_user_id: string;
  platform_username: string | null;
  linked_at: string;
};

// One extension install inside the admin_user_detail() bundle (device_sessions,
// migration 008_device_sessions.sql). user_agent is self-reported by the
// extension: display only, never parsed for a decision.
export type AdminUserDevice = {
  device_id: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
};

// Synced-listing counts for one (platform, status) pair.
export type AdminListingBreakdown = {
  platform: LinkedPlatform;
  status: string;
  count: number;
};

// The listings roll-up inside the admin_user_detail() bundle. last_synced_at is
// an epoch-MILLISECONDS number written by the extension (0 or null both mean
// "never synced"); last_cloud_update_at is a server-side ISO timestamp of the
// last write to Supabase, so it is the trustworthy one of the pair.
export type AdminUserListings = {
  total: number;
  by_platform_status: AdminListingBreakdown[];
  last_synced_at: number | null;
  last_cloud_update_at: string | null;
};

// The JSONB bundle returned by admin_user_detail(): everything the Users detail
// drawer needs for one user in a single round-trip. `subscription` is the full
// subscriptions row or null; `is_admin` is the TARGET user's admin status
// (display-only).
export type AdminUserDetail = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  subscription: AdminSubscriptionRow | null;
  usage: AdminUserUsageEntry[];
  ticket_count: number;
  is_admin: boolean;
  linked_accounts: AdminLinkedAccount[];
  // Capped at the 10 most recently active installs by the RPC.
  devices: AdminUserDevice[];
  listings: AdminUserListings;
  // Null when the user has never uploaded (no user_storage row), which is not
  // the same as zero bytes.
  storage_bytes: number | null;
};

// Row from admin_list_storage() (migration 009_admin_console.sql): one
// user_storage gauge row, the running byte total of the user's listing-images
// uploads (maintained by the storage.objects triggers from 004_storage_quota.sql).
export type AdminStorageRow = {
  user_id: string;
  bytes_used: number;
  updated_at: string;
};

// Row from public.admin_audit_log (migration 009_admin_console.sql). Read directly via the
// is_admin() SELECT policy, no RPC.
export type AdminAuditRow = {
  id: string;
  // Null when the admin who performed the action has since been deleted -
  // the row itself is kept indefinitely (docs/GDPR.md), only the actor link
  // is cleared.
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Row from admin_endpoint_health() (migration 010_endpoint_health.sql): one
// marketplace endpoint's call outcomes over the recent window, aggregated
// across all reporting installs. Anonymous by construction - endpoint_health
// carries no user_id, so there is no per-user drill-down here by design.
export type AdminEndpointHealthRow = {
  endpoint_key: string;
  platform: string;
  total_calls: number;
  failures: number;
  // Percent, one decimal. Null when total_calls is 0 (division guarded in SQL).
  failure_rate: number | null;
  // Same rate over the preceding baseline window, excluding the recent window.
  // Null when the endpoint has no history yet (new endpoint, or first days of
  // telemetry) - the UI must treat that as "no baseline", not as zero.
  baseline_rate: number | null;
  installs: number;
  top_status: number | null;
  last_seen: string;
};
