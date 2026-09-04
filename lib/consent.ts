// Cookie-consent model shared by components/CookieConsent.tsx and its tests.
// Pure functions only: everything that touches document/window stays in the
// component.
//
// Two optional categories exist. "analytics" is Google Analytics; "ads" is
// the Google Ads conversion tag that measures whether our own ads on Google
// brought a visitor here (we advertise SaleLinx on Google; we never show ads
// on salelinx.com). Each category is only "active" when its env var is set,
// and a visitor must answer for every active category.

export type Consent = 'granted' | 'denied';

export type ConsentState = {
  analytics: Consent | null;
  ads: Consent | null;
};

export const EMPTY_CONSENT: ConsentState = { analytics: null, ads: null };

// Serialized as `analytics=granted&ads=denied` in the slx_consent cookie.
// Only answered categories are written, so a visitor who was never asked
// about ads (the category was inactive, or they chose under the older
// analytics-only banner) stays null and is asked when it becomes active.
// The pre-ads banner wrote the bare values `granted` / `denied`; those parse
// as an analytics-only answer for the same reason.
export function parseConsentValue(raw: string | undefined): ConsentState {
  if (!raw) return EMPTY_CONSENT;
  if (raw === 'granted' || raw === 'denied') {
    return { analytics: raw, ads: null };
  }
  const state: ConsentState = { ...EMPTY_CONSENT };
  for (const part of raw.split('&')) {
    const [key, value] = part.split('=');
    if ((key === 'analytics' || key === 'ads') && (value === 'granted' || value === 'denied')) {
      state[key] = value;
    }
  }
  return state;
}

export function serializeConsent(state: ConsentState): string {
  const parts: string[] = [];
  if (state.analytics) parts.push(`analytics=${state.analytics}`);
  if (state.ads) parts.push(`ads=${state.ads}`);
  return parts.join('&');
}

// True when some active category has no stored answer yet, i.e. the banner
// must open. A visitor who accepted analytics under the old banner and then
// sees the ads category activate is asked again: consent given for one
// purpose does not stretch to a new one.
export function needsChoice(
  state: ConsentState,
  active: { analytics: boolean; ads: boolean },
): boolean {
  return (
    (active.analytics && state.analytics === null) ||
    (active.ads && state.ads === null)
  );
}
