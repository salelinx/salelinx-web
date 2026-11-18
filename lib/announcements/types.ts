// Shapes and pure helpers for the extension announcements edited in
// /admin/announcements. Rows live in the announcements table (migration
// 060_announcements.sql); the extension reads them through the
// active_announcements() RPC and is told about changes by the
// announcement_signal counter. No server-only imports here: the admin editor
// is a Client Component and imports these too. The loader is in ./data.ts.
//
// The checks below mirror admin_save_announcement() so the editor can answer
// instantly. The RPC stays the boundary: anything that slips past these is
// refused there with the same error code.

export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AnnouncementSeverity = (typeof ANNOUNCEMENT_SEVERITIES)[number];

// The extension's locales, not the website's: the copy is shown in the panel.
export const ANNOUNCEMENT_LOCALES = ['en', 'fr', 'es', 'de'] as const;
export type AnnouncementLocale = (typeof ANNOUNCEMENT_LOCALES)[number];

// Must match the CHECKs on announcements.audience_tiers / audience_platforms
// and the lists in admin_save_announcement. 'none' is a signed-in user with no
// live plan.
export const ANNOUNCEMENT_TIERS = ['trial', 'starter', 'pro', 'business', 'none'] as const;
export type AnnouncementTier = (typeof ANNOUNCEMENT_TIERS)[number];

export const ANNOUNCEMENT_PLATFORMS = ['depop', 'vinted', 'ebay'] as const;
export type AnnouncementPlatform = (typeof ANNOUNCEMENT_PLATFORMS)[number];

export const ANNOUNCEMENT_TIER_LABEL: Record<AnnouncementTier, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  none: 'No live plan',
};

export const ANNOUNCEMENT_PLATFORM_LABEL: Record<AnnouncementPlatform, string> = {
  depop: 'Depop',
  vinted: 'Vinted',
  ebay: 'eBay',
};

// Same caps as admin_save_announcement (characters, after trimming).
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 600;
export const ANNOUNCEMENT_CTA_LABEL_MAX = 40;
export const ANNOUNCEMENT_CTA_URL_MAX = 500;

// How many ended announcements the console lists.
export const ANNOUNCEMENTS_ENDED_SHOWN = 20;

// Copy as stored: English always present, the others optional (a missing one
// falls back to English in the extension).
export type AnnouncementText = Partial<Record<AnnouncementLocale, string>> & { en: string };

// Copy as typed in the editor: any locale may be blank, English included.
export type AnnouncementTextInput = Partial<Record<AnnouncementLocale, string>>;

export type Announcement = {
  id: string;
  severity: AnnouncementSeverity;
  title: AnnouncementText;
  body: AnnouncementText;
  // Both null means no button.
  cta_label: AnnouncementText | null;
  cta_url: string | null;
  dismissible: boolean;
  // Empty means everyone.
  audience_tiers: AnnouncementTier[];
  audience_platforms: AnnouncementPlatform[];
  // Inclusive bounds; null means no bound.
  min_version: string | null;
  max_version: string | null;
  signed_in_only: boolean;
  starts_at: string;
  // Null means until an admin ends it.
  ends_at: string | null;
  // Goes up only when an admin saves with "show again to people who
  // dismissed it".
  revision: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

// What the console sends to admin_save_announcement.
export type AnnouncementDraft = {
  // Null for a new announcement (the RPC picks the id).
  id: string | null;
  severity: AnnouncementSeverity;
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  cta_label: AnnouncementTextInput | null;
  cta_url: string | null;
  dismissible: boolean;
  audience_tiers: AnnouncementTier[];
  audience_platforms: AnnouncementPlatform[];
  min_version: string | null;
  max_version: string | null;
  signed_in_only: boolean;
  // ISO timestamps. A null start means now; a null end means never.
  starts_at: string | null;
  ends_at: string | null;
};

// btrim(value, E' \t\r\n') in the RPC.
export function trimText(value: string): string {
  return value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}

// Postgres length() counts characters (code points), not UTF-16 units.
export function charCount(value: string): number {
  return [...value].length;
}

// announcement_clean_text() in the RPC: every value trimmed and blank ones
// dropped, or null when a value is over `max` characters or a key is not one
// of the four locales.
export function cleanText(
  text: AnnouncementTextInput,
  max: number,
): AnnouncementTextInput | null {
  const out: AnnouncementTextInput = {};
  for (const [key, raw] of Object.entries(text)) {
    if (!(ANNOUNCEMENT_LOCALES as readonly string[]).includes(key)) return null;
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') return null;
    const value = trimText(raw);
    if (!value) continue;
    if (charCount(value) > max) return null;
    out[key as AnnouncementLocale] = value;
  }
  return out;
}

// A locale's copy as the extension shows it: that locale's text, or English.
export function localizedAnnouncementText(
  text: AnnouncementTextInput,
  locale: AnnouncementLocale,
): string {
  return trimText(text[locale] ?? '') || trimText(text.en ?? '');
}

// Locales other than English with no title or body. Drives the "English shown
// for" hint in the console.
export function missingAnnouncementLocales(
  a: Pick<Announcement, 'title' | 'body'>,
): AnnouncementLocale[] {
  return ANNOUNCEMENT_LOCALES.filter((l) => l !== 'en' && (!a.title[l] || !a.body[l]));
}

// ---------------------------------------------------------------------------
// Button URL allowlist. Mirrors announcement_cta_url_ok() in
// 060_announcements.sql (tests/announcements.test.ts checks the two lists
// match); the extension checks the same list again before opening anything.
// ---------------------------------------------------------------------------

export const CTA_VINTED_MARKETS = [
  'co.uk', 'fr', 'de', 'com', 'es', 'it', 'pl', 'nl', 'be', 'pt', 'at', 'se',
  'dk', 'fi', 'cz', 'ro', 'sk', 'hu', 'lt', 'ie',
] as const;

export const CTA_EBAY_SITES = [
  'co.uk', 'com', 'de', 'fr', 'it', 'es', 'ie', 'nl', 'at', 'com.au', 'ca',
] as const;

// What follows https:// up to the first '/', '?' or '#'. A ':' (explicit port)
// or '@' (login details) there fails the match.
const CTA_HOST_RE = /^https:\/\/([^/?#:@]+)(?:[/?#]|$)/;
const DNS_HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
// Anything outside printable ASCII: whitespace, control characters and
// non-ASCII. The RPC refuses the same set.
const CTA_BAD_CHAR_RE = /[^\x21-\x7e]/;

export function ctaHostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  if (!DNS_HOST_RE.test(h)) return false;
  return (
    h === 'salelinx.com' ||
    h.endsWith('.salelinx.com') ||
    h === 'chromewebstore.google.com' ||
    h === 'depop.com' ||
    h === 'www.depop.com' ||
    (h.startsWith('www.vinted.') &&
      (CTA_VINTED_MARKETS as readonly string[]).includes(h.slice('www.vinted.'.length))) ||
    (h.startsWith('www.ebay.') &&
      (CTA_EBAY_SITES as readonly string[]).includes(h.slice('www.ebay.'.length)))
  );
}

// True when the button may link here. The string checks are the RPC's, as
// written; parsing with URL on top makes sure a browser reads the same host
// (a backslash, for one, is a path separator to a browser, so
// https://evil.com\.salelinx.com opens evil.com).
export function ctaUrlOk(url: string): boolean {
  if (url.length > ANNOUNCEMENT_CTA_URL_MAX) return false;
  if (!url.startsWith('https://')) return false;
  if (CTA_BAD_CHAR_RE.test(url) || url.includes('@') || url.includes('\\')) return false;
  const match = CTA_HOST_RE.exec(url);
  if (!match || !ctaHostAllowed(match[1])) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password || parsed.port) return false;
  return ctaHostAllowed(parsed.hostname);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

const VERSION_RE = /^[0-9]+(\.[0-9]+){0,3}$/;

export function versionOk(version: string): boolean {
  return VERSION_RE.test(version);
}

// Four numbers, padded with zeros, so 1.6 equals 1.6.0 and 1.10 is above 1.9.
// Both must pass versionOk.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Draft validation
// ---------------------------------------------------------------------------

// The RPC's error codes, in the order it checks them, so the editor reports
// the same first problem the server would.
export type AnnouncementErrorCode =
  | 'invalid_severity'
  | 'invalid_title'
  | 'invalid_body'
  | 'invalid_cta'
  | 'invalid_cta_url'
  | 'invalid_audience'
  | 'invalid_version'
  | 'invalid_schedule';

export function validateAnnouncementDraft(
  draft: AnnouncementDraft,
  nowMs: number,
): AnnouncementErrorCode | null {
  if (!(ANNOUNCEMENT_SEVERITIES as readonly string[]).includes(draft.severity)) {
    return 'invalid_severity';
  }

  const title = cleanText(draft.title, ANNOUNCEMENT_TITLE_MAX);
  if (!title?.en) return 'invalid_title';
  const body = cleanText(draft.body, ANNOUNCEMENT_BODY_MAX);
  if (!body?.en) return 'invalid_body';

  let label: AnnouncementTextInput | null = null;
  if (draft.cta_label) {
    label = cleanText(draft.cta_label, ANNOUNCEMENT_CTA_LABEL_MAX);
    if (!label) return 'invalid_cta';
    if (Object.keys(label).length === 0) label = null;
  }
  const url = draft.cta_url ? trimText(draft.cta_url) || null : null;
  if ((label && !label.en) || (label === null) !== (url === null)) return 'invalid_cta';
  if (url && !ctaUrlOk(url)) return 'invalid_cta_url';

  if (
    !draft.audience_tiers.every((t) => (ANNOUNCEMENT_TIERS as readonly string[]).includes(t)) ||
    !draft.audience_platforms.every((p) =>
      (ANNOUNCEMENT_PLATFORMS as readonly string[]).includes(p),
    )
  ) {
    return 'invalid_audience';
  }

  const min = draft.min_version ? trimText(draft.min_version) || null : null;
  const max = draft.max_version ? trimText(draft.max_version) || null : null;
  if ((min && !versionOk(min)) || (max && !versionOk(max))) return 'invalid_version';
  if (min && max && compareVersions(min, max) > 0) return 'invalid_version';

  const starts = draft.starts_at ? Date.parse(draft.starts_at) : nowMs;
  if (Number.isNaN(starts)) return 'invalid_schedule';
  if (draft.ends_at !== null) {
    const ends = Date.parse(draft.ends_at);
    if (Number.isNaN(ends) || ends <= starts) return 'invalid_schedule';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Console display
// ---------------------------------------------------------------------------

// "Everyone", or e.g. "Pro, Business · Vinted · v1.5.0 to 1.6.1 · signed in".
export function audienceSummary(
  a: Pick<
    AnnouncementDraft,
    'audience_tiers' | 'audience_platforms' | 'min_version' | 'max_version' | 'signed_in_only'
  >,
): string {
  const parts: string[] = [];
  const tiers = ANNOUNCEMENT_TIERS.filter((t) => a.audience_tiers.includes(t));
  if (tiers.length) parts.push(tiers.map((t) => ANNOUNCEMENT_TIER_LABEL[t]).join(', '));
  const platforms = ANNOUNCEMENT_PLATFORMS.filter((p) => a.audience_platforms.includes(p));
  if (platforms.length) {
    parts.push(platforms.map((p) => ANNOUNCEMENT_PLATFORM_LABEL[p]).join(', '));
  }

  const min = a.min_version ? trimText(a.min_version) : '';
  const max = a.max_version ? trimText(a.max_version) : '';
  if (min && max) parts.push(`v${min} to ${max}`);
  else if (min) parts.push(`v${min} and later`);
  else if (max) parts.push(`up to v${max}`);

  if (a.signed_in_only) parts.push(parts.length ? 'signed in' : 'Signed in');
  return parts.length ? parts.join(' \u00b7 ') : 'Everyone';
}

export type AnnouncementPhase = 'live' | 'scheduled' | 'ended';

export function announcementPhase(
  a: Pick<Announcement, 'starts_at' | 'ends_at'>,
  nowMs: number,
): AnnouncementPhase {
  if (a.ends_at && Date.parse(a.ends_at) <= nowMs) return 'ended';
  return Date.parse(a.starts_at) > nowMs ? 'scheduled' : 'live';
}

// The console's three lists: live (newest start first), scheduled (soonest
// first) and the most recently ended.
export function groupAnnouncements(
  rows: Announcement[],
  nowMs: number,
): Record<AnnouncementPhase, Announcement[]> {
  const out: Record<AnnouncementPhase, Announcement[]> = { live: [], scheduled: [], ended: [] };
  for (const a of rows) out[announcementPhase(a, nowMs)].push(a);
  out.live.sort((x, y) => Date.parse(y.starts_at) - Date.parse(x.starts_at));
  out.scheduled.sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at));
  out.ended = out.ended
    .sort((x, y) => Date.parse(y.ends_at ?? '') - Date.parse(x.ends_at ?? ''))
    .slice(0, ANNOUNCEMENTS_ENDED_SHOWN);
  return out;
}

// <input type="datetime-local"> values, in the browser's own time zone.
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// The reverse: a local "YYYY-MM-DDTHH:mm" to an ISO timestamp, or null.
export function fromLocalInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
