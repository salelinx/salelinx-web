'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface Labels {
  navFeatures: string;
  navPricing: string;
  navRoadmap: string;
  navFaq: string;
  navDocs: string;
  account: string;
  support: string;
  signOut: string;
  signIn: string;
  getStarted: string;
  openMenu: string;
  closeMenu: string;
}

interface Props {
  isAuthed: boolean;
  labels: Labels;
}

export function MobileMenu({ isAuthed, labels }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const linkClass =
    'block rounded-md px-3 py-2.5 text-base font-medium text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.06]';

  return (
    <>
      <button
        type="button"
        aria-label={open ? labels.closeMenu : labels.openMenu}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-zinc-900 transition hover:bg-black/[0.04] sm:hidden dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {open ? (
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
          />
          <div
            id="mobile-menu-panel"
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 top-[57px] z-50 origin-top border-b border-black/10 bg-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.4)] sm:hidden dark:border-white/10 dark:bg-zinc-950"
            style={{ animation: 'tabSlideIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
          >
            <nav className="flex flex-col gap-1 p-4">
              <Link href="/#features" className={linkClass}>
                {labels.navFeatures}
              </Link>
              <Link href="/#pricing" className={linkClass}>
                {labels.navPricing}
              </Link>
              <Link href="/features#roadmap" className={linkClass}>
                {labels.navRoadmap}
              </Link>
              <Link href="/faq" className={linkClass}>
                {labels.navFaq}
              </Link>
              <Link href="/docs" className={linkClass}>
                {labels.navDocs}
              </Link>

              <div className="mt-2 border-t border-black/[0.06] pt-3 dark:border-white/10">
                {isAuthed ? (
                  <div className="flex flex-col gap-2">
                    <Link href="/account/support" className={linkClass}>
                      {labels.support}
                    </Link>
                    <Link href="/account" className={linkClass}>
                      {labels.account}
                    </Link>
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        className="w-full rounded-md border border-black/10 px-3 py-2.5 text-base font-medium dark:border-white/15"
                      >
                        {labels.signOut}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/auth/login"
                      className="rounded-md border border-black/10 px-3 py-2.5 text-center text-base font-medium dark:border-white/15"
                    >
                      {labels.signIn}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="rounded-md bg-zinc-900 px-3 py-2.5 text-center text-base font-medium text-white dark:bg-white dark:text-zinc-900"
                    >
                      {labels.getStarted}
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 dark:border-white/10">
                <LanguageSwitcher />
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
