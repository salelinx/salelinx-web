import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/supabase/admin";
import { getAdminUser, getIsAal2 } from "@/lib/admin/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import "./admin.css";

// Top-level, non-localized admin console. It is a SIBLING of app/[locale]/ so
// it owns its own <html>/<body> and escapes the marketing Header/Footer and the
// dark marketing theme entirely. English-only by design (internal tool).

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Admin - SaleLinx",
  // Internal tool: keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layer 2 of the gate (see docs/ADMIN.md). The middleware (Layer 1) already
  // blocks non-admins before this renders; we re-check here, fail-closed, so a
  // missed matcher or bypassed middleware still denies. RLS (Layer 3) is the
  // real boundary for every read/write underneath: is_admin() also requires
  // an AAL2 session (is_admin(), 003_support.sql), mirroring the check below.
  //
  // Signed out, not an admin, or any error: 404, matching Layer 1, so the
  // console does not exist for anyone who is not on admin_users. Only a real
  // admin who has not yet entered their authenticator code gets a redirect,
  // to the MFA challenge. The decision is computed inside the try and acted
  // on outside it, so the catch never has to tell Next's own control-flow
  // throws (redirect / notFound) apart from a genuine failure.
  let adminEmail = "";
  let decision: "not-found" | "mfa" | "ok" = "not-found";
  try {
    // These lookups are memoized per request (lib/admin/session.ts), so the
    // pages underneath re-use them instead of re-querying.
    const user = await getAdminUser();
    if (user) {
      // Membership and AAL are independent of each other, so they can resolve
      // together; both must pass.
      const [admin, isAal2] = await Promise.all([
        isAdmin(user.id),
        getIsAal2(),
      ]);
      if (admin) {
        decision = isAal2 ? "ok" : "mfa";
        adminEmail = user.email ?? "";
      }
    }
  } catch {
    decision = "not-found";
  }
  if (decision === "not-found") {
    notFound();
  }
  if (decision === "mfa") {
    redirect("/auth/mfa?next=/admin");
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <AdminSidebar adminEmail={adminEmail} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
