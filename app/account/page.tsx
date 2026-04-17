import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";

export default async function AccountPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const unverified = !user.email_confirmed_at;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your account
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-full border border-black/10 px-4 py-2 text-sm dark:border-white/20"
          >
            Sign out
          </button>
        </form>
      </div>

      {unverified && user.email && (
        <div className="mt-8">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}

      <section className="mt-10 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold">Current plan</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          TODO: fetch subscription from Supabase and render tier + usage meters.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold">Manage subscription</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          TODO: button that POSTs to the create-portal-session Edge Function.
        </p>
      </section>
    </main>
  );
}
