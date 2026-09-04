// Conversion + analytics event helpers for our own Google Ads campaigns
// (we advertise SaleLinx on Google; nothing here shows ads on the site).
//
// Every function is a no-op unless the visitor granted the matching consent
// category in the cookie banner: gtag only exists after CookieConsent loaded
// it, and a denied category's tag is never configured, so firing into a
// missing/unconfigured gtag sends nothing. Call sites therefore do not need
// their own consent checks.
//
// Ads conversion labels come from the Google Ads UI (one per conversion
// action) and ride env vars so campaigns can be set up without a deploy:
//   NEXT_PUBLIC_GOOGLE_ADS_ID       AW-XXXXXXXXX (also gates the banner category)
//   NEXT_PUBLIC_ADS_LABEL_SIGNUP    label for "verified signup"
//   NEXT_PUBLIC_ADS_LABEL_PURCHASE  label for "subscription started"
//   NEXT_PUBLIC_ADS_LABEL_INSTALL   label for "Chrome Web Store click"
// A missing label skips the Ads conversion but still records the GA4 event.

const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const LABELS = {
  signup: process.env.NEXT_PUBLIC_ADS_LABEL_SIGNUP,
  purchase: process.env.NEXT_PUBLIC_ADS_LABEL_PURCHASE,
  install: process.env.NEXT_PUBLIC_ADS_LABEL_INSTALL,
} as const;

function gtagEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params ?? {});
}

function adsConversion(label: keyof typeof LABELS) {
  const conversionLabel = LABELS[label];
  if (!ADS_ID || !conversionLabel) return;
  gtagEvent('conversion', { send_to: `${ADS_ID}/${conversionLabel}` });
}

// Fired on /auth/confirm when a signup email verifies. Runs right before the
// client-side redirect; gtag queues through the dataLayer, so the hit
// survives the soft navigation.
export function trackSignupConversion() {
  gtagEvent('sign_up', { method: 'email' });
  adsConversion('signup');
}

// Fired once per Stripe Checkout success landing on /account. No value is
// attached client-side; set a static value per conversion action in the
// Google Ads UI, or move to webhook-driven uploads if that ever matters.
export function trackPurchaseConversion() {
  gtagEvent('subscription_started');
  adsConversion('purchase');
}

// The real install happens on the Chrome Web Store listing, which we cannot
// tag, so the outbound click is the closest measurable proxy.
export function trackInstallClick() {
  gtagEvent('install_click', { destination: 'chrome_web_store' });
  adsConversion('install');
}
