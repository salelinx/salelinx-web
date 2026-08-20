import { routing } from '@/i18n/routing';
import { LOCALES, type Locale } from '@/lib/i18n/locales';

/**
 * Country -> locale, used only as a fallback when the visitor's browser
 * languages name nothing we support. Deliberately conservative: countries
 * with no single dominant language among our four (Belgium, Switzerland,
 * Canada) are left out so we don't guess wrong for half their population.
 */
const COUNTRY_LOCALE: Record<string, Locale> = {
  FR: 'fr',
  MC: 'fr',
  DE: 'de',
  AT: 'de',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  VE: 'es',
  EC: 'es',
  GT: 'es',
  CU: 'es',
  BO: 'es',
  DO: 'es',
  HN: 'es',
  PY: 'es',
  SV: 'es',
  NI: 'es',
  CR: 'es',
  PA: 'es',
  UY: 'es',
  CN: 'zh',
  SG: 'zh',
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  MA: 'ar',
  DZ: 'ar',
  TN: 'ar',
  JO: 'ar',
  KW: 'ar',
  QA: 'ar',
  BH: 'ar',
  OM: 'ar',
  IQ: 'ar',
  LY: 'ar',
  YE: 'ar',
  SY: 'ar',
  LB: 'ar',
};

/** True when the path already carries a locale prefix (/fr, /es/pricing, ...). */
export function hasLocalePrefix(pathname: string): boolean {
  return LOCALES.some(
    (code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`),
  );
}

/**
 * Does the Accept-Language header name a locale we support? next-intl already
 * handles this case on its own, so it is only used here to decide whether the
 * country fallback should get a say at all.
 */
export function acceptLanguageMatches(header: string | null): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '')
    .some((tag) => LOCALES.some((code) => tag === code || tag.startsWith(`${code}-`)));
}

/**
 * Locale predicted from the visitor's country, or null when we have no
 * confident mapping. `country` comes from Vercel's `x-vercel-ip-country`
 * header, which is absent in local dev.
 */
export function localeFromCountry(country: string | null): Locale | null {
  if (!country) return null;
  const locale = COUNTRY_LOCALE[country.toUpperCase()];
  if (!locale || locale === routing.defaultLocale) return null;
  return locale;
}
