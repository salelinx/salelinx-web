// "Send me a test" on /admin/announcements: one click builds a real
// announcement aimed only at the admin who sent it, with sample copy for a
// starting point, in the places and frequency picked, ending an hour later. It
// goes through admin_save_announcement like any other, so it tests the whole
// path down to the admin's own extension. Pure, so the console and the tests
// share it; the server action fills in the admin's email and the clock.

import {
  ANNOUNCEMENT_PRESETS,
  editorPlacements,
  type AnnouncementButtonInput,
  type AnnouncementDraft,
  type AnnouncementFrequency,
  type AnnouncementPlacement,
  type AnnouncementPresetKey,
  type AnnouncementTextInput,
} from './types';

// Every test title starts with this, so a test is easy to spot in the lists.
export const TEST_TITLE_PREFIX = 'Test: ';

// How long a test stays live before it ends on its own.
export const TEST_LIFETIME_MS = 60 * 60 * 1000;

type Sample = {
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  emoji?: string;
  buttons: AnnouncementButtonInput[];
};

// Copy in English and French, so switching the extension to French shows the
// translation, and to Spanish or German shows the English fallback.
const SAMPLES: Record<AnnouncementPresetKey, Sample> = {
  outage: {
    title: { en: 'Vinted crosslisting is down', fr: 'Le crosslisting Vinted est en panne' },
    body: {
      en: 'Vinted changed something on their side and we are on it.\nYour listings are safe.',
      fr: 'Vinted a changé quelque chose de son côté et nous nous en occupons.\nVos annonces ne risquent rien.',
    },
    buttons: [
      { label: { en: 'Status page', fr: 'Page de statut' }, url: 'https://salelinx.com' },
      { label: { en: 'Contact us', fr: 'Nous contacter' }, url: 'https://salelinx.com/support' },
    ],
  },
  warning: {
    title: { en: 'Depop is slow right now', fr: 'Depop est lent en ce moment' },
    body: {
      en: 'Bots may take longer than usual. Nothing needs doing on your side.',
      fr: 'Les bots peuvent prendre plus de temps que d’habitude. Rien à faire de votre côté.',
    },
    buttons: [],
  },
  news: {
    title: { en: 'A new version is out', fr: 'Une nouvelle version est disponible' },
    body: {
      en: 'Update SaleLinx to get the latest fixes.',
      fr: 'Mettez SaleLinx à jour pour profiter des dernières corrections.',
    },
    buttons: [
      { label: { en: 'Update', fr: 'Mettre à jour' }, url: 'https://chromewebstore.google.com' },
    ],
  },
  feature: {
    title: { en: 'New: bulk photo editing', fr: 'Nouveau : retouche photo en masse' },
    body: {
      en: 'Edit the photos of up to 50 listings at once from My Listings.',
      fr: 'Retouchez les photos de 50 annonces à la fois depuis Mes annonces.',
    },
    emoji: '\u{1F389}',
    buttons: [{ label: { en: 'Try it', fr: 'Essayer' }, url: 'https://salelinx.com' }],
  },
  offer: {
    title: { en: '30% off Pro this week', fr: '30 % de réduction sur Pro cette semaine' },
    body: {
      en: 'Upgrade before Sunday to keep the discount for a year.',
      fr: 'Passez à Pro avant dimanche pour garder la réduction pendant un an.',
    },
    buttons: [
      { label: { en: 'See plans', fr: 'Voir les offres' }, url: 'https://salelinx.com/pricing' },
    ],
  },
  tip: {
    title: { en: 'Tip: Shift-click to select many', fr: 'Astuce : Maj-clic pour en choisir plusieurs' },
    body: {
      en: 'Click one listing, then Shift-click another to select everything between.',
      fr: 'Cliquez sur une annonce, puis Maj-clic sur une autre pour tout sélectionner entre les deux.',
    },
    buttons: [],
  },
};

export type TestOptions = {
  preset: AnnouncementPresetKey;
  // Any of the places the editor offers; at least one.
  places: AnnouncementPlacement[];
  frequency: AnnouncementFrequency;
};

function prefixed(text: AnnouncementTextInput): AnnouncementTextInput {
  const out: AnnouncementTextInput = {};
  for (const [locale, value] of Object.entries(text)) {
    out[locale as keyof AnnouncementTextInput] = `${TEST_TITLE_PREFIX}${value}`;
  }
  return out;
}

// The draft for a test: the starting point's look and priority with its
// sample copy, the places and frequency picked, for `email` only, live from
// now for an hour.
export function buildTestDraft(options: TestOptions, email: string, nowMs: number): AnnouncementDraft {
  const preset =
    ANNOUNCEMENT_PRESETS.find((p) => p.key === options.preset) ?? ANNOUNCEMENT_PRESETS[0];
  const sample = SAMPLES[preset.key];
  return {
    id: null,
    priority: preset.priority,
    theme: preset.theme,
    icon: preset.icon,
    emoji: sample.emoji ?? null,
    title: prefixed(sample.title),
    body: sample.body,
    image_path: null,
    buttons: sample.buttons,
    placements: editorPlacements(options.places),
    frequency: options.frequency,
    audience_tiers: [],
    audience_platforms: [],
    audience_locales: [],
    audience_tabs: [],
    min_version: null,
    max_version: null,
    signed_in_only: false,
    starts_at: null,
    ends_at: new Date(nowMs + TEST_LIFETIME_MS).toISOString(),
    recipients: [email.trim().toLowerCase()],
  };
}
