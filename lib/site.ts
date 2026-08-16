import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://salelinx.com'
).replace(/\/$/, '');

export const SITE_NAME = 'SaleLinx';

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

export function languageAlternates(path: string = '/'): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of routing.locales) {
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
}: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  // The root layout applies a `%s | SaleLinx` template; set this on pages
  // whose title already contains the brand (the homepage).
  absoluteTitle?: boolean;
}): Metadata {
  const canonical = absoluteUrl(locale, path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      locale,
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
