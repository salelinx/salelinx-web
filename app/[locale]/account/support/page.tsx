import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { SupportTicket, SupportReply } from "@/lib/types/support";
import { SupportClient } from "@/components/support/SupportClient";

type Props = {
  params: Promise<{ locale: string }>;
};

async function fetchReplies(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  ticketIds: string[],
): Promise<SupportReply[]> {
  if (ticketIds.length === 0) return [];
  const { data } = await supabase
    .from("support_ticket_replies")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true });
  return (data as SupportReply[] | null) ?? [];
}

export default async function AccountSupportPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Support" });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  // The user's own tickets. RLS scopes the SELECT to their own rows. Staff
  // manage every ticket on the separate /admin route.
  const { data: myTicketsData } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  const myTickets = (myTicketsData as SupportTicket[] | null) ?? [];
  const myReplies = await fetchReplies(
    supabase,
    myTickets.map((tk) => tk.id),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <SupportClient
        userId={user.id}
        initialTickets={myTickets}
        initialReplies={myReplies}
      />
    </main>
  );
}
