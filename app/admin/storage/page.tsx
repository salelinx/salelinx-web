import { createServerClient } from "@/lib/supabase/server";
import { getTierConfigs } from "@/lib/supabase/tier-config";
import { percentOfCap } from "@/lib/admin/usage-caps";
import { formatBytes } from "@/lib/admin/format-bytes";
import type {
  AdminStorageRow,
  AdminUserRow,
  AdminSubscriptionRow,
} from "@/lib/types/admin";
import {
  AdminStorageTable,
  type StorageTableRow,
} from "@/components/admin/storage/AdminStorageTable";

// /admin/storage - per-user cloud storage consumption. The data source is the
// user_storage gauge (migration 004_storage_quota.sql): a running byte total per user for
// the listing-images bucket, maintained by triggers on storage.objects. One
// row per user who has ever uploaded; measured against the
// cloud_storage_bytes cap from their tier config.
//
// Cap semantics differ from the count-based caps: a tier_limits value of null
// means unlimited, while an ABSENT cloud_storage_bytes key means the tier has
// no storage allowance at all (Free/Starter) - shown as "-" with no percent.
//
// Read-only. Bounded at one row per uploading user, so no pagination yet.

export default async function AdminStoragePage() {
  const supabase = await createServerClient();

  // These four reads are independent of each other, so they resolve together
  // rather than in series. Each RPC still re-checks is_admin() server-side.
  const [storageRes, usersRes, subsRes, tiers] = await Promise.all([
    supabase.rpc("admin_list_storage"),
    supabase.rpc("admin_list_users"),
    supabase.rpc("admin_list_subscriptions"),
    getTierConfigs(),
  ]);

  const storage = (storageRes.data as AdminStorageRow[] | null) ?? [];

  // Map each user to their tier so we can resolve caps. Same approach as the
  // Usage module: roster for tier_id, subscriptions for the exact version.
  const users = (usersRes.data as AdminUserRow[] | null) ?? [];
  const tierByUser: Record<string, string> = {};
  for (const u of users) tierByUser[u.user_id] = u.tier_id ?? "free";

  const subs = (subsRes.data as AdminSubscriptionRow[] | null) ?? [];
  const versionByUser: Record<string, number> = {};
  for (const s of subs) versionByUser[s.user_id] = s.tier_version;

  // Resolve emails for the users who have storage rows.
  const emails: Record<string, string> = {};
  const userIds = storage.map((s) => s.user_id);
  if (userIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("admin_user_emails", {
      p_user_ids: userIds,
    });
    for (const row of (emailRows as
      | { user_id: string; email: string }[]
      | null) ?? []) {
      emails[row.user_id] = row.email;
    }
  }

  // Build the table rows (bytes vs cap vs percent) server-side so the client
  // component stays a pure renderer.
  const rows: StorageTableRow[] = storage.map((s) => {
    const tierId = tierByUser[s.user_id] ?? "free";
    const version = versionByUser[s.user_id];
    const tierConfig =
      (version !== undefined &&
        tiers.find((t) => t.tier_id === tierId && t.version === version)) ||
      tiers.find((t) => t.tier_id === tierId) ||
      null;
    // Three states: number = finite cap, null = unlimited, absent key = the
    // tier has no storage allowance (capLabel "-", no percent).
    const rawCap = tierConfig?.limits["cloud_storage_bytes"];
    const cap = rawCap ?? null;
    const capLabel =
      rawCap === undefined ? "-" : rawCap === null ? "unlimited" : formatBytes(rawCap);
    return {
      user_id: s.user_id,
      email: emails[s.user_id] ?? null,
      tier_id: tierId,
      bytes_used: s.bytes_used,
      bytes_label: formatBytes(s.bytes_used),
      cap_label: capLabel,
      percent: percentOfCap(s.bytes_used, cap),
      updated_at: s.updated_at,
    };
  });

  return <AdminStorageTable rows={rows} />;
}
