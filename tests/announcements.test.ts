import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ADMIN_MODULES, isModuleActive } from '../lib/admin/modules';
import {
  ANNOUNCEMENT_PLATFORMS,
  ANNOUNCEMENT_TIERS,
  ANNOUNCEMENTS_ENDED_SHOWN,
  CTA_EBAY_SITES,
  CTA_VINTED_MARKETS,
  announcementPhase,
  audienceSummary,
  cleanText,
  compareVersions,
  ctaUrlOk,
  fromLocalInput,
  groupAnnouncements,
  localizedAnnouncementText,
  missingAnnouncementLocales,
  toLocalInput,
  validateAnnouncementDraft,
  versionOk,
  type Announcement,
  type AnnouncementDraft,
} from '../lib/announcements/types';

const MIGRATION = readFileSync(
  path.resolve(__dirname, '../supabase/migrations/060_announcements.sql'),
  'utf8',
);

// The quoted strings of one `name CONSTANT TEXT[] := ARRAY[...]` in the
// migration.
function sqlArray(name: string): string[] {
  const m = new RegExp(`${name} CONSTANT TEXT\\[\\] := ARRAY\\[([^\\]]*)\\]`).exec(MIGRATION);
  if (!m) throw new Error(`${name} not found in 060_announcements.sql`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

const NOW = Date.parse('2026-11-18T12:00:00Z');

function row(over: Partial<Announcement>): Announcement {
  return {
    id: 'a',
    severity: 'info',
    title: { en: 'Title' },
    body: { en: 'Body' },
    cta_label: null,
    cta_url: null,
    dismissible: true,
    audience_tiers: [],
    audience_platforms: [],
    min_version: null,
    max_version: null,
    signed_in_only: false,
    starts_at: '2026-11-18T10:00:00Z',
    ends_at: null,
    revision: 1,
    created_at: '2026-11-18T09:00:00Z',
    updated_at: '2026-11-18T09:00:00Z',
    created_by: null,
    ...over,
  };
}

function draft(over: Partial<AnnouncementDraft>): AnnouncementDraft {
  return {
    id: null,
    severity: 'warning',
    title: { en: 'Vinted crosslisting is down' },
    body: { en: "We're on it." },
    cta_label: null,
    cta_url: null,
    dismissible: true,
    audience_tiers: [],
    audience_platforms: [],
    min_version: null,
    max_version: null,
    signed_in_only: false,
    starts_at: null,
    ends_at: null,
    ...over,
  };
}

describe('ctaUrlOk', () => {
  it('accepts the allowlisted hosts', () => {
    for (const url of [
      'https://salelinx.com',
      'https://salelinx.com/docs/status',
      'https://www.salelinx.com/pricing?x=1#top',
      'https://help.salelinx.com/a',
      'https://chromewebstore.google.com/detail/salelinx/abc',
      'https://depop.com/',
      'https://www.depop.com/settings',
      'https://www.vinted.co.uk/items',
      'https://www.vinted.fr',
      'https://www.vinted.lt/member',
      'https://www.ebay.co.uk/sh/lst',
      'https://www.ebay.com.au/',
      'https://www.ebay.ca?q=1',
      'https://WWW.Vinted.DE/catalog',
      'https://SaleLinx.com/Path',
    ]) {
      expect(ctaUrlOk(url), url).toBe(true);
    }
  });

  it('refuses anything else', () => {
    for (const url of [
      '',
      'http://salelinx.com',
      'HTTPS://salelinx.com',
      'javascript:alert(1)',
      'https://evil.com',
      'https://evilsalelinx.com',
      'https://salelinx.com.evil.com',
      'https://.salelinx.com',
      'https://salelinx.com.',
      'https://salelinx.com:443/',
      'https://salelinx.com:8080/',
      'https://user@salelinx.com',
      'https://user:pass@salelinx.com',
      'https://salelinx.com/a@b',
      'https://evil.com\\.salelinx.com',
      'https://salelinx.com\\@evil.com',
      'https://evil.com%2F.salelinx.com',
      'https://sale linx.com',
      'https://salelinx.com/a b',
      'https://salelinx.com/\t',
      'https://salelinx.com/\u0000',
      'https://salelinx.com/caf\u00e9',
      ' https://salelinx.com',
      'https://vinted.co.uk',
      'https://www.vinted.us',
      'https://www.vinted.co.uk.evil.com',
      'https://www.ebay.cn',
      'https://ebay.com',
      'https://m.depop.com',
      'https://google.com',
      'https://chromewebstore.google.com.evil.com',
      'https://salelinx.com/' + 'a'.repeat(500),
    ]) {
      expect(ctaUrlOk(url), JSON.stringify(url)).toBe(false);
    }
  });

  it('caps the length at 500 characters', () => {
    const base = 'https://salelinx.com/';
    expect(ctaUrlOk(base + 'a'.repeat(500 - base.length))).toBe(true);
    expect(ctaUrlOk(base + 'a'.repeat(501 - base.length))).toBe(false);
  });

  it('uses the same market lists as announcement_cta_url_ok()', () => {
    expect(sqlArray('c_vinted')).toEqual([...CTA_VINTED_MARKETS]);
    expect(sqlArray('c_ebay')).toEqual([...CTA_EBAY_SITES]);
  });
});

describe('migration parity', () => {
  it('allows the same tiers and marketplaces as admin_save_announcement', () => {
    expect(sqlArray('c_tiers')).toEqual([...ANNOUNCEMENT_TIERS]);
    expect(sqlArray('c_platforms')).toEqual([...ANNOUNCEMENT_PLATFORMS]);
  });

  it('caps the copy at the same lengths', () => {
    expect(MIGRATION).toContain('announcement_clean_text(p_title, 120)');
    expect(MIGRATION).toContain('announcement_clean_text(p_body, 600)');
    expect(MIGRATION).toContain('announcement_clean_text(p_cta_label, 40)');
    expect(MIGRATION).toContain('length(p_url) > 500');
  });
});

describe('versions', () => {
  it('accepts one to four dot-separated numbers', () => {
    for (const v of ['1', '1.6', '1.6.2', '1.6.2.10']) expect(versionOk(v), v).toBe(true);
    for (const v of ['', 'v1.6', '1.6.', '.1', '1..2', '1.2.3.4.5', '1.6-beta', ' 1.6'])
      expect(versionOk(v), v).toBe(false);
  });

  it('compares numerically, padding with zeros', () => {
    expect(compareVersions('1.6', '1.6.0')).toBe(0);
    expect(compareVersions('1.10', '1.9')).toBe(1);
    expect(compareVersions('1.5.0', '1.6.1')).toBe(-1);
    expect(compareVersions('2', '1.99.99.99')).toBe(1);
  });
});

describe('cleanText', () => {
  it('trims, drops blanks and keeps line breaks inside', () => {
    expect(cleanText({ en: '  Hi \n', fr: '   ', de: 'a\nb' }, 10)).toEqual({ en: 'Hi', de: 'a\nb' });
  });

  it('refuses a value over the cap after trimming', () => {
    expect(cleanText({ en: ' ' + 'x'.repeat(5) + ' ' }, 5)).toEqual({ en: 'xxxxx' });
    expect(cleanText({ en: 'x'.repeat(6) }, 5)).toBeNull();
  });

  it('counts characters, not UTF-16 units', () => {
    expect(cleanText({ en: '\u{1F600}'.repeat(5) }, 5)).not.toBeNull();
  });

  it('refuses locales the extension does not have', () => {
    expect(cleanText({ en: 'Hi', zh: 'x' } as never, 10)).toBeNull();
  });
});

describe('validateAnnouncementDraft', () => {
  it('passes a plain announcement', () => {
    expect(validateAnnouncementDraft(draft({}), NOW)).toBeNull();
  });

  it('needs an English title and body', () => {
    expect(validateAnnouncementDraft(draft({ title: { en: '  ', fr: 'Titre' } }), NOW)).toBe(
      'invalid_title',
    );
    expect(validateAnnouncementDraft(draft({ title: { en: 'x'.repeat(121) } }), NOW)).toBe(
      'invalid_title',
    );
    expect(validateAnnouncementDraft(draft({ body: { en: '' } }), NOW)).toBe('invalid_body');
    expect(validateAnnouncementDraft(draft({ body: { en: 'ok', de: 'x'.repeat(601) } }), NOW)).toBe(
      'invalid_body',
    );
  });

  it('needs the button label and link together', () => {
    expect(validateAnnouncementDraft(draft({ cta_url: 'https://salelinx.com' }), NOW)).toBe(
      'invalid_cta',
    );
    expect(validateAnnouncementDraft(draft({ cta_label: { en: 'Update' } }), NOW)).toBe(
      'invalid_cta',
    );
    expect(
      validateAnnouncementDraft(
        draft({ cta_label: { fr: 'Mettre' }, cta_url: 'https://salelinx.com' }),
        NOW,
      ),
    ).toBe('invalid_cta');
    expect(
      validateAnnouncementDraft(
        draft({ cta_label: { en: 'x'.repeat(41) }, cta_url: 'https://salelinx.com' }),
        NOW,
      ),
    ).toBe('invalid_cta');
    // A label blank in every language is no label.
    expect(validateAnnouncementDraft(draft({ cta_label: { en: ' ' } }), NOW)).toBeNull();
    expect(
      validateAnnouncementDraft(
        draft({ cta_label: { en: 'Update' }, cta_url: 'https://evil.com' }),
        NOW,
      ),
    ).toBe('invalid_cta_url');
    expect(
      validateAnnouncementDraft(
        draft({
          cta_label: { en: 'Update' },
          cta_url: ' https://chromewebstore.google.com/detail/x ',
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it('checks the audience and the version range', () => {
    expect(
      validateAnnouncementDraft(draft({ audience_tiers: ['free' as never] }), NOW),
    ).toBe('invalid_audience');
    expect(
      validateAnnouncementDraft(draft({ audience_platforms: ['etsy' as never] }), NOW),
    ).toBe('invalid_audience');
    expect(validateAnnouncementDraft(draft({ min_version: '1.6.x' }), NOW)).toBe('invalid_version');
    expect(
      validateAnnouncementDraft(draft({ min_version: '1.7', max_version: '1.6.9' }), NOW),
    ).toBe('invalid_version');
    expect(
      validateAnnouncementDraft(draft({ min_version: '1.6', max_version: '1.6.0' }), NOW),
    ).toBeNull();
  });

  it('needs the end after the start', () => {
    expect(validateAnnouncementDraft(draft({ ends_at: '2026-11-18T11:00:00Z' }), NOW)).toBe(
      'invalid_schedule',
    );
    expect(validateAnnouncementDraft(draft({ ends_at: '2026-11-18T13:00:00Z' }), NOW)).toBeNull();
    expect(
      validateAnnouncementDraft(
        draft({ starts_at: '2026-11-20T09:00:00Z', ends_at: '2026-11-20T09:00:00Z' }),
        NOW,
      ),
    ).toBe('invalid_schedule');
  });
});

describe('audienceSummary', () => {
  it('says Everyone with no filters', () => {
    expect(audienceSummary(row({}))).toBe('Everyone');
  });

  it('joins plans, marketplaces, versions and sign-in in a fixed order', () => {
    expect(
      audienceSummary(
        row({
          audience_tiers: ['business', 'pro'],
          audience_platforms: ['vinted'],
          min_version: '1.5.0',
          max_version: '1.6.1',
          signed_in_only: true,
        }),
      ),
    ).toBe('Pro, Business \u00b7 Vinted \u00b7 v1.5.0 to 1.6.1 \u00b7 signed in');
  });

  it('words one-sided version ranges and a lone sign-in filter', () => {
    expect(audienceSummary(row({ min_version: '1.6' }))).toBe('v1.6 and later');
    expect(audienceSummary(row({ max_version: '1.6.1' }))).toBe('up to v1.6.1');
    expect(audienceSummary(row({ signed_in_only: true }))).toBe('Signed in');
    expect(audienceSummary(row({ audience_tiers: ['none'] }))).toBe('No live plan');
  });
});

describe('grouping', () => {
  it('sorts each row into live, scheduled or ended', () => {
    expect(announcementPhase(row({}), NOW)).toBe('live');
    expect(announcementPhase(row({ starts_at: '2026-11-18T13:00:00Z' }), NOW)).toBe('scheduled');
    expect(announcementPhase(row({ ends_at: '2026-11-18T12:00:00Z' }), NOW)).toBe('ended');
    expect(announcementPhase(row({ ends_at: '2026-11-18T12:00:01Z' }), NOW)).toBe('live');
    // Ended before it started (End now on a scheduled one).
    expect(
      announcementPhase(
        row({ starts_at: '2026-11-19T00:00:00Z', ends_at: '2026-11-18T11:00:00Z' }),
        NOW,
      ),
    ).toBe('ended');
  });

  it('orders live newest first, scheduled soonest first, and keeps the latest ended', () => {
    const ended = Array.from({ length: 25 }, (_, i) =>
      row({
        id: `e${i}`,
        starts_at: '2026-11-01T00:00:00Z',
        ends_at: new Date(Date.parse('2026-11-02T00:00:00Z') + i * 3600_000).toISOString(),
      }),
    );
    const groups = groupAnnouncements(
      [
        row({ id: 'old', starts_at: '2026-11-17T00:00:00Z' }),
        row({ id: 'new', starts_at: '2026-11-18T11:00:00Z' }),
        row({ id: 'later', starts_at: '2026-11-20T00:00:00Z' }),
        row({ id: 'soon', starts_at: '2026-11-19T00:00:00Z' }),
        ...ended,
      ],
      NOW,
    );
    expect(groups.live.map((a) => a.id)).toEqual(['new', 'old']);
    expect(groups.scheduled.map((a) => a.id)).toEqual(['soon', 'later']);
    expect(groups.ended).toHaveLength(ANNOUNCEMENTS_ENDED_SHOWN);
    expect(groups.ended[0].id).toBe('e24');
  });
});

describe('copy helpers', () => {
  it('falls back to English for a blank locale', () => {
    expect(localizedAnnouncementText({ en: 'Hello', fr: ' ' }, 'fr')).toBe('Hello');
    expect(localizedAnnouncementText({ en: 'Hello', fr: 'Bonjour' }, 'fr')).toBe('Bonjour');
  });

  it('lists the locales missing a title or body', () => {
    expect(
      missingAnnouncementLocales(row({ title: { en: 'a', fr: 'b', es: 'c' }, body: { en: 'a', fr: 'b' } })),
    ).toEqual(['es', 'de']);
  });
});

describe('datetime-local values', () => {
  it('round-trips through the local time zone to the minute', () => {
    const iso = '2026-11-18T14:05:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput('2026-11-18T14:05:37.000Z')).toBe(toLocalInput(iso));
  });

  it('answers null for an empty or broken value', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('tomorrow')).toBeNull();
    expect(toLocalInput('not a date')).toBe('');
  });
});

describe('admin nav', () => {
  it('lights Configuration on the announcements page', () => {
    const config = ADMIN_MODULES.find((m) => m.key === 'configuration')!;
    expect(isModuleActive(config, '/admin/announcements')).toBe(true);
  });
});
