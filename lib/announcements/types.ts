// Shapes and pure helpers for the extension announcements edited in
// /admin/announcements. Rows live in the announcements table (migration
// 064_announcements.sql); the extension reads them through the
// active_announcements() RPC and is told about changes by the
// announcement_signal counter. No server-only imports here: the admin editor
// is a Client Component and imports these too. The loader is in ./data.ts.
//
// The checks below mirror admin_save_announcement() so the editor can answer
// instantly. The RPC stays the boundary: anything that slips past these is
// refused there with the same error code.
//
// Themes, icons, placements and frequencies are drawn by the extension
// (salelinx-app src/shared/announcements.ts and src/panel/announcements.ts),
// so these lists must match it and the migration's CHECKs. The panel tab list
// is only here: the migration checks a tab id's shape, not its name.

export const ANNOUNCEMENT_PRIORITIES = ['normal', 'high', 'urgent'] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_THEMES = ['blue', 'green', 'purple', 'amber', 'red', 'grey'] as const;
export type AnnouncementTheme = (typeof ANNOUNCEMENT_THEMES)[number];

export const ANNOUNCEMENT_ICONS = [
  'none',
  'info',
  'warning',
  'alert',
  'megaphone',
  'sparkles',
  'gift',
  'lightbulb',
  'wrench',
  'bell',
  'star',
  'heart',
] as const;
export type AnnouncementIcon = (typeof ANNOUNCEMENT_ICONS)[number];

export const ANNOUNCEMENT_PLACEMENTS = [
  'banner',
  'popup',
  'launcher',
  'login',
  'badge',
  'toolbar',
] as const;
export type AnnouncementPlacement = (typeof ANNOUNCEMENT_PLACEMENTS)[number];

// Places that exist inside the panel, the only ones a tab-targeted message
// may use (the launcher card, login screen, badge and toolbar popup have no
// tab).
export const ANNOUNCEMENT_PANEL_PLACEMENTS: readonly AnnouncementPlacement[] = ['banner', 'popup'];

// The places the editor offers; a message can use any mix of them. The table
// also allows 'badge' and 'toolbar' (the toolbar icon and its popup) from the
// first design, but nobody looks there, so they are not offered and the
// extension ignores them.
export const ANNOUNCEMENT_EDITOR_PLACEMENTS = ['banner', 'popup', 'launcher', 'login'] as const;
export type AnnouncementEditorPlacement = (typeof ANNOUNCEMENT_EDITOR_PLACEMENTS)[number];

// The login screen is what people signed out of SaleLinx see (it covers the
// panel), and the only place they see: the extension gives someone signed out
// only 'login' and someone signed in every place but 'login'. These are the
// places for people signed in, which is all a quick test (sent to you, so
// signed in) can use.
export const ANNOUNCEMENT_SIGNED_IN_PLACEMENTS = ['banner', 'popup', 'launcher'] as const;

// Plans, panel tabs and specific people only ever match someone signed in, so
// a message for any of them cannot use the login screen.
export function loginScreenAllowed(a: {
  audience_tiers: readonly string[];
  audience_tabs: readonly string[];
  recipients: readonly string[];
}): boolean {
  return !a.audience_tiers.length && !a.audience_tabs.length && !a.recipients.length;
}

export const ANNOUNCEMENT_FREQUENCIES = ['until_closed', 'once', 'every_open', 'always'] as const;
export type AnnouncementFrequency = (typeof ANNOUNCEMENT_FREQUENCIES)[number];

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

// The extension panel's tabs: each is the panel's data-tab id, named as the
// panel titles it in English (salelinx-app src/panel/i18n/locales/en.ts,
// page.<id>). A tab added to the panel only needs adding here.
export const ANNOUNCEMENT_TABS = [
  'listings',
  'crosslist',
  'relist',
  'refresh',
  'automarkdown',
  'offers',
  'autooffers',
  'conversations',
  'shipping',
  'linking',
  'deadstock',
  'restocker',
  'bots',
  'designer',
  'referrals',
  'support',
  'settings',
] as const;
export type AnnouncementTab = (typeof ANNOUNCEMENT_TABS)[number];

export const ANNOUNCEMENT_TAB_LABEL: Record<AnnouncementTab, string> = {
  listings: 'My Listings',
  crosslist: 'Crosslist',
  relist: 'Relist',
  refresh: 'Refresh Listings',
  automarkdown: 'Price Drops',
  offers: 'Offers',
  autooffers: 'Send Offers',
  conversations: 'Messages',
  shipping: 'Shipping Labels',
  linking: 'Linking',
  deadstock: 'Dead Stock',
  restocker: 'Restocker',
  bots: 'Grow',
  designer: 'Shop Designer',
  referrals: 'Refer & Earn',
  support: 'Support',
  settings: 'Settings',
};

export const ANNOUNCEMENT_PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const ANNOUNCEMENT_THEME_LABEL: Record<AnnouncementTheme, string> = {
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
  amber: 'Amber',
  red: 'Red',
  grey: 'Grey',
};

// The accent each theme draws with, as the extension's light mode and toolbar
// popup draw it (salelinx-app popup.css). The console's preview uses these;
// they read on its dark surface too.
export const ANNOUNCEMENT_THEME_COLOR: Record<AnnouncementTheme, string> = {
  blue: '#2563eb',
  green: '#059669',
  purple: '#7c3aed',
  amber: '#d97706',
  red: '#dc2626',
  grey: '#52525b',
};

export const ANNOUNCEMENT_ICON_LABEL: Record<AnnouncementIcon, string> = {
  none: 'No icon',
  info: 'Info',
  warning: 'Warning',
  alert: 'Alert',
  megaphone: 'Megaphone',
  sparkles: 'Sparkles',
  gift: 'Gift',
  lightbulb: 'Light bulb',
  wrench: 'Wrench',
  bell: 'Bell',
  star: 'Star',
  heart: 'Heart',
};

// The inside of a 24x24 stroke icon (stroke="currentColor", stroke-width 2,
// round caps and joins), the same markup the extension draws. Static strings,
// never admin input.
export const ANNOUNCEMENT_ICON_SVG: Record<Exclude<AnnouncementIcon, 'none'>, string> = {
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  warning:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  alert:
    '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  sparkles:
    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  lightbulb:
    '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  heart:
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
};

export const ANNOUNCEMENT_PLACEMENT_LABEL: Record<AnnouncementEditorPlacement, string> = {
  banner: 'Banner in the panel',
  popup: 'Popup over the panel',
  launcher: 'Card by the launcher',
  login: 'Login screen',
};

export const ANNOUNCEMENT_PLACEMENT_HINT: Record<AnnouncementEditorPlacement, string> = {
  banner: 'At the top of every tab.',
  popup: 'Over the panel, the next time it is open.',
  launcher: 'A small card by the launcher button while the panel is closed.',
  login: 'Above the sign-in form, for people signed out of SaleLinx. Only they see it here.',
};

// The offered places a stored message uses, in a fixed order. A banner when it
// has none of them (only the toolbar places of the first design).
export function editorPlacements(
  placements: readonly AnnouncementPlacement[],
): AnnouncementPlacement[] {
  const kept = ANNOUNCEMENT_EDITOR_PLACEMENTS.filter((p) => placements.includes(p));
  return kept.length ? kept : ['banner'];
}

// Tick or untick a place, keeping a fixed order whatever order they are
// ticked in. With tabs chosen only the panel's own places can be ticked.
export function togglePlacement(
  placements: readonly AnnouncementPlacement[],
  place: AnnouncementEditorPlacement,
  on: boolean,
  tabs: readonly string[],
): AnnouncementPlacement[] {
  if (on && tabs.length && !ANNOUNCEMENT_PANEL_PLACEMENTS.includes(place)) return [...placements];
  const set = new Set(placements);
  if (on) set.add(place);
  else set.delete(place);
  return ANNOUNCEMENT_EDITOR_PLACEMENTS.filter((p) => set.has(p));
}

export const ANNOUNCEMENT_FREQUENCY_LABEL: Record<AnnouncementFrequency, string> = {
  until_closed: 'Until they close it',
  once: 'Once only',
  every_open: 'Every time the panel opens',
  always: 'Always',
};

export const ANNOUNCEMENT_FREQUENCY_HINT: Record<AnnouncementFrequency, string> = {
  until_closed: 'Shows until the user closes it with the X.',
  once: 'Shows the first time, then never again.',
  every_open: 'Closing it hides it until the panel is next opened.',
  always: 'No close button. It stays until it ends.',
};

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

export const ANNOUNCEMENT_LOCALE_LABEL: Record<AnnouncementLocale, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
};

// Same caps as admin_save_announcement (characters, after trimming).
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 600;
export const ANNOUNCEMENT_BUTTON_LABEL_MAX = 40;
export const ANNOUNCEMENT_BUTTON_URL_MAX = 500;
export const ANNOUNCEMENT_BUTTONS_MAX = 2;
export const ANNOUNCEMENT_EMOJI_MAX = 16;
export const ANNOUNCEMENT_RECIPIENTS_MAX = 1000;
export const ANNOUNCEMENT_TABS_MAX = 30;

// The announcement-images bucket (064_announcements.sql): public, admin
// writes, 2 MB, still images only.
export const ANNOUNCEMENT_IMAGE_BUCKET = 'announcement-images';
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const ANNOUNCEMENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

// How many ended announcements the console lists.
export const ANNOUNCEMENTS_ENDED_SHOWN = 20;

// Copy as stored: English always present, the others optional (a missing one
// falls back to English in the extension).
export type AnnouncementText = Partial<Record<AnnouncementLocale, string>> & { en: string };

// Copy as typed in the editor: any locale may be blank, English included.
export type AnnouncementTextInput = Partial<Record<AnnouncementLocale, string>>;

export type AnnouncementButton = { label: AnnouncementText; url: string };
export type AnnouncementButtonInput = { label: AnnouncementTextInput; url: string };

export type Announcement = {
  id: string;
  priority: AnnouncementPriority;
  theme: AnnouncementTheme;
  icon: AnnouncementIcon;
  // Shown instead of the icon when set.
  emoji: string | null;
  title: AnnouncementText;
  body: AnnouncementText;
  // A path inside the announcement-images bucket.
  image_path: string | null;
  buttons: AnnouncementButton[];
  placements: AnnouncementPlacement[];
  frequency: AnnouncementFrequency;
  // Empty means everyone.
  audience_tiers: AnnouncementTier[];
  audience_platforms: AnnouncementPlatform[];
  audience_locales: AnnouncementLocale[];
  // Tab ids; may hold one this console no longer lists.
  audience_tabs: string[];
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

// A row as the console lists it: with its recipients' emails (empty for
// everyone), from admin_announcement_recipients().
export type AnnouncementRow = Announcement & { recipients: string[] };

// What the console sends to admin_save_announcement (p_data, plus the
// recipients as p_recipient_emails).
export type AnnouncementDraft = {
  // Null for a new announcement (the RPC picks the id).
  id: string | null;
  priority: AnnouncementPriority;
  theme: AnnouncementTheme;
  icon: AnnouncementIcon;
  emoji: string | null;
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  image_path: string | null;
  buttons: AnnouncementButtonInput[];
  placements: AnnouncementPlacement[];
  frequency: AnnouncementFrequency;
  audience_tiers: AnnouncementTier[];
  audience_platforms: AnnouncementPlatform[];
  audience_locales: AnnouncementLocale[];
  audience_tabs: string[];
  min_version: string | null;
  max_version: string | null;
  signed_in_only: boolean;
  // ISO timestamps. A null start means now; a null end means never.
  starts_at: string | null;
  ends_at: string | null;
  // Emails; empty means no specific users.
  recipients: string[];
};

// p_data for admin_save_announcement: the draft's fields, named as the columns.
export function announcementRpcData(draft: AnnouncementDraft): Record<string, unknown> {
  const data: Record<string, unknown> = { ...draft };
  delete data.id;
  delete data.recipients;
  return data;
}

// ---------------------------------------------------------------------------
// Starting points. Picking one in the editor fills in the look, the places,
// how often and the priority; every value can still be changed after.
// ---------------------------------------------------------------------------

export type AnnouncementPresetKey = 'outage' | 'warning' | 'news' | 'feature' | 'offer' | 'tip';

export type AnnouncementPreset = {
  key: AnnouncementPresetKey;
  label: string;
  hint: string;
  priority: AnnouncementPriority;
  theme: AnnouncementTheme;
  icon: AnnouncementIcon;
  placements: AnnouncementPlacement[];
  frequency: AnnouncementFrequency;
};

export const ANNOUNCEMENT_PRESETS: readonly AnnouncementPreset[] = [
  {
    key: 'outage',
    label: 'Outage',
    hint: 'Something is broken. Everywhere: a banner, a popup and the launcher card.',
    priority: 'urgent',
    theme: 'red',
    icon: 'alert',
    placements: ['banner', 'popup', 'launcher'],
    frequency: 'until_closed',
  },
  {
    key: 'warning',
    label: 'Warning',
    hint: 'Something to watch out for, e.g. a slow marketplace.',
    priority: 'high',
    theme: 'amber',
    icon: 'warning',
    placements: ['banner', 'launcher'],
    frequency: 'until_closed',
  },
  {
    key: 'news',
    label: 'News',
    hint: 'General news, e.g. "please update to the latest version".',
    priority: 'normal',
    theme: 'blue',
    icon: 'megaphone',
    placements: ['banner'],
    frequency: 'until_closed',
  },
  {
    key: 'feature',
    label: 'New feature',
    hint: 'Show off something new, once, with a popup.',
    priority: 'normal',
    theme: 'purple',
    icon: 'sparkles',
    placements: ['banner', 'popup'],
    frequency: 'once',
  },
  {
    key: 'offer',
    label: 'Offer',
    hint: 'A discount or promotion.',
    priority: 'normal',
    theme: 'green',
    icon: 'gift',
    placements: ['banner', 'launcher'],
    frequency: 'until_closed',
  },
  {
    key: 'tip',
    label: 'Tip',
    hint: 'A quiet hint, often for one tab.',
    priority: 'normal',
    theme: 'grey',
    icon: 'lightbulb',
    placements: ['banner'],
    frequency: 'until_closed',
  },
];

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

// Choosing tabs drops the places that have no tab. Falls back to the banner so
// the message still shows somewhere.
export function placementsForTabs(
  placements: readonly AnnouncementPlacement[],
  tabs: readonly string[],
): AnnouncementPlacement[] {
  if (!tabs.length) return [...placements];
  const kept = placements.filter((p) => ANNOUNCEMENT_PANEL_PLACEMENTS.includes(p));
  return kept.length ? kept : ['banner'];
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

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

// Locales other than English with no title or body, among the languages the
// message is aimed at (all four when it is not narrowed). Drives the "English
// shown for" hint in the console.
export function missingAnnouncementLocales(
  a: Pick<Announcement, 'title' | 'body'> & { audience_locales?: readonly AnnouncementLocale[] },
): AnnouncementLocale[] {
  const aimed = a.audience_locales?.length ? a.audience_locales : ANNOUNCEMENT_LOCALES;
  return ANNOUNCEMENT_LOCALES.filter(
    (l) => l !== 'en' && aimed.includes(l) && (!a.title[l] || !a.body[l]),
  );
}

// An emoji may be up to 16 characters (flags and family emoji are several code
// points) with no whitespace or control characters, as the RPC checks.
const EMOJI_BAD_RE = /[\s\u0000-\u001f\u007f]/;

export function emojiOk(emoji: string): boolean {
  const e = trimText(emoji);
  return e.length > 0 && charCount(e) <= ANNOUNCEMENT_EMOJI_MAX && !EMOJI_BAD_RE.test(e);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const IMAGE_PATH_RE = /^[a-z0-9][a-z0-9_.-]*(\/[a-z0-9][a-z0-9_.-]*)*$/;

// The shape the RPC accepts. Whether the file exists is the RPC's check.
export function imagePathOk(path: string): boolean {
  return path.length <= 200 && IMAGE_PATH_RE.test(path);
}

// A bucket path for a new upload: year/month/random.ext, which always passes
// imagePathOk.
export function announcementImagePath(fileType: string, now = new Date(), random = randomId()): string {
  const ext =
    fileType === 'image/png'
      ? 'png'
      : fileType === 'image/webp'
        ? 'webp'
        : fileType === 'image/gif'
          ? 'gif'
          : 'jpg';
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}/${month}/${random}.${ext}`;
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The public address the extension loads the image from.
export function announcementImageUrl(path: string, supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${ANNOUNCEMENT_IMAGE_BUCKET}/${path}`;
}

// ---------------------------------------------------------------------------
// Button URL allowlist. Mirrors announcement_cta_url_ok() in
// 064_announcements.sql (tests/announcements.test.ts checks the two lists
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

// True when a button may link here. The string checks are the RPC's, as
// written; parsing with URL on top makes sure a browser reads the same host
// (a backslash, for one, is a path separator to a browser, so
// https://evil.com\.salelinx.com opens evil.com).
export function ctaUrlOk(url: string): boolean {
  if (url.length > ANNOUNCEMENT_BUTTON_URL_MAX) return false;
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
// Recipients
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Emails pasted into the editor, one per line or separated by commas,
// semicolons or spaces: trimmed, lowercased, de-duplicated, in first-seen
// order. Whether each is a real account is the RPC's check.
export function parseRecipientEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return [...seen];
}

export function emailLooksOk(email: string): boolean {
  return EMAIL_RE.test(email);
}

// ---------------------------------------------------------------------------
// Draft validation
// ---------------------------------------------------------------------------

// The RPC's error codes, in the order it checks them, so the editor reports
// the same first problem the server would. invalid_recipients (an entry that
// is not an email at all) is the editor's own; the RPC reports such an entry
// as an unknown recipient.
export type AnnouncementErrorCode =
  | 'invalid_priority'
  | 'invalid_look'
  | 'invalid_title'
  | 'invalid_body'
  | 'invalid_image'
  | 'invalid_buttons'
  | 'invalid_button_url'
  | 'invalid_placements'
  | 'invalid_frequency'
  | 'invalid_audience'
  | 'invalid_tabs'
  | 'invalid_version'
  | 'invalid_schedule'
  | 'too_many_recipients'
  | 'invalid_recipients';

// Every code the RPC or the editor can answer, worded for the admin.
export const ANNOUNCEMENT_ERROR_MESSAGE: Record<string, string> = {
  invalid_priority: 'Pick a priority.',
  invalid_look: 'Pick a colour and icon. An emoji must be one emoji with no spaces.',
  invalid_title: `The title needs English, and at most ${ANNOUNCEMENT_TITLE_MAX} characters in each language.`,
  invalid_body: `The message needs English, and at most ${ANNOUNCEMENT_BODY_MAX} characters in each language.`,
  invalid_image: 'The image is missing. Upload it again.',
  invalid_buttons: `Each button needs an English label (at most ${ANNOUNCEMENT_BUTTON_LABEL_MAX} characters) and a link.`,
  invalid_button_url:
    'A button can only link to SaleLinx, the Chrome Web Store, Depop, Vinted or eBay, over https.',
  invalid_placements: 'Tick at least one place to show it.',
  invalid_frequency: 'Pick how often it shows.',
  invalid_audience: 'One of the audience choices is not one the extension knows.',
  invalid_tabs: 'A message for certain tabs can only show as a banner or popup in the panel.',
  invalid_version: 'Versions look like 1.2.7, and the lowest must not be above the highest.',
  invalid_schedule: 'The end must be after the start.',
  too_many_recipients: `At most ${ANNOUNCEMENT_RECIPIENTS_MAX} specific users.`,
  invalid_recipients: 'One of the specific users is not an email address.',
  unknown_recipients: 'No account has one or more of these emails.',
  not_found: 'This announcement no longer exists.',
  id_taken: 'An announcement with this id already exists.',
  missing_start: 'Pick a start time.',
  no_email: 'Your admin account has no email address, so a test cannot be sent to you.',
  invalid_test: 'Pick a starting point, at least one place and how often.',
  missing_end: 'Pick an end time.',
};

export function validateAnnouncementDraft(
  draft: AnnouncementDraft,
  nowMs: number,
): AnnouncementErrorCode | null {
  if (!(ANNOUNCEMENT_PRIORITIES as readonly string[]).includes(draft.priority)) {
    return 'invalid_priority';
  }
  if (
    !(ANNOUNCEMENT_THEMES as readonly string[]).includes(draft.theme) ||
    !(ANNOUNCEMENT_ICONS as readonly string[]).includes(draft.icon) ||
    (draft.emoji !== null && trimText(draft.emoji) !== '' && !emojiOk(draft.emoji))
  ) {
    return 'invalid_look';
  }

  const title = cleanText(draft.title, ANNOUNCEMENT_TITLE_MAX);
  if (!title?.en) return 'invalid_title';
  const body = cleanText(draft.body, ANNOUNCEMENT_BODY_MAX);
  if (!body?.en) return 'invalid_body';

  if (draft.image_path !== null && trimText(draft.image_path) !== '') {
    if (!imagePathOk(trimText(draft.image_path))) return 'invalid_image';
  }

  if (draft.buttons.length > ANNOUNCEMENT_BUTTONS_MAX) return 'invalid_buttons';
  for (const b of draft.buttons) {
    const label = cleanText(b.label, ANNOUNCEMENT_BUTTON_LABEL_MAX);
    if (!label) return 'invalid_buttons';
    const url = trimText(b.url ?? '');
    if (Object.keys(label).length === 0 && !url) continue;
    if (!label.en || !url) return 'invalid_buttons';
    if (!ctaUrlOk(url)) return 'invalid_button_url';
  }

  // The RPC takes any of the table's places; the editor sends the ones it offers.
  const places = draft.placements;
  if (
    places.length === 0 ||
    !places.every((p) => (ANNOUNCEMENT_EDITOR_PLACEMENTS as readonly string[]).includes(p))
  ) {
    return 'invalid_placements';
  }

  if (!(ANNOUNCEMENT_FREQUENCIES as readonly string[]).includes(draft.frequency)) {
    return 'invalid_frequency';
  }

  if (
    !draft.audience_tiers.every((t) => (ANNOUNCEMENT_TIERS as readonly string[]).includes(t)) ||
    !draft.audience_platforms.every((p) =>
      (ANNOUNCEMENT_PLATFORMS as readonly string[]).includes(p),
    ) ||
    !draft.audience_locales.every((l) => (ANNOUNCEMENT_LOCALES as readonly string[]).includes(l))
  ) {
    return 'invalid_audience';
  }

  if (
    draft.audience_tabs.length > ANNOUNCEMENT_TABS_MAX ||
    !draft.audience_tabs.every((t) => /^[a-z]{2,30}$/.test(t)) ||
    (draft.audience_tabs.length > 0 &&
      !places.every((p) => ANNOUNCEMENT_PANEL_PLACEMENTS.includes(p)))
  ) {
    return 'invalid_tabs';
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

  if (draft.recipients.length > ANNOUNCEMENT_RECIPIENTS_MAX) return 'too_many_recipients';
  if (!draft.recipients.every(emailLooksOk)) return 'invalid_recipients';
  return null;
}

// ---------------------------------------------------------------------------
// Console display
// ---------------------------------------------------------------------------

// "Everyone", or e.g. "Pro, Business · Vinted · French · Crosslist tab ·
// v1.5.0 to 1.6.1 · 3 people". Signed in or out follows from the places (the
// login screen is the one for people signed out), so it is not repeated here.
export function audienceSummary(
  a: Pick<
    AnnouncementDraft,
    | 'audience_tiers'
    | 'audience_platforms'
    | 'audience_locales'
    | 'audience_tabs'
    | 'min_version'
    | 'max_version'
    | 'recipients'
  >,
): string {
  const parts: string[] = [];
  const tiers = ANNOUNCEMENT_TIERS.filter((t) => a.audience_tiers.includes(t));
  if (tiers.length) parts.push(tiers.map((t) => ANNOUNCEMENT_TIER_LABEL[t]).join(', '));
  const platforms = ANNOUNCEMENT_PLATFORMS.filter((p) => a.audience_platforms.includes(p));
  if (platforms.length) {
    parts.push(platforms.map((p) => ANNOUNCEMENT_PLATFORM_LABEL[p]).join(', '));
  }
  const locales = ANNOUNCEMENT_LOCALES.filter((l) => a.audience_locales.includes(l));
  if (locales.length) parts.push(locales.map((l) => ANNOUNCEMENT_LOCALE_LABEL[l]).join(', '));
  if (a.audience_tabs.length) {
    const names = a.audience_tabs.map((t) =>
      t in ANNOUNCEMENT_TAB_LABEL ? ANNOUNCEMENT_TAB_LABEL[t as AnnouncementTab] : t,
    );
    parts.push(`${names.join(', ')} ${names.length === 1 ? 'tab' : 'tabs'}`);
  }

  const min = a.min_version ? trimText(a.min_version) : '';
  const max = a.max_version ? trimText(a.max_version) : '';
  if (min && max) parts.push(`v${min} to ${max}`);
  else if (min) parts.push(`v${min} and later`);
  else if (max) parts.push(`up to v${max}`);

  if (a.recipients.length) {
    const n = a.recipients.length;
    parts.push(n === 1 ? '1 person' : `${n} people`);
  }
  return parts.length ? parts.join(' · ') : 'Everyone';
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
export function groupAnnouncements<T extends Pick<Announcement, 'starts_at' | 'ends_at'>>(
  rows: T[],
  nowMs: number,
): Record<AnnouncementPhase, T[]> {
  const out: Record<AnnouncementPhase, T[]> = { live: [], scheduled: [], ended: [] };
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
