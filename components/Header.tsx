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
      <div className="flex w-full items-center px-6 py-4">
        <div className="flex-1">
          <Link href="/" className="text-base font-semibold tracking-tight">
            SaleLinx
          </Link>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-8 text-[0.9375rem] font-medium tracking-tight">
          <Link
            href="/features#features"
            className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Features
          </Link>
          <Link
            href="/features#pricing"
            className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Pricing
          </Link>
          <Link
            href="/features#roadmap"
            className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Roadmap
          </Link>
        </nav>

        <nav className="flex flex-1 items-center justify-end gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/faq" className="hover:text-black hover:underline dark:hover:text-white">
            FAQ
          </Link>
          <Link href="/docs" className="hover:text-black hover:underline dark:hover:text-white">
            Docs
          </Link>

          {user ? (
            <>
              <Link href="/account" className="hover:text-black hover:underline dark:hover:text-white">
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
              <Link href="/auth/login" className="hover:text-black hover:underline dark:hover:text-white">
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
