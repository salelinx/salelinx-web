import { STATS_OPT_OUT_KEY } from '@/lib/consent';

// Reading the referrer or user agent is device access under PECR reg 6(2)(b), so UK/EEA visitors need consent.

export type SignupSource = {
  source: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing: string;
  at: string;
  device?: DeviceType;
};

export type DeviceType = 'phone' | 'tablet' | 'computer';

/** Coarse device class of the first visit. iPadOS reports a Mac user agent, so
 *  a "Mac" with a touch screen is counted as a tablet. */
export function deviceType(userAgent: string, maxTouchPoints = 0): DeviceType {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(userAgent)) return 'phone';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'tablet';
  return 'computer';
}

const KEY = 'slx_src';

const REFERRERS: [RegExp, string][] = [
  [/(^|\.)chromewebstore\.google\.com$/, 'chrome_web_store'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'facebook'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
];

function referrerLabel(host: string): string {
  return REFERRERS.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, '');
}

export function classifySource(href: string, referrer: string, now = new Date()): SignupSource {
  const url = new URL(href);
  const p = url.searchParams;
  let refHost = '';
  try {
    refHost = new URL(referrer).hostname;
  } catch {}
  if (refHost === url.hostname) refHost = '';

  const utm = p.get('utm_source')?.trim().toLowerCase();
  let source: string;
  if (utm) source = utm;
  else if (p.has('gclid') || p.has('gbraid') || p.has('wbraid')) source = 'google_ads';
  else if (p.has('ttclid')) source = 'tiktok_ads';
  else if (p.has('fbclid')) source = refHost ? referrerLabel(refHost) : 'meta';
  else source = refHost ? referrerLabel(refHost) : 'direct';

  return {
    source,
    medium: p.get('utm_medium') ?? undefined,
    campaign: p.get('utm_campaign') ?? undefined,
    referrer: refHost || undefined,
    landing: url.pathname,
    at: now.toISOString(),
  };
}

// Only our own URL is kept at load; nothing about the device is read until we know it is allowed.
const landing = typeof window === 'undefined' ? undefined : { href: location.href, at: new Date() };

function currentSource(): SignupSource | undefined {
  if (!landing) return undefined;
  return {
    ...classifySource(landing.href, document.referrer, landing.at),
    ...(isOwnSite(document.referrer) && { source: 'unknown' }),
    device: deviceType(navigator.userAgent, navigator.maxTouchPoints),
  };
}

function isOwnSite(referrer: string): boolean {
  try {
    return new URL(referrer).host === location.host;
  } catch {
    return false;
  }
}

const CONSENT_COUNTRIES = new Set(
  'GB AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' '),
);

export function needsConsent(country: string | null): boolean {
  return !country || CONSENT_COUNTRIES.has(country.toUpperCase());
}

export function captureSignupSource() {
  try {
    if (localStorage.getItem(KEY)) return;
    const src = currentSource();
    if (src && src.source !== 'unknown') localStorage.setItem(KEY, JSON.stringify(src));
  } catch {}
}

export function clearSignupSource() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export async function readSignupSource(): Promise<SignupSource | undefined> {
  try {
    if (localStorage.getItem(STATS_OPT_OUT_KEY) === '1') return undefined;
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SignupSource;
  } catch {}
  try {
    const { automatic } = await (await fetch('/api/geo', { cache: 'no-store' })).json();
    return automatic === true ? currentSource() : undefined;
  } catch {
    return undefined;
  }
}

const FIELDS = ['source', 'medium', 'campaign', 'referrer', 'landing', 'at', 'device'] as const;

// The ?src= param on /auth/callback, which anyone can craft: keep known string fields, capped.
export function parseSignupSource(raw: string | null): SignupSource | undefined {
  try {
    const o = JSON.parse(raw ?? '');
    if (typeof o?.source !== 'string') return undefined;
    return Object.fromEntries(
      FIELDS.filter((k) => typeof o[k] === 'string').map((k) => [k, o[k].slice(0, 200)]),
    ) as SignupSource;
  } catch {
    return undefined;
  }
}
