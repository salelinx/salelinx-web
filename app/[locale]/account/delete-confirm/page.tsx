import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DeleteAccountConfirm } from "@/components/DeleteAccountConfirm";

// Step 2 of self-serve account deletion: the landing page for the emailed
// confirmation link (delete-account Edge Function, stage "request"). Requires
// a signed-in session; the Edge Function additionally checks the token was
// minted for the caller, so a leaked link is useless to anyone else.

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function DeleteConfirmPage({
  params,
  searchParams,
}: Props) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "DeleteAccountConfirm" });

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
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
