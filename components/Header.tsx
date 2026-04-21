import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ThemeToggle";

export async function Header() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          SaleLinx
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/features" className="hover:underline">
            Features
          </Link>
          <Link href="/docs" className="hover:underline">
            Docs
          </Link>
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>

          {user ? (
            <>
              <Link href="/account" className="hover:underline">
                Account
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-black/10 px-4 py-1.5 dark:border-white/20"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hover:underline">
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-full bg-black px-4 py-1.5 text-white dark:bg-white dark:text-black"
              >
                Get started
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
