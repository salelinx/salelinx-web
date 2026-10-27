'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { BlockingWall } from '@/components/BlockingWall';
import { setStatsOptOut, statsOptedOut } from '@/components/SiteStats';
import { useHydrated } from '@/lib/use-hydrated';
import {
  type Consent,
  type ConsentState,
  isConsentWallExempt,
  needsChoice,
  parseConsentValue,
  serializeConsent,
} from '@/lib/consent';
import { captureSignupSource, clearSignupSource } from '@/lib/signup-source';

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
// - Accept all and Reject all sit side by side in the same style, so saying no
//   is as easy as saying yes. "Choose" opens a switch per category and Save
//   choices in the same card. The optional switches start OFF: a pre-ticked
//   box is not consent (CJEU Planet49, and the ICO says the same), so never
//   default one to on.
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
// - In the UK/EEA/CH (/api/geo) the first choice is a wall: the page is
//   blurred and inert until the visitor picks. It waits for their first
//   scroll, click or key, or WALL_DELAY_MS, so they see the page first. It forces a choice, never
//   acceptance: Reject all is exactly as prominent as Accept all, which keeps
//   it on the right side of the ICO's cookie wall guidance. The legal pages
//   are exempt so the policy it links to stays readable. Elsewhere, and on a
//   Footer reopen, it is a corner card that leaves the page usable.
//   No close button either way.
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
// Fired when the wall's state may have changed, so MarketingChoicePrompt can
// wait its turn: two BlockingWalls would make each other inert.
export const COOKIE_WALL_EVENT = 'slx:cookie-wall';
let geoAutomatic: boolean | null = null;
const WALL_DELAY_MS = 5000;

// Whether the cookie wall is up or may still go up. Client-only.
export function cookieWallPending(): boolean {
  return ANY_ACTIVE && geoAutomatic !== true && needsChoice(readConsentCookie(), ACTIVE);
}

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

  if (analytics || ads) captureSignupSource();
  else clearSignupSource();

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
  // The first answer, as opposed to a Footer reopen, which never walls.
  const [required, setRequired] = useState(open);
  const [automatic, setAutomatic] = useState(geoAutomatic);
  const [armed, setArmed] = useState(false);
  // Open on a Footer reopen: that visitor came to change a choice.
  const [choosing, setChoosing] = useState(false);
  const [toggles, setToggles] = useState<{ analytics: boolean; ads: boolean; stats: boolean }>(
    () => {
      if (typeof document === 'undefined') return { analytics: false, ads: false, stats: true };
      const stored = readConsentCookie();
      return {
        analytics: stored.analytics === 'granted',
        ads: stored.ads === 'granted',
        stats: !statsOptedOut(),
      };
    },
  );
  const t = useTranslations('CookieBanner');
  const pathname = usePathname();

  useEffect(() => {
    if (!ANY_ACTIVE) return;
    applyConsent(readConsentCookie());

    if (geoAutomatic === null && needsChoice(readConsentCookie(), ACTIVE)) {
      fetch('/api/geo', { cache: 'no-store' })
        .then((r) => r.json())
        .then(({ automatic: a }) => a === true)
        .catch(() => false)
        .then((a) => {
          geoAutomatic = a;
          setAutomatic(a);
          window.dispatchEvent(new Event(COOKIE_WALL_EVENT));
        });
    }

    // The footer's Cookie settings button reopens the banner with the current
    // choices pre-filled.
    const reopen = () => {
      const stored = readConsentCookie();
      setToggles({
        analytics: stored.analytics === 'granted',
        ads: stored.ads === 'granted',
        stats: !statsOptedOut(),
      });
      setChoosing(true);
      setOpen(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  const blocking = required && automatic === false && !isConsentWallExempt(pathname);

  useEffect(() => {
    if (!blocking || armed) return;
    const arm = () => setArmed(true);
    const events = ['scroll', 'pointerdown', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, arm, { once: true, passive: true }));
    const timer = setTimeout(arm, WALL_DELAY_MS);
    return () => {
      events.forEach((e) => window.removeEventListener(e, arm));
      clearTimeout(timer);
    };
  }, [blocking, armed]);

  if (!ANY_ACTIVE || !hydrated || !open || (required && automatic === null)) return null;
  if (blocking && !armed) return null;

  // Stats is not a consent category, so Reject all leaves it as the switch
  // shows rather than turning it off.
  function decide(analytics: boolean, ads: boolean, stats: boolean) {
    setStatsOptOut(!stats);
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
    setRequired(false);
    setChoosing(false);
    window.dispatchEvent(new Event(COOKIE_WALL_EVENT));
  }

  // ICO expects Accept all and Reject all to be equally prominent, so the
  // buttons deliberately share the same style.
  const buttonClass = blocking
    ? 'rounded-full bg-black px-4 py-3 text-base font-medium text-white transition hover:bg-zinc-800'
    : 'rounded-full border border-black/15 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-900 transition hover:border-black/30 hover:bg-zinc-50';
  const textSize = blocking ? 'text-base' : 'text-[13px]';
  const linkClass =
    'font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition hover:decoration-zinc-900';

  const card = (
    <div
      // Inside the wall the dialog role sits on BlockingWall instead.
      role={blocking ? undefined : 'region'}
      aria-label={blocking ? undefined : t('title')}
      className={
        blocking
          ? 'm-auto w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl shadow-black/20 motion-safe:animate-[popIn_0.45s_ease-out] sm:p-8'
          : 'fixed inset-x-2 bottom-2 z-50 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-black/10 bg-white/95 p-3.5 shadow-lg shadow-black/[0.08] backdrop-blur-md motion-safe:animate-[popIn_0.6s_ease-out_1s_backwards] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px]'
      }
    >
      {blocking ? (
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-zinc-900">{t('title')}</h2>
      ) : null}
      <p className={`${textSize} leading-snug text-zinc-600`}>
        {t('body')}
      </p>
      <p className={`mt-1.5 ${textSize} leading-snug text-zinc-400`}>
        <Link href="/legal/privacy#cookies" className={linkClass}>
          {t('privacyLink')}
        </Link>
        {choosing ? null : (
          <>
            {' · '}
            <button type="button" onClick={() => setChoosing(true)} className={linkClass}>
              {t('choose')}
            </button>
          </>
        )}
      </p>

      {choosing ? (
        <div className="mt-3 divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.08] bg-zinc-50/80">
          <ConsentRow
            label={t('essentialLabel')}
            description={t('essentialDesc')}
            alwaysOn={t('alwaysOn')}
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
          <ConsentRow
            label={t('statsLabel')}
            description={t('statsDesc')}
            checked={toggles.stats}
            onChange={(v) => setToggles((s) => ({ ...s, stats: v }))}
          />
        </div>
      ) : null}

      <div className={`grid grid-cols-2 ${blocking ? 'mt-6 gap-3' : 'mt-3 gap-2'}`}>
        <button type="button" onClick={() => decide(false, false, toggles.stats)} className={buttonClass}>
          {t('rejectAll')}
        </button>
        <button type="button" onClick={() => decide(true, true, true)} className={buttonClass}>
          {t('acceptAll')}
        </button>
      </div>
      {choosing ? (
        <button
          type="button"
          onClick={() => decide(toggles.analytics, toggles.ads, toggles.stats)}
          className="mt-2 w-full rounded-full px-3 py-1.5 text-[13px] font-medium text-zinc-600 transition hover:bg-black/[0.04] hover:text-zinc-900"
        >
          {t('save')}
        </button>
      ) : null}
    </div>
  );

  return blocking ? <BlockingWall label={t('title')}>{card}</BlockingWall> : card;
}

function ConsentRow({
  label,
  description,
  alwaysOn,
  checked = false,
  onChange,
}: {
  label: string;
  description: string;
  // Shown in place of the switch for the category that cannot be turned off.
  alwaysOn?: string;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const text = (
    <span className="min-w-0">
      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
      <span className="mt-0.5 block text-xs leading-snug text-zinc-600 dark:text-zinc-400">
        {description}
      </span>
    </span>
  );

  if (alwaysOn) {
    return (
      <div className="flex items-start justify-between gap-4 px-3.5 py-2.5">
        {text}
        <span className="mt-0.5 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {alwaysOn}
        </span>
      </div>
    );
  }

  // A real checkbox (role="switch"), visually hidden; the track after it is
  // drawn from its checked and focus state. The knob moves with
  // inset-inline-start so it slides the right way in RTL locales too.
  return (
    <label className="relative flex cursor-pointer items-start justify-between gap-4 px-3.5 py-2.5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      {text}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors peer-checked:bg-black peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-[inset-inline-start] peer-checked:after:start-[1.125rem] motion-reduce:transition-none motion-reduce:after:transition-none dark:bg-zinc-600 dark:peer-checked:bg-white dark:peer-focus-visible:outline-white dark:peer-checked:after:bg-zinc-900"
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
