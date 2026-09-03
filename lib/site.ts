import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://salelinx.com'
).replace(/\/$/, '');

export const SITE_NAME = 'SaleLinx';

// Version of the Terms of Service a new account accepts at signup, recorded in
// the user's metadata (terms_version + terms_accepted_at) as evidence of
// acceptance. Bump this to the new LAST_UPDATED date whenever the Terms change
// materially so future signups record the version they actually agreed to.
export const TERMS_VERSION = '2026-09-02';

// Live listing: https://chromewebstore.google.com/detail/salelinx/oichfmfogobecihmhlgkfcfbdceomenj
export const CHROME_WEB_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_ID
  ? `https://chromewebstore.google.com/detail/salelinx/${process.env.NEXT_PUBLIC_EXTENSION_ID}`
  : 'https://chromewebstore.google.com/detail/salelinx/oichfmfogobecihmhlgkfcfbdceomenj';

export function localePathPrefix(locale: string): string {
  return locale === routing.defaultLocale ? '' : `/${locale}`;
}

export function absoluteUrl(locale: string, path: string = '/'): string {
  const prefix = localePathPrefix(locale);
  const normalizedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const pathname = `${prefix}${normalizedPath}` || '/';
  return `${SITE_URL}${pathname}`;
}

export function languageAlternates(
  path: string = '/',
  locales: readonly string[] = routing.locales,
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of locales) {
    alternates[locale] = absoluteUrl(locale, path);
  }
  alternates['x-default'] = absoluteUrl(routing.defaultLocale, path);
  return alternates;
}

// Shared metadata builder for indexable pages. Next.js merges metadata
// shallowly per top-level key, so a page that omits `alternates` or
// `openGraph` would inherit the layout's values wholesale (wrong canonical,
// wrong share URL). Every public page should build its metadata through this
// so canonical, hreflang, and social tags always point at the page itself.
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
  contentLocales,
}: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  // The root layout applies a `%s | SaleLinx` template; set this on pages
  // whose title already contains the brand (the homepage).
  absoluteTitle?: boolean;
  // Locales whose version of this page carries genuinely translated body
  // content. Defaults to every site locale (fully translated pages). When the
  // current locale is NOT in the list, the page is serving fallback English
  // text under a localized URL, so its canonical points at the default-locale
  // URL to consolidate the duplicates instead of competing with them. A
  // single-entry list (the English-only legal pages) drops the hreflang block
  // entirely: one language needs no alternates.
  contentLocales?: readonly string[];
}): Metadata {
  const translated = !contentLocales || contentLocales.includes(locale);
  const canonicalLocale = translated ? locale : routing.defaultLocale;
  const canonical = absoluteUrl(canonicalLocale, path);
  const languages =
    contentLocales && contentLocales.length <= 1
      ? undefined
      : languageAlternates(path, contentLocales);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      locale: canonicalLocale,
      images: [
        {
          url: '/og.png',
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
    },
  };
}
