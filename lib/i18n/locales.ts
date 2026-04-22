import { routing } from '@/i18n/routing';

export type Locale = (typeof routing.locales)[number];

export const LOCALES = routing.locales;
export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  fr: { short: 'FR', name: 'Français' },
  es: { short: 'ES', name: 'Español' },
  de: { short: 'DE', name: 'Deutsch' },
};
