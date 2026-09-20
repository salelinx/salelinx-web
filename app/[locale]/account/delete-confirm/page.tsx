import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DeleteAccountConfirm } from "@/components/DeleteAccountConfirm";
import { isAuthUnreachable } from "@/lib/supabase/auth-errors";

// Step 2 of self-serve account deletion: the landing page for the emailed
// confirmation link (delete-account Edge Function, stage "request"). Requires
// a signed-in session; the Edge Function additionally checks the token was
// minted for the caller, so a leaked link is useless to anyone else.

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

// Private, token-carrying page: keep it out of search results.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "DeleteAccountConfirm",
  });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function DeleteConfirmPage({
  params,
  searchParams,
}: Props) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "DeleteAccountConfirm" });

  const supabase = await createServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    // A null user because auth was unreachable is NOT a signed-out user.
    // Rethrow so the error boundary can say "we're temporarily down"
    // rather than bouncing a signed-in person to a login page that will
    // not work either. See lib/supabase/auth-errors.ts.
    if (isAuthUnreachable(authError)) throw authError;
    redirect({ href: "/auth/login", locale });
    return null;
  }
  if (!token) {
    redirect({ href: "/account", locale });
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-red-600 dark:text-red-400">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {user.email}
      </p>
      {user.email && <DeleteAccountConfirm token={token} email={user.email} />}
    </main>
  );
}
