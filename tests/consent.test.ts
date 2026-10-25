// The consent cookie carries per-category choices, and the legacy
// analytics-only values must never be read as consent for the newer ads
// category: consent given for one purpose does not stretch to another.
import { describe, expect, it } from 'vitest';
import {
  needsChoice,
  parseConsentValue,
  serializeConsent,
} from '@/lib/consent';

describe('consent cookie parsing', () => {
  it('parses the per-category format', () => {
    expect(parseConsentValue('analytics=granted&ads=denied')).toEqual({
      analytics: 'granted',
      ads: 'denied',
    });
    expect(parseConsentValue('ads=granted')).toEqual({
      analytics: null,
      ads: 'granted',
    });
  });

  it('treats legacy bare values as an analytics-only answer', () => {
    expect(parseConsentValue('granted')).toEqual({ analytics: 'granted', ads: null });
    expect(parseConsentValue('denied')).toEqual({ analytics: 'denied', ads: null });
  });

  it('ignores garbage', () => {
    expect(parseConsentValue('ads=yes&x=granted&analytics')).toEqual({
      analytics: null,
      ads: null,
    });
    expect(parseConsentValue(undefined)).toEqual({ analytics: null, ads: null });
  });

  it('round-trips, omitting unanswered categories', () => {
    const state = { analytics: 'granted', ads: null } as const;
    expect(serializeConsent(state)).toBe('analytics=granted');
    expect(parseConsentValue(serializeConsent(state))).toEqual(state);
  });
});

describe('needsChoice', () => {
  const both = { analytics: true, ads: true };

  it('opens the banner only while an active category is unanswered', () => {
    expect(needsChoice({ analytics: null, ads: null }, both)).toBe(true);
    expect(needsChoice({ analytics: 'denied', ads: 'granted' }, both)).toBe(false);
  });

  it('re-asks a legacy analytics-only chooser once ads activates', () => {
    const legacy = parseConsentValue('granted');
    expect(needsChoice(legacy, { analytics: true, ads: false })).toBe(false);
    expect(needsChoice(legacy, both)).toBe(true);
  });

  it('never blocks on an inactive category', () => {
    expect(
      needsChoice({ analytics: null, ads: null }, { analytics: false, ads: false }),
    ).toBe(false);
  });
});
