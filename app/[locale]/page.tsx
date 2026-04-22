import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-20 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        One tool for every Depop & Vinted seller.
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Crosslist, relist, refresh, restock, and answer buyers - across both
        platforms - from a single panel.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pricing"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          See pricing
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Get started
        </Link>
        <Link
          href="/auth/login"
          className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
