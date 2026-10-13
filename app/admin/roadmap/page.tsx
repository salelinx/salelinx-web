import { getRoadmapItemsForAdmin } from "@/lib/roadmap/data";
import { AdminRoadmap } from "@/components/admin/roadmap/AdminRoadmap";

// /admin/roadmap - edit the public roadmap at the bottom of the homepage.
// Reads roadmap_items with the admin's own session (the admin RLS policy adds
// hidden drafts to what the public sees); writes go through the
// admin_*_roadmap_item* SECURITY DEFINER RPCs (migration 032_roadmap_items.sql),
// which re-check is_admin() and write the audit entry themselves.

export default async function AdminRoadmapPage() {
  const { items, error } = await getRoadmapItemsForAdmin();
  return <AdminRoadmap items={items} error={error} />;
}
