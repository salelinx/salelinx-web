import { AdminSkeleton } from "@/components/admin/AdminSkeleton";

export default function Loading() {
  return <AdminSkeleton title="Endpoint health" rows={10} />;
}
