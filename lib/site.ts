import { routing } from '@/i18n/routing';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://salelinx.com'
).replace(/\/$/, '');

export const SITE_NAME = 'SaleLinx';

export function localePathPrefix(locale: string): string {
  return locale === routing.defaultLocale ? '' : `/${locale}`;
}

export function absoluteUrl(locale: string, path: string = '/'): string {
  const prefix = localePathPrefix(locale);
  const normalizedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const pathname = `${prefix}${normalizedPath}` || '/';
  return `${SITE_URL}${pathname}`;
}

export function languageAlternates(path: string = '/'): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of routing.locales) {
    alternates[locale] = absoluteUrl(locale, path);
  }
  alternates['x-default'] = absoluteUrl(routing.defaultLocale, path);
  return alternates;
}
