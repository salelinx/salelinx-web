import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { NewTicketForm } from "@/components/support/NewTicketForm";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Help" });
  return {
    title: t("supportMetaTitle"),
    description: t("supportMetaDescription"),
  };
}

// Login-gated contact form (create a ticket). Logged-out visitors are
// redirected to login. Ticket tracking lives separately at /account/tickets.
export default async function HelpSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Help" });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("supportTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("supportBody")}
        </p>
      </div>

      <NewTicketForm userId={user.id} />
    </main>
  );
}
