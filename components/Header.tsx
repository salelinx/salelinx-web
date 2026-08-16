import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MobileMenu } from '@/components/MobileMenu';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';

export async function Header() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

          {user ? (
            <>
              <Link
                href="/help"
                className="hidden hover:text-black hover:underline md:inline dark:hover:text-white"
              >
                {t('support')}
              </Link>
              <Link
                href="/account"
                className="hover:text-black hover:underline dark:hover:text-white"
              >
                {t('account')}
              </Link>
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
              <Link
                href="/auth/login"
                className="hover:text-black hover:underline dark:hover:text-white"
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
          isAuthed={!!user}
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
