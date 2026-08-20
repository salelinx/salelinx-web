import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CookieSettingsButton } from '@/components/CookieConsent';

const MONO =
  'font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-500';

const linkClass =
  'text-zinc-600 transition hover:text-black dark:text-zinc-400 dark:hover:text-white';

export async function Footer() {
  const t = await getTranslations('Footer');
  const year = new Date().getFullYear();

  // bg-background keeps the page's column guides from striping the footer:
  // they stop at the footer's top rule.
  return (
    <footer className="relative border-t border-black/10 bg-background dark:border-white/10">
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
              {t('tagline')}
            </p>
          </div>

          <div>
            <h3 className={MONO}>{t('sectionProduct')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/features#features" className={linkClass}>
                  {t('linkFeatures')}
                </Link>
              </li>
              <li>
                <Link href="/features#pricing" className={linkClass}>
                  {t('linkPricing')}
                </Link>
              </li>
              <li>
                <Link href="/features#roadmap" className={linkClass}>
                  {t('linkRoadmap')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={MONO}>{t('sectionResources')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/help" className={linkClass}>
                  {t('linkHelp')}
                </Link>
              </li>
              <li>
                <Link href="/docs" className={linkClass}>
                  {t('linkDocs')}
                </Link>
              </li>
              <li>
                <Link href="/help/faq" className={linkClass}>
                  {t('linkFaq')}
                </Link>
              </li>
              <li>
                <Link href="/docs/changelog" className={linkClass}>
                  {t('linkChangelog')}
                </Link>
              </li>
              <li>
                <Link href="/docs/status" className={linkClass}>
                  {t('linkStatus')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={MONO}>{t('sectionLegal')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/legal/privacy" className={linkClass}>
                  {t('linkPrivacy')}
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className={linkClass}>
                  {t('linkTerms')}
                </Link>
              </li>
              <li>
                <Link href="/legal/dpa" className={linkClass}>
                  {t('linkDpa')}
                </Link>
              </li>
              <li>
                <Link href="/legal/referral-terms" className={linkClass}>
                  {t('linkReferralTerms')}
                </Link>
              </li>
              <li>
                <CookieSettingsButton />
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-black/5 pt-6 text-xs text-zinc-500 dark:border-white/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('copyright', { year })}</span>
            <span>{t('builtFor')}</span>
          </div>
          <p className="mt-3">{t('companyInfo')}</p>
        </div>
      </div>
    </footer>
  );
}
