'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useHydrated } from '@/lib/use-hydrated';

// Cookie consent banner + Google Analytics loader, one component so the
// "GA only ever loads after consent" invariant lives in a single file.
//
// PECR / UK GDPR requirements implemented here:
// - gtag.js is injected only after the visitor clicks Accept. No consent,
//   no request to googletagmanager.com, no _ga cookies.
// - Reject is on the first layer, same size as Accept.
// - The choice is stored in the slx_consent cookie (itself strictly
//   necessary, so no consent needed to set it) and re-asked after 6 months.
// - CookieSettingsButton in the Footer reopens the banner at any time.
//
// The whole feature is gated on NEXT_PUBLIC_GA_MEASUREMENT_ID: when the env
// var is unset (local dev, preview without analytics) neither the banner nor
// the settings button renders and the site stays analytics-free.

type Consent = 'granted' | 'denied';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const CONSENT_COOKIE = 'slx_consent';
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // re-ask after 6 months
const REOPEN_EVENT = 'slx:cookie-settings';
const GA_SCRIPT_ID = 'ga-gtag';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function readConsentCookie(): Consent | null {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.split('=')[1];
  return raw === 'granted' || raw === 'denied' ? raw : null;
}

function writeConsentCookie(value: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax`;
}

function ensureGtag() {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag requires the Arguments object itself; pushing a rest-array breaks
    // command parsing inside gtag.js.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
}

function loadGoogleAnalytics(id: string) {
  ensureGtag();
  if (document.getElementById(GA_SCRIPT_ID)) {
    window.gtag!('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  // Consent Mode v2: declare defaults before the library boots, then grant
  // analytics only. Ads storage stays denied; we do not run ads.
  window.gtag!('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
  window.gtag!('js', new Date());
  window.gtag!('consent', 'update', { analytics_storage: 'granted' });
  window.gtag!('config', id);

  const script = document.createElement('script');
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
}

function disableGoogleAnalytics() {
  // Best-effort cleanup for a visitor who previously accepted: tell an
  // already-loaded gtag to stop, and expire GA's cookies on both the exact
  // host and the registrable domain (GA sets them on the latter).
  if (window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  const domains = ['', `; domain=${location.hostname}`, `; domain=.${location.hostname.split('.').slice(-2).join('.')}`];
  document.cookie
    .split('; ')
    .map((c) => c.split('=')[0])
    .filter((name) => name === '_ga' || name.startsWith('_ga_'))
    .forEach((name) => {
      domains.forEach((domain) => {
        document.cookie = `${name}=; path=/; max-age=0${domain}`;
      });
    });
}

export function CookieConsent() {
  const hydrated = useHydrated();
  // Lazily read the stored choice in the initializer (SSR returns false via
  // the typeof-document guard); rendering is gated on `hydrated` below so the
  // banner appears without a mount-effect setState or a hydration mismatch.
  const [open, setOpen] = useState<boolean>(
    () => typeof document !== 'undefined' && readConsentCookie() === null,
  );
  const t = useTranslations('CookieBanner');

  useEffect(() => {
    if (!GA_ID) return;
    if (readConsentCookie() === 'granted') loadGoogleAnalytics(GA_ID);

    const reopen = () => setOpen(true);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  if (!GA_ID || !hydrated || !open) return null;

  function accept() {
    writeConsentCookie('granted');
    loadGoogleAnalytics(GA_ID!);
    setOpen(false);
  }

  function reject() {
    writeConsentCookie('denied');
    disableGoogleAnalytics();
    setOpen(false);
  }

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/15 dark:bg-zinc-900"
    >
      <h2 className="text-sm font-semibold">{t('title')}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t('body')}{' '}
        <Link
          href="/legal/privacy"
          className="underline underline-offset-2 hover:text-black dark:hover:text-white"
        >
          {t('privacyLink')}
        </Link>
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={accept}
          className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {t('accept')}
        </button>
        <button
          type="button"
          onClick={reject}
          className="flex-1 rounded-full border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
        >
          {t('reject')}
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  const t = useTranslations('CookieBanner');
  if (!GA_ID) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REOPEN_EVENT))}
      className="text-zinc-600 transition hover:text-black dark:text-zinc-400 dark:hover:text-white"
    >
      {t('settings')}
    </button>
  );
}
