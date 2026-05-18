import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MobileMenu } from '@/components/MobileMenu';

export async function Header() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations('Header');

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/75 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-950/75 dark:supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-1 items-center sm:flex-1">
          <Link href="/" className="inline-flex items-center gap-2">
            <img
              src="/salelinx-logo.png"
              alt=""
              aria-hidden="true"
              width={20}
              height={28}
              className="h-7 w-auto object-contain dark:invert"
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
          <Link
            href="/faq"
            className="hidden hover:text-black hover:underline md:inline dark:hover:text-white"
          >
            {t('navFaq')}
          </Link>
          <Link
            href="/docs"
            className="hidden hover:text-black hover:underline md:inline dark:hover:text-white"
          >
            {t('navDocs')}
          </Link>

          {user ? (
            <>
              <Link
                href="/account"
                className="hover:text-black hover:underline dark:hover:text-white"
              >
                {t('account')}
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-black/10 px-4 py-1.5 dark:border-white/20"
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
          <ThemeToggle />
        </nav>

        <MobileMenu
          isAuthed={!!user}
          labels={{
            navFeatures: t('navFeatures'),
            navPricing: t('navPricing'),
            navRoadmap: t('navRoadmap'),
            navFaq: t('navFaq'),
            navDocs: t('navDocs'),
            account: t('account'),
            signOut: t('signOut'),
            signIn: t('signIn'),
            getStarted: t('getStarted'),
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
          }}
        />
      </div>
    </header>
  );
}
