import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { RedeemForm } from "./RedeemForm";

// Landing page for a one-time creator code (migration 021).
//
// Non-localized on purpose, like its sibling app/r/: the codes are handed out
// by name in an English email, so a locale-prefixed route would mean six
// translations of a page twenty-odd people will ever open. proxy.ts lists
// /redeem/ in skipIntl so next-intl does not rewrite it.
//
// The page never says whether an unknown code exists. Redeeming is what
// answers that, through the RPC, which is rate-limited by being one-shot
// rather than by anything here.

const CODE_SHAPE = /^[A-HJ-NP-Z2-9]{8}$/i;

export const metadata: Metadata = {
  title: "Redeem a code | SaleLinx",
  // A code in a URL is a credential. Keep it out of the index.
  robots: { index: false, follow: false },
};

const MONO = "font-mono text-[0.68rem] uppercase tracking-[0.12em]";
const LINK =
  "rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20";

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!CODE_SHAPE.test(code)) notFound();

  const normalised = code.toUpperCase();
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const signedIn = Boolean(auth?.user);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pt-16 pb-24">
      <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>
        Creator code
      </span>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
        {normalised}
      </h1>

      {signedIn ? (
        <>
          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            Redeem this and your account moves onto the plan it carries. No card
            needed, and it will not renew into a charge when it runs out.
          </p>
          <RedeemForm code={normalised} />
        </>
      ) : (
        <>
          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            Create an account or sign in first, then open this link again to
            redeem it. The code stays valid until you do.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Create an account
            </Link>
            <Link href="/auth/login" className={LINK}>
              Sign in
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
