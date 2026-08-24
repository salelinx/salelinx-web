import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { NewTicketForm } from "@/components/support/NewTicketForm";
import { pageMetadata } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Help" });
  return pageMetadata({
    locale,
    path: "/help/support",
    title: t("supportMetaTitle"),
    description: t("supportMetaDescription"),
  });
}

// Contact form (create a ticket) for signed-in users. Ticket tracking lives
// separately at /account/tickets.
//
// Signed-OUT visitors used to be redirected to login, which failed the case
// that matters most: someone who cannot sign in is exactly the person who
// needs support, and bouncing them to the login page is a dead end. They now
// get the email route plus links to the self-serve pages, with signing in
// offered as the better option rather than the only one. The ticket form
// itself still requires an account - it writes a row keyed to a user.
export default async function HelpSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Help" });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("supportTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("supportSignedOutBody")}
        </p>

        <div className="mt-8 rounded-xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="text-lg font-medium tracking-tight">
            {t("supportEmailHeading")}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("supportEmailBody")}
          </p>
          <a
            href="mailto:support@salelinx.com"
            className="mt-4 inline-block rounded-full bg-black px-5 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            support@salelinx.com
          </a>
        </div>

        <div className="mt-6 rounded-xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="text-lg font-medium tracking-tight">
            {t("supportSignInHeading")}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("supportSignInBody")}
          </p>
          <Link
            href="/auth/login"
            className="mt-4 inline-block rounded-full border border-black/10 px-5 py-2 text-sm transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {t("supportSignInCta")}
          </Link>
        </div>

        {/* Most tickets are answered by one of these, and all three are public. */}
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          {t("supportSelfServe")}{" "}
          <Link href="/help/faq" className="underline underline-offset-4">
            {t("supportFaqLink")}
          </Link>
          {", "}
          <Link href="/docs" className="underline underline-offset-4">
            {t("supportDocsLink")}
          </Link>
          {", "}
          <Link href="/docs/status" className="underline underline-offset-4">
            {t("supportStatusLink")}
          </Link>
          .
        </p>
      </main>
    );
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
