'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useHydrated } from '@/lib/use-hydrated';
import {
  type Consent,
  type ConsentState,
  needsChoice,
  parseConsentValue,
  serializeConsent,
} from '@/lib/consent';

// Cookie consent banner + Google tag loader, one component so the "Google
// tags only ever load after consent" invariant lives in a single file.
//
// Two optional categories, consented separately (ICO expects granular
// choice): "analytics" (Google Analytics, NEXT_PUBLIC_GA_MEASUREMENT_ID) and
// "ads" (the Google Ads conversion tag, NEXT_PUBLIC_GOOGLE_ADS_ID, which
// measures whether our own ads on Google brought a visitor here - we
// advertise SaleLinx on Google, we never show ads on salelinx.com).
//
// PECR / UK GDPR requirements implemented here:
// - gtag.js is injected only after at least one category is granted. No
//   consent, no request to googletagmanager.com, no _ga / _gcl cookies.
// - Accept all and Reject all sit on the first layer, same size, with a
//   Manage preferences layer for per-category choice.
// - Consent Mode v2 defaults everything to denied before the library boots;
//   grants are per category. ad_personalization stays DENIED even with ads
//   consent: we measure conversions, we do not build remarketing audiences.
//   Turning remarketing on later needs its own consent category plus a
//   privacy-policy update, not a one-line change here.
// - The choice is stored per category in the slx_consent cookie (itself
//   strictly necessary, so no consent needed to set it) and re-asked after 6
//   months. A visitor who accepted under the older analytics-only banner is
//   asked again before the ads category ever fires (see lib/consent.ts).
// - CookieSettingsButton in the Footer reopens the banner at any time.
//
// The whole feature is gated on the env vars: with neither set (local dev,
// preview) the banner and the settings button do not render and the site
// stays tag-free. With only one set, the other category is hidden.

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const ACTIVE = { analytics: Boolean(GA_ID), ads: Boolean(ADS_ID) };
const ANY_ACTIVE = ACTIVE.analytics || ACTIVE.ads;

const CONSENT_COOKIE = 'slx_consent';
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // re-ask after 6 months
const REOPEN_EVENT = 'slx:cookie-settings';
const GTAG_SCRIPT_ID = 'ga-gtag';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function readConsentCookie(): ConsentState {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return parseConsentValue(raw);
}

function writeConsentCookie(state: ConsentState) {
  // Secure only over https so local dev over plain http still works.
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(state)}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
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

// Products already passed to gtag('config', ...): config is only issued for
// granted products, once each, so a denied category's tag never initializes.
const configured = new Set<string>();

function expireCookies(matches: (name: string) => boolean) {
  // Best-effort cleanup for a visitor withdrawing consent: expire matching
  // cookies on both the exact host and the registrable domain (Google sets
  // them on the latter).
  const domains = ['', `; domain=${location.hostname}`, `; domain=.${location.hostname.split('.').slice(-2).join('.')}`];
  document.cookie
    .split('; ')
    .map((c) => c.split('=')[0])
    .filter(matches)
    .forEach((name) => {
      domains.forEach((domain) => {
        document.cookie = `${name}=; path=/; max-age=0${domain}`;
      });
    });
}

// Single place that turns a stored choice into gtag state. Safe to call
// repeatedly (page loads, later changes of mind in the settings layer).
function applyConsent(state: ConsentState) {
  const analytics: boolean = Boolean(GA_ID) && state.analytics === 'granted';
  const ads: boolean = Boolean(ADS_ID) && state.ads === 'granted';

  if (analytics || ads) {
    ensureGtag();
    if (!document.getElementById(GTAG_SCRIPT_ID)) {
      // Consent Mode v2: declare defaults before the library boots.
      window.gtag!('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      window.gtag!('js', new Date());
    }
  }

  if (window.gtag) {
    const consentOf = (granted: boolean): Consent => (granted ? 'granted' : 'denied');
    window.gtag('consent', 'update', {
      analytics_storage: consentOf(analytics),
      ad_storage: consentOf(ads),
      ad_user_data: consentOf(ads),
      // Conversion measurement only, never remarketing (see header comment).
      ad_personalization: 'denied',
    });
  }

  if (analytics && GA_ID && !configured.has(GA_ID)) {
    window.gtag!('config', GA_ID);
    configured.add(GA_ID);
  }
  if (ads && ADS_ID && !configured.has(ADS_ID)) {
    window.gtag!('config', ADS_ID);
    configured.add(ADS_ID);
  }

  if ((analytics || ads) && !document.getElementById(GTAG_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GTAG_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID ?? ADS_ID}`;
    document.head.appendChild(script);
  }

  if (!analytics) expireCookies((n) => n === '_ga' || n.startsWith('_ga_'));
  if (!ads) expireCookies((n) => n.startsWith('_gcl'));
}

export function CookieConsent() {
  const hydrated = useHydrated();
  // Lazily read the stored choice in the initializer (SSR returns false via
  // the typeof-document guard); rendering is gated on `hydrated` below so the
  // banner appears without a mount-effect setState or a hydration mismatch.
  const [open, setOpen] = useState<boolean>(
    () => typeof document !== 'undefined' && needsChoice(readConsentCookie(), ACTIVE),
  );
  const [manage, setManage] = useState(false);
  const [toggles, setToggles] = useState<{ analytics: boolean; ads: boolean }>(
    () => {
      if (typeof document === 'undefined') return { analytics: false, ads: false };
      const stored = readConsentCookie();
      return {
        analytics: stored.analytics === 'granted',
        ads: stored.ads === 'granted',
      };
    },
  );
  const t = useTranslations('CookieBanner');

  useEffect(() => {
    if (!ANY_ACTIVE) return;
    applyConsent(readConsentCookie());

    // The footer's Cookie settings button reopens the banner straight on the
    // preferences layer, current choices pre-filled.
    const reopen = () => {
      const stored = readConsentCookie();
      setToggles({
        analytics: stored.analytics === 'granted',
        ads: stored.ads === 'granted',
      });
      setManage(true);
      setOpen(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  if (!ANY_ACTIVE || !hydrated || !open) return null;

  function decide(analytics: boolean, ads: boolean) {
    const previous = readConsentCookie();
    const next: ConsentState = {
      // Only active categories get an answer; an inactive one keeps whatever
      // was stored so a temporarily unset env var does not erase a choice.
      analytics: ACTIVE.analytics ? (analytics ? 'granted' : 'denied') : previous.analytics,
      ads: ACTIVE.ads ? (ads ? 'granted' : 'denied') : previous.ads,
    };
    writeConsentCookie(next);
    applyConsent(next);
    setOpen(false);
    setManage(false);
  }

  // ICO expects Accept all and Reject all to be equally prominent, so the
  // buttons deliberately share the same style.
  const buttonClass =
    'rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200';

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-black/10 bg-white/90 p-4 shadow-2xl shadow-black/10 backdrop-blur-md motion-safe:animate-[popIn_0.45s_ease-out] dark:border-white/15 dark:bg-zinc-900/90 dark:shadow-black/40"
    >
      <h2 className="text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
        {t('title')}
      </h2>

      {manage ? (
        <div className="mt-3 space-y-3 text-start">
          <ConsentRow
            label={t('essentialLabel')}
            description={t('essentialDesc')}
            checked
            disabled
          />
          {ACTIVE.analytics ? (
            <ConsentRow
              label={t('analyticsLabel')}
              description={t('analyticsDesc')}
              checked={toggles.analytics}
              onChange={(v) => setToggles((s) => ({ ...s, analytics: v }))}
            />
          ) : null}
          {ACTIVE.ads ? (
            <ConsentRow
              label={t('adsLabel')}
              description={t('adsDesc')}
              checked={toggles.ads}
              onChange={(v) => setToggles((s) => ({ ...s, ads: v }))}
            />
          ) : null}
          <button
            type="button"
            onClick={() => decide(toggles.analytics, toggles.ads)}
            className={`${buttonClass} w-full`}
          >
            {t('save')}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-center text-sm leading-snug text-zinc-600 dark:text-zinc-400">
            {t(ACTIVE.ads ? 'bodyWithAds' : 'body')}{' '}
            <Link
              href="/legal/privacy#cookies"
              className="underline underline-offset-2 transition hover:text-black dark:hover:text-white"
            >
              {t('privacyLink')}
            </Link>
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => decide(true, true)} className={buttonClass}>
              {t('acceptAll')}
            </button>
            <button type="button" onClick={() => decide(false, false)} className={buttonClass}>
              {t('rejectAll')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setManage(true)}
            className="mt-2 w-full text-center text-sm text-zinc-600 underline underline-offset-2 transition hover:text-black dark:text-zinc-400 dark:hover:text-white"
          >
            {t('manage')}
          </button>
        </>
      )}
    </div>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-3 ${disabled ? '' : 'cursor-pointer'}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-black dark:accent-white"
      />
    </label>
  );
}

export function CookieSettingsButton() {
  const t = useTranslations('CookieBanner');
  if (!ANY_ACTIVE) return null;
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
