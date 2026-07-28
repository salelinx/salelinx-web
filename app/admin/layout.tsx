import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/admin";
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
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      redirect("/auth/login");
    }
    if (!(await isAdmin(user.id))) {
      redirect("/account");
    }
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
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
