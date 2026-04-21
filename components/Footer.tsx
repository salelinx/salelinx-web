import Link from 'next/link';

const MONO =
  'font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-500';

const linkClass =
  'text-zinc-600 transition hover:text-black dark:text-zinc-400 dark:hover:text-white';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight"
            >
              SaleLinx
            </Link>
            <p className="mt-3 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
              Sell across Depop and Vinted from one place.
            </p>
          </div>

          <div>
            <h3 className={MONO}>Product</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/features" className={linkClass}>
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={linkClass}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className={linkClass}>
                  Roadmap
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={MONO}>Resources</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/docs" className={linkClass}>
                  Docs
                </Link>
              </li>
              <li>
                <Link href="/faq" className={linkClass}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/docs/changelog" className={linkClass}>
                  Changelog
                </Link>
              </li>
              <li>
                <Link href="/docs/status" className={linkClass}>
                  Marketplace status
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={MONO}>Legal</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/legal/privacy" className={linkClass}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className={linkClass}>
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-6 text-xs text-zinc-500 dark:border-white/5">
          <span>&copy; {year} SaleLinx. All rights reserved.</span>
          <span>Built for Depop and Vinted sellers.</span>
        </div>
      </div>
    </footer>
  );
}
