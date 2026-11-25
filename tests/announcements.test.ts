import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ADMIN_MODULES, isModuleActive } from '../lib/admin/modules';
import {
  ANNOUNCEMENT_ERROR_MESSAGE,
  ANNOUNCEMENT_FREQUENCIES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_ICON_SVG,
  ANNOUNCEMENT_IMAGE_BUCKET,
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  ANNOUNCEMENT_IMAGE_TYPES,
  ANNOUNCEMENT_LOCALES,
  ANNOUNCEMENT_PLACEMENTS,
  ANNOUNCEMENT_EDITOR_PLACEMENTS,
  ANNOUNCEMENT_PLATFORMS,
  ANNOUNCEMENT_PRESETS,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_TABS,
  ANNOUNCEMENT_THEMES,
  ANNOUNCEMENT_TIERS,
  ANNOUNCEMENTS_ENDED_SHOWN,
  CTA_EBAY_SITES,
  CTA_VINTED_MARKETS,
  announcementImagePath,
  announcementImageUrl,
  announcementPhase,
  announcementRpcData,
  audienceSummary,
  cleanText,
  compareVersions,
  ctaUrlOk,
  emojiOk,
  fromLocalInput,
  groupAnnouncements,
  imagePathOk,
  localizedAnnouncementText,
  missingAnnouncementLocales,
  parseRecipientEmails,
  placementsForTabs,
  toLocalInput,
  editorPlacements,
  togglePlacement,
  loginScreenAllowed,
  ANNOUNCEMENT_SIGNED_IN_PLACEMENTS,
  validateAnnouncementDraft,
  versionOk,
  type Announcement,
  type AnnouncementDraft,
} from '../lib/announcements/types';
import { TEST_LIFETIME_MS, TEST_TITLE_PREFIX, buildTestDraft } from '../lib/announcements/test-messages';

const MIGRATION = readFileSync(
  path.resolve(__dirname, '../supabase/migrations/064_announcements.sql'),
  'utf8',
);
// Adds the login place: replaces the placements CHECK and admin_save_announcement.
const LOGIN_MIGRATION = readFileSync(
  path.resolve(__dirname, '../supabase/migrations/065_announcement_login_place.sql'),
  'utf8',
);

// The quoted strings of one `name CONSTANT TEXT[] := ARRAY[...]` in a
// migration (064 unless another is given).
function sqlArray(name: string, sql = MIGRATION): string[] {
  const m = new RegExp(`${name} CONSTANT TEXT\\[\\] := ARRAY\\[([^\\]]*)\\]`).exec(sql);
  if (!m) throw new Error(`${name} not found in the migration`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// The quoted strings of the first `column TEXT ... CHECK (column IN (...))`
// in the table definition.
function sqlCheckList(column: string): string[] {
  const m = new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)`).exec(MIGRATION);
  if (!m) throw new Error(`CHECK on ${column} not found in 064_announcements.sql`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

const NOW = Date.parse('2026-11-18T12:00:00Z');

function row(over: Partial<Announcement>): Announcement {
  return {
    id: 'a',
    priority: 'normal',
    theme: 'blue',
    icon: 'info',
    emoji: null,
    title: { en: 'Title' },
    body: { en: 'Body' },
    image_path: null,
    buttons: [],
    placements: ['banner'],
    frequency: 'until_closed',
    audience_tiers: [],
    audience_platforms: [],
    audience_locales: [],
    audience_tabs: [],
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
    priority: 'high',
    theme: 'amber',
    icon: 'warning',
    emoji: null,
    title: { en: 'Vinted crosslisting is down' },
    body: { en: "We're on it." },
    image_path: null,
    buttons: [],
    placements: ['banner'],
    frequency: 'until_closed',
    audience_tiers: [],
    audience_platforms: [],
    audience_locales: [],
    audience_tabs: [],
    min_version: null,
    max_version: null,
    signed_in_only: false,
    starts_at: null,
    ends_at: null,
    recipients: [],
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
      'https://salelinx.com/café',
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
  it('allows the same lists as admin_save_announcement', () => {
    expect(sqlArray('c_tiers')).toEqual([...ANNOUNCEMENT_TIERS]);
    expect(sqlArray('c_platforms')).toEqual([...ANNOUNCEMENT_PLATFORMS]);
    expect(sqlArray('c_locales')).toEqual([...ANNOUNCEMENT_LOCALES]);
    expect(sqlArray('c_placements', LOGIN_MIGRATION)).toEqual([...ANNOUNCEMENT_PLACEMENTS]);
    expect(sqlArray('c_themes')).toEqual([...ANNOUNCEMENT_THEMES]);
    expect(sqlArray('c_icons')).toEqual([...ANNOUNCEMENT_ICONS]);
  });

  it('065 changes only the places in admin_save_announcement and the table', () => {
    const save = (sql: string) =>
      /CREATE OR REPLACE FUNCTION public\.admin_save_announcement\([\s\S]*?\n\$\$;/.exec(sql)![0];
    const without = (sql: string) => save(sql).replace(/ {2}c_placements CONSTANT[^\n]*\n/, '');
    expect(without(LOGIN_MIGRATION)).toBe(without(MIGRATION));
    const list = ANNOUNCEMENT_PLACEMENTS.map((p) => `'${p}'`).join(', ');
    expect(LOGIN_MIGRATION).toContain(`placements <@ ARRAY[${list}]::TEXT[]`);
  });

  it('matches the table CHECKs', () => {
    expect(sqlCheckList('priority')).toEqual([...ANNOUNCEMENT_PRIORITIES]);
    expect(sqlCheckList('theme')).toEqual([...ANNOUNCEMENT_THEMES]);
    expect(sqlCheckList('icon')).toEqual([...ANNOUNCEMENT_ICONS]);
    expect(sqlCheckList('frequency')).toEqual([...ANNOUNCEMENT_FREQUENCIES]);
  });

  it('caps the copy at the same lengths', () => {
    expect(MIGRATION).toContain("announcement_clean_text(v_data->'title', 120)");
    expect(MIGRATION).toContain("announcement_clean_text(v_data->'body', 600)");
    expect(MIGRATION).toContain("COALESCE(v_button->'label', '{}'::jsonb), 40)");
    expect(MIGRATION).toContain('length(p_url) > 500');
    expect(MIGRATION).toContain('cardinality(v_emails) > 1000');
  });

  it('configures the image bucket as the editor expects', () => {
    expect(MIGRATION).toContain(`'${ANNOUNCEMENT_IMAGE_BUCKET}', '${ANNOUNCEMENT_IMAGE_BUCKET}', true, ${ANNOUNCEMENT_IMAGE_MAX_BYTES}`);
    for (const type of ANNOUNCEMENT_IMAGE_TYPES) expect(MIGRATION).toContain(`'${type}'`);
  });

  it('has a message for every error code the RPCs answer', () => {
    const codes = new Set(
      [...MIGRATION.matchAll(/'error', '([a-z_]+)'/g)].map((m) => m[1]),
    );
    expect(codes.size).toBeGreaterThan(10);
    for (const code of codes) expect(ANNOUNCEMENT_ERROR_MESSAGE[code], code).toBeTruthy();
  });

  it('sends the fields the RPC reads, named as the columns', () => {
    const data = announcementRpcData(draft({ id: 'x', recipients: ['a@b.co'] }));
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('recipients');
    for (const key of Object.keys(data)) {
      expect(new RegExp(`v_data(->>|->|\\s\\?\\s)'${key}'`).test(MIGRATION), key).toBe(true);
    }
  });
});

describe('icons and presets', () => {
  it('has markup for every icon but none', () => {
    for (const icon of ANNOUNCEMENT_ICONS) {
      if (icon === 'none') continue;
      expect(ANNOUNCEMENT_ICON_SVG[icon], icon).toMatch(/^<(path|circle|polygon|polyline|rect|line)/);
    }
  });

  it('only offers presets the RPC accepts', () => {
    for (const p of ANNOUNCEMENT_PRESETS) {
      const d = draft({
        priority: p.priority,
        theme: p.theme,
        icon: p.icon,
        placements: p.placements,
        frequency: p.frequency,
      });
      expect(validateAnnouncementDraft(d, NOW), p.key).toBeNull();
    }
  });
});

describe('placements', () => {
  it('offers the banner, popup, launcher card and login screen', () => {
    expect([...ANNOUNCEMENT_EDITOR_PLACEMENTS]).toEqual(['banner', 'popup', 'launcher', 'login']);
    for (const p of ANNOUNCEMENT_EDITOR_PLACEMENTS) expect(ANNOUNCEMENT_PLACEMENTS).toContain(p);
  });

  it('ticks any mix, in a fixed order whatever order they are ticked in', () => {
    expect(togglePlacement(['launcher'], 'banner', true, [])).toEqual(['banner', 'launcher']);
    expect(togglePlacement(['banner', 'launcher'], 'popup', true, [])).toEqual(['banner', 'popup', 'launcher']);
    expect(togglePlacement(['banner', 'popup'], 'banner', false, [])).toEqual(['popup']);
    expect(togglePlacement(['banner'], 'banner', false, [])).toEqual([]);
  });

  it('only lets the panel places be ticked when tabs are chosen', () => {
    expect(togglePlacement(['banner'], 'launcher', true, ['crosslist'])).toEqual(['banner']);
    expect(togglePlacement(['banner'], 'popup', true, ['crosslist'])).toEqual(['banner', 'popup']);
  });

  it('opens an older message with the offered places it has', () => {
    expect(editorPlacements(['banner', 'popup', 'launcher', 'badge', 'toolbar'])).toEqual(['banner', 'popup', 'launcher']);
    expect(editorPlacements(['launcher', 'popup'])).toEqual(['popup', 'launcher']);
    expect(editorPlacements(['badge', 'toolbar'])).toEqual(['banner']);
    expect(editorPlacements([])).toEqual(['banner']);
  });

  it('drops the places with no tab when tabs are chosen, keeping something', () => {
    expect(placementsForTabs(['banner', 'launcher', 'badge', 'toolbar'], ['offers'])).toEqual([
      'banner',
    ]);
    expect(placementsForTabs(['launcher', 'toolbar'], ['offers'])).toEqual(['banner']);
    expect(placementsForTabs(['launcher', 'toolbar'], [])).toEqual(['launcher', 'toolbar']);
    expect(placementsForTabs(['banner', 'login'], ['offers'])).toEqual(['banner']);
    expect(placementsForTabs(['login'], ['offers'])).toEqual(['banner']);
  });

  it('offers the login screen on its own, and never with a panel tab', () => {
    expect(togglePlacement([], 'login', true, [])).toEqual(['login']);
    expect(togglePlacement(['login'], 'banner', true, [])).toEqual(['banner', 'login']);
    expect(togglePlacement(['banner'], 'login', true, ['offers'])).toEqual(['banner']);
    expect(editorPlacements(['login', 'badge'])).toEqual(['login']);
    expect(validateAnnouncementDraft(draft({ placements: ['login'] }), NOW)).toBeNull();
    expect(validateAnnouncementDraft(draft({ placements: ['login'], audience_tabs: ['offers'] }), NOW)).toBe(
      'invalid_tabs',
    );
  });

  it('keeps the login screen to messages someone signed out can match', () => {
    expect(loginScreenAllowed(draft({}))).toBe(true);
    expect(loginScreenAllowed(draft({ audience_platforms: ['depop'], min_version: '1.2' }))).toBe(true);
    expect(loginScreenAllowed(draft({ audience_tiers: ['none'] }))).toBe(false);
    expect(loginScreenAllowed(draft({ audience_tabs: ['offers'] }))).toBe(false);
    expect(loginScreenAllowed(draft({ recipients: ['a@b.co'] }))).toBe(false);
    expect([...ANNOUNCEMENT_SIGNED_IN_PLACEMENTS]).toEqual(
      ANNOUNCEMENT_EDITOR_PLACEMENTS.filter((p) => p !== 'login'),
    );
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

describe('emoji, images and recipients', () => {
  it('takes one emoji, including multi-code-point ones, and nothing with spaces', () => {
    for (const e of ['\u{1F389}', '\u{1F1EC}\u{1F1E7}', '\u{1F468}‍\u{1F469}‍\u{1F467}', ' \u{1F381} ']) {
      expect(emojiOk(e), e).toBe(true);
    }
    for (const e of ['', '  ', 'a b', '\u{1F389}\n\u{1F389}', 'x'.repeat(17)]) expect(emojiOk(e), e).toBe(false);
  });

  it('accepts only plain bucket paths', () => {
    for (const p of ['2026/11/ab12.png', 'a.jpg', 'x/y_z-1.webp']) expect(imagePathOk(p), p).toBe(true);
    for (const p of ['', '../x.png', 'a/../b.png', '/a.png', 'A.png', 'a b.png', 'a/.hidden', 'a//b.png', 'x'.repeat(201)]) {
      expect(imagePathOk(p), p).toBe(false);
    }
  });

  it('names a new upload year/month/random.ext, always a valid path', () => {
    const at = new Date('2026-03-05T10:00:00Z');
    expect(announcementImagePath('image/png', at, 'abc123')).toBe('2026/03/abc123.png');
    expect(announcementImagePath('image/jpeg', at, 'abc123')).toBe('2026/03/abc123.jpg');
    expect(announcementImagePath('image/webp', at, 'abc123')).toBe('2026/03/abc123.webp');
    expect(announcementImagePath('image/gif', at, 'abc123')).toBe('2026/03/abc123.gif');
    expect(imagePathOk(announcementImagePath('image/png'))).toBe(true);
  });

  it('builds the public image address', () => {
    expect(announcementImageUrl('2026/11/a.png', 'https://x.supabase.co/')).toBe(
      'https://x.supabase.co/storage/v1/object/public/announcement-images/2026/11/a.png',
    );
  });

  it('splits pasted emails, lowercases and de-duplicates them', () => {
    expect(parseRecipientEmails(' Alice@Example.com, bob@x.co;\ncarol@y.io  alice@example.com ')).toEqual([
      'alice@example.com',
      'bob@x.co',
      'carol@y.io',
    ]);
    expect(parseRecipientEmails('  \n ')).toEqual([]);
  });
});

describe('validateAnnouncementDraft', () => {
  it('passes a plain announcement', () => {
    expect(validateAnnouncementDraft(draft({}), NOW)).toBeNull();
  });

  it('checks the priority and the look', () => {
    expect(validateAnnouncementDraft(draft({ priority: 'max' as never }), NOW)).toBe('invalid_priority');
    expect(validateAnnouncementDraft(draft({ theme: 'pink' as never }), NOW)).toBe('invalid_look');
    expect(validateAnnouncementDraft(draft({ icon: 'cat' as never }), NOW)).toBe('invalid_look');
    expect(validateAnnouncementDraft(draft({ emoji: 'a b' }), NOW)).toBe('invalid_look');
    expect(validateAnnouncementDraft(draft({ emoji: '\u{1F389}' }), NOW)).toBeNull();
    expect(validateAnnouncementDraft(draft({ emoji: '  ' }), NOW)).toBeNull();
  });

  it('needs an English title and body', () => {
    expect(validateAnnouncementDraft(draft({ title: { fr: 'x' } }), NOW)).toBe('invalid_title');
    expect(validateAnnouncementDraft(draft({ title: { en: '  ' } }), NOW)).toBe('invalid_title');
    expect(validateAnnouncementDraft(draft({ title: { en: 'x'.repeat(121) } }), NOW)).toBe('invalid_title');
    expect(validateAnnouncementDraft(draft({ body: { en: '' } }), NOW)).toBe('invalid_body');
    expect(validateAnnouncementDraft(draft({ body: { en: 'x'.repeat(601) } }), NOW)).toBe('invalid_body');
  });

  it('checks the image path', () => {
    expect(validateAnnouncementDraft(draft({ image_path: '../x.png' }), NOW)).toBe('invalid_image');
    expect(validateAnnouncementDraft(draft({ image_path: '2026/11/a.png' }), NOW)).toBeNull();
  });

  it('takes up to two buttons, each with an English label and an allowed link', () => {
    const ok = { label: { en: 'Update' }, url: 'https://chromewebstore.google.com/detail/x' };
    expect(validateAnnouncementDraft(draft({ buttons: [ok, ok] }), NOW)).toBeNull();
    expect(validateAnnouncementDraft(draft({ buttons: [ok, ok, ok] }), NOW)).toBe('invalid_buttons');
    expect(validateAnnouncementDraft(draft({ buttons: [{ label: { en: 'Go' }, url: '' }] }), NOW)).toBe('invalid_buttons');
    expect(validateAnnouncementDraft(draft({ buttons: [{ label: { fr: 'Va' }, url: ok.url }] }), NOW)).toBe('invalid_buttons');
    expect(validateAnnouncementDraft(draft({ buttons: [{ label: { en: 'x'.repeat(41) }, url: ok.url }] }), NOW)).toBe('invalid_buttons');
    expect(validateAnnouncementDraft(draft({ buttons: [{ label: { en: 'Go' }, url: 'https://evil.com' }] }), NOW)).toBe('invalid_button_url');
    // A blank button is no button.
    expect(validateAnnouncementDraft(draft({ buttons: [{ label: { en: ' ' }, url: ' ' }] }), NOW)).toBeNull();
  });

  it('needs at least one place, and only the ones the editor offers', () => {
    expect(validateAnnouncementDraft(draft({ placements: [] }), NOW)).toBe('invalid_placements');
    expect(validateAnnouncementDraft(draft({ placements: ['banner', 'toolbar'] }), NOW)).toBe('invalid_placements');
    expect(validateAnnouncementDraft(draft({ placements: ['badge', 'toolbar'] }), NOW)).toBe('invalid_placements');
    expect(validateAnnouncementDraft(draft({ placements: ['sky' as never] }), NOW)).toBe('invalid_placements');
    expect(validateAnnouncementDraft(draft({ placements: ['launcher'] }), NOW)).toBeNull();
    expect(validateAnnouncementDraft(draft({ placements: ['banner', 'popup', 'launcher'] }), NOW)).toBeNull();
  });

  it('checks how often', () => {
    expect(validateAnnouncementDraft(draft({ frequency: 'daily' as never }), NOW)).toBe('invalid_frequency');
    for (const f of ANNOUNCEMENT_FREQUENCIES) expect(validateAnnouncementDraft(draft({ frequency: f }), NOW)).toBeNull();
  });

  it('checks the audience, tabs and the version range', () => {
    expect(validateAnnouncementDraft(draft({ audience_tiers: ['gold' as never] }), NOW)).toBe('invalid_audience');
    expect(validateAnnouncementDraft(draft({ audience_platforms: ['etsy' as never] }), NOW)).toBe('invalid_audience');
    expect(validateAnnouncementDraft(draft({ audience_locales: ['it' as never] }), NOW)).toBe('invalid_audience');
    expect(validateAnnouncementDraft(draft({ audience_tabs: ['crosslist'], placements: ['launcher'] }), NOW)).toBe('invalid_tabs');
    expect(validateAnnouncementDraft(draft({ audience_tabs: ['crosslist'], placements: ['popup'] }), NOW)).toBeNull();
    expect(validateAnnouncementDraft(draft({ audience_tabs: ['Cross list'], placements: ['banner'] }), NOW)).toBe('invalid_tabs');
    expect(validateAnnouncementDraft(draft({ min_version: '1.6.x' }), NOW)).toBe('invalid_version');
    expect(validateAnnouncementDraft(draft({ min_version: '1.10', max_version: '1.9' }), NOW)).toBe('invalid_version');
    expect(validateAnnouncementDraft(draft({ min_version: '1.9', max_version: '1.10' }), NOW)).toBeNull();
  });

  it('needs the end after the start', () => {
    expect(validateAnnouncementDraft(draft({ ends_at: '2026-11-18T11:00:00Z' }), NOW)).toBe('invalid_schedule');
    expect(
      validateAnnouncementDraft(draft({ starts_at: '2026-11-19T00:00:00Z', ends_at: '2026-11-19T00:00:00Z' }), NOW),
    ).toBe('invalid_schedule');
    expect(validateAnnouncementDraft(draft({ ends_at: '2026-11-18T13:00:00Z' }), NOW)).toBeNull();
  });

  it('checks the specific users', () => {
    expect(validateAnnouncementDraft(draft({ recipients: ['a@b.co', 'not-an-email'] }), NOW)).toBe('invalid_recipients');
    expect(
      validateAnnouncementDraft(draft({ recipients: Array.from({ length: 1001 }, (_, i) => `u${i}@x.co`) }), NOW),
    ).toBe('too_many_recipients');
    expect(validateAnnouncementDraft(draft({ recipients: ['a@b.co'] }), NOW)).toBeNull();
  });
});

describe('audienceSummary', () => {
  it('says Everyone with no filters', () => {
    expect(audienceSummary(draft({}))).toBe('Everyone');
  });

  it('joins every filter in a fixed order', () => {
    expect(
      audienceSummary(
        draft({
          audience_tiers: ['business', 'pro'],
          audience_platforms: ['vinted'],
          audience_locales: ['de', 'fr'],
          audience_tabs: ['crosslist'],
          min_version: '1.5.0',
          max_version: '1.6.1',
          signed_in_only: true,
          recipients: ['a@b.co', 'c@d.co'],
        }),
      ),
    ).toBe('Pro, Business · Vinted · French, German · Crosslist tab · v1.5.0 to 1.6.1 · 2 people');
  });

  it('words one-sided version ranges, lone filters and unknown tabs', () => {
    expect(audienceSummary(draft({ min_version: '1.6' }))).toBe('v1.6 and later');
    expect(audienceSummary(draft({ max_version: '1.6' }))).toBe('up to v1.6');
    expect(audienceSummary(draft({ signed_in_only: true }))).toBe('Everyone');
    expect(audienceSummary(draft({ recipients: ['a@b.co'] }))).toBe('1 person');
    expect(audienceSummary(draft({ audience_tabs: ['offers', 'oldtab'] }))).toBe('Offers, oldtab tabs');
  });
});

describe('panel tabs', () => {
  it('are plain ids the RPC accepts', () => {
    for (const t of ANNOUNCEMENT_TABS) expect(t, t).toMatch(/^[a-z]{2,30}$/);
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

  it('lists the locales missing a title or body, among the ones aimed at', () => {
    const a = row({ title: { en: 'a', fr: 'b', es: 'c' }, body: { en: 'a', fr: 'b' } });
    expect(missingAnnouncementLocales(a)).toEqual(['es', 'de']);
    expect(missingAnnouncementLocales({ ...a, audience_locales: ['fr', 'de'] })).toEqual(['de']);
    expect(missingAnnouncementLocales({ ...a, audience_locales: ['en'] })).toEqual([]);
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

describe('quick test messages', () => {
  it('builds a valid message for every starting point, place and frequency', () => {
    for (const preset of ANNOUNCEMENT_PRESETS) {
      // Every non-empty mix of the places for people signed in.
      for (let mask = 1; mask < 1 << ANNOUNCEMENT_SIGNED_IN_PLACEMENTS.length; mask++) {
        const places = ANNOUNCEMENT_SIGNED_IN_PLACEMENTS.filter((_, i) => mask & (1 << i));
        for (const frequency of ANNOUNCEMENT_FREQUENCIES) {
          const d = buildTestDraft({ preset: preset.key, places, frequency }, 'Me@Example.com', NOW);
          const what = `${preset.key}/${places.join('+')}/${frequency}`;
          expect(validateAnnouncementDraft(d, NOW), what).toBeNull();
          expect(d.placements, what).toEqual(places);
          expect(d.frequency, what).toBe(frequency);
          expect([d.priority, d.theme, d.icon], what).toEqual([preset.priority, preset.theme, preset.icon]);
        }
      }
    }
  });

  it('goes to the sender only, ends an hour later and is marked as a test', () => {
    const d = buildTestDraft({ preset: 'feature', places: ['popup'], frequency: 'once' }, ' Me@Example.com ', NOW);
    expect(d.recipients).toEqual(['me@example.com']);
    expect(d.starts_at).toBeNull();
    expect(Date.parse(d.ends_at!)).toBe(NOW + TEST_LIFETIME_MS);
    for (const title of Object.values(d.title)) expect(title.startsWith(TEST_TITLE_PREFIX)).toBe(true);
    expect(d.title.fr).toBeTruthy();
    expect(d.signed_in_only).toBe(true);
  });
});

describe('admin nav', () => {
  it('lights Configuration on the announcements page', () => {
    const config = ADMIN_MODULES.find((m) => m.key === 'configuration')!;
    expect(isModuleActive(config, '/admin/announcements')).toBe(true);
  });
});
