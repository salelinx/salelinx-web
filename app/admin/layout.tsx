import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { redirect } from "next/navigation";
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
  // an AAL2 session (migration 009), mirroring the check below.
  let adminEmail = "";
  try {
    // These lookups are memoized per request (lib/admin/session.ts), so the
    // pages underneath re-use them instead of re-querying. Same three checks,
    // same order, same fail-closed behaviour - only the duplicate execution is
    // gone.
    const user = await getAdminUser();

    if (!user) {
      redirect("/auth/login");
    }
    // Membership and AAL are independent of each other, so they can resolve
    // together; both must pass and either one failing still denies below.
    const [admin, isAal2] = await Promise.all([isAdmin(user.id), getIsAal2()]);
    if (!admin) {
      redirect("/account");
    }
    if (!isAal2) {
      redirect("/auth/mfa?next=/admin");
    }
    adminEmail = user.email ?? "";
  } catch (err) {
    // redirect() throws NEXT_REDIRECT; let that propagate. Any OTHER error is
    // treated as a denial (fail-closed) rather than rendering admin content.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    redirect("/account");
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
