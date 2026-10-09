// Not strictly necessary storage, so CookieConsent only captures it once a category is granted.

export type SignupSource = {
  source: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing: string;
  at: string;
};

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

export function captureSignupSource() {
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, JSON.stringify(classifySource(location.href, document.referrer)));
  } catch {}
}

export function clearSignupSource() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function readSignupSource(): SignupSource | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SignupSource) : undefined;
  } catch {
    return undefined;
  }
}
