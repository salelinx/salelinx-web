import { getAnnouncementsForAdmin } from "@/lib/announcements/data";
import { AdminAnnouncements } from "@/components/admin/announcements/AdminAnnouncements";

// /admin/announcements - messages shown in users' SaleLinx extension.
// Reads announcements with the admin's own session (its only RLS policy is the
// is_admin() one); writes go through the admin_*_announcement SECURITY DEFINER
// RPCs (migration 060_announcements.sql), which re-check is_admin() and write
// the audit entry themselves. The extension reads active_announcements() and
// is pushed by the announcement_signal counter those writes bump.

export default async function AdminAnnouncementsPage() {
  const { announcements, now, error } = await getAnnouncementsForAdmin();
  return <AdminAnnouncements announcements={announcements} now={now} error={error} />;
}
