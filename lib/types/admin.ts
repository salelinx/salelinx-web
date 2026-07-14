// Shapes for the read-only admin console modules (Users, Subscriptions, Usage,
// Audit log). These mirror the return types of the admin_* RPCs in migration
// 029 (and the admin_audit_log table from 027). Read-only: there are no
// mutation payloads here.

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
};

// Row from admin_list_storage() (migration 006_admin_console.sql): one
// user_storage gauge row, the running byte total of the user's listing-images
// uploads (maintained by the storage.objects triggers from 004_storage_quota.sql).
export type AdminStorageRow = {
  user_id: string;
  bytes_used: number;
  updated_at: string;
};

// Row from public.admin_audit_log (migration 006_admin_console.sql). Read directly via the
// is_admin() SELECT policy, no RPC.
export type AdminAuditRow = {
  id: string;
  actor_id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
