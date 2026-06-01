import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/admin";
import type { SupportTicket, SupportReply } from "@/lib/types/support";
import { AdminSupportPanel } from "@/components/support/AdminSupportPanel";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  // Server-side gate. RLS independently blocks admin writes, but non-admins
  // shouldn't see the page at all - send them back to their account.
  if (!(await isAdmin(user.id))) {
    redirect({ href: "/account", locale });
    return null;
  }

  const { data: ticketsData } = await supabase
    .from("support_tickets")
    .select("*")
    .order("updated_at", { ascending: false });
  const tickets = (ticketsData as SupportTicket[] | null) ?? [];

  let replies: SupportReply[] = [];
  if (tickets.length > 0) {
    const { data: repliesData } = await supabase
      .from("support_ticket_replies")
      .select("*")
      .in(
        "ticket_id",
        tickets.map((tk) => tk.id),
      )
      .order("created_at", { ascending: true });
    replies = (repliesData as SupportReply[] | null) ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <AdminSupportPanel
        adminId={user.id}
        initialTickets={tickets}
        initialReplies={replies}
      />
    </main>
  );
}
