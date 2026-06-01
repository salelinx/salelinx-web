import { redirect } from "next/navigation";

// /admin has no landing content yet; the first module is support. When a
// dashboard home exists, render it here instead of redirecting.
export default function AdminIndexPage() {
  redirect("/admin/support");
}
