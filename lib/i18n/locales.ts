import { routing } from '@/i18n/routing';

export type Locale = (typeof routing.locales)[number];

export const LOCALES = routing.locales;
export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  fr: { short: 'FR', name: 'Français' },
  es: { short: 'ES', name: 'Español' },
  de: { short: 'DE', name: 'Deutsch' },
  ar: { short: 'AR', name: 'العربية' },
  zh: { short: 'ZH', name: '简体中文' },
};

/** Locales written right to left. Drives the <html dir> attribute. */
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isRtlLocale(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export function dirForLocale(locale: string): 'rtl' | 'ltr' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}
