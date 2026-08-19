import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MobileMenu } from '@/components/MobileMenu';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import { HelpMenu } from '@/components/HelpMenu';

export async function Header() {
  const supabase = await createServerClient();
  // Local JWT verification (getClaims) instead of getUser(): the Header only
  // needs "is someone signed in", and getUser() costs a network round-trip to
  // Supabase Auth on every page view. proxy.ts handles token refresh.
  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthed = Boolean(claimsData?.claims);
  const t = await getTranslations('Header');

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/75 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-950/75 dark:supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="flex w-full items-end gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-1 items-center sm:flex-1">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo with dark:invert; next/image adds no value here */}
            <img
              src="/salelinx-logo.png"
              alt=""
              aria-hidden="true"
              width={20}
              height={28}
              className="relative -top-0.5 h-7 w-auto object-contain dark:invert"
            />
            <span className="text-base font-semibold tracking-tight">SaleLinx</span>
          </Link>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-6 text-[0.9375rem] font-medium tracking-tight md:flex md:gap-8">
          <Link
            href="/#features"
            className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            {t('navFeatures')}
          </Link>
          <Link
            href="/#pricing"
            className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            {t('navPricing')}
          </Link>
          <Link
            href="/features#roadmap"
            className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            {t('navRoadmap')}
          </Link>
        </nav>

        <nav className="hidden flex-1 items-center justify-end gap-4 text-sm text-zinc-600 sm:flex dark:text-zinc-400">
          <InstallExtensionButton
            label={t('addToChrome')}
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/10 md:inline-flex dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
          />

          {isAuthed ? (
            <>
              <div className="group relative hidden md:block">
                <Link
                  href="/help"
                  className="transition-colors duration-200 hover:text-black dark:hover:text-white"
                >
                  {t('support')}
                </Link>
                <HelpMenu
                  labels={{
                    faq: t('navFaq'),
                    docs: t('navDocs'),
                    status: t('navStatus'),
                    contact: t('supportContact'),
                  }}
                />
              </div>
              <div className="group relative">
                <Link
                  href="/account"
                  className="transition-colors duration-200 hover:text-black dark:hover:text-white"
                >
                  {t('account')}
                </Link>
                {/* pt-2 keeps the hover area contiguous between trigger and panel */}
                <div className="invisible absolute left-1/2 top-full -translate-x-1/2 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <div className="w-52 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-900">
                    {(
                      [
                        ['#plan', t('accountPlan')],
                        ['#security', t('accountSecurity')],
                        ['#referrals', t('accountReferrals')],
                        ['#support', t('accountSupport')],
                        ['#danger', t('accountDanger')],
                      ] as const
                    ).map(([hash, label]) => (
                      <Link
                        key={hash}
                        href={`/account${hash}`}
                        className="block rounded-lg px-3 py-2 text-zinc-700 hover:bg-black/5 hover:text-black dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-black/10 px-4 py-1.5 transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  {t('signOut')}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Support is reachable signed OUT too: someone who cannot log
                  in is exactly the person who needs it, and /help/support
                  itself redirects to login. */}
              <div className="group relative hidden md:block">
                <Link
                  href="/help"
                  className="transition-colors duration-200 hover:text-black dark:hover:text-white"
                >
                  {t('support')}
                </Link>
                <HelpMenu
                  labels={{
                    faq: t('navFaq'),
                    docs: t('navDocs'),
                    status: t('navStatus'),
                    contact: t('supportContact'),
                  }}
                />
              </div>
              <Link
                href="/auth/login"
                className="transition-colors duration-200 hover:text-black dark:hover:text-white"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-full bg-black px-4 py-1.5 text-white dark:bg-white dark:text-black"
              >
                {t('getStarted')}
              </Link>
            </>
          )}
          <LanguageSwitcher />
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <LanguageSwitcher />
        </div>

        <MobileMenu
          isAuthed={isAuthed}
          labels={{
            navFeatures: t('navFeatures'),
            navPricing: t('navPricing'),
            navRoadmap: t('navRoadmap'),
            navFaq: t('navFaq'),
            navDocs: t('navDocs'),
            account: t('account'),
            support: t('support'),
            signOut: t('signOut'),
            signIn: t('signIn'),
            getStarted: t('getStarted'),
            addToChrome: t('addToChrome'),
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
          }}
        />
      </div>
    </header>
  );
}
