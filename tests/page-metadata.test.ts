// pageMetadata's contentLocales contract: locales serving fallback English
// content must canonicalize to the default-locale URL and never appear in
// hreflang, and single-language pages (the legal pages) must carry no
// hreflang block at all. The sitemap builds its alternates from the same
// lists, so this pins the page half of that agreement.
import { describe, expect, it } from 'vitest';
import { pageMetadata } from '@/lib/site';

const DOCS_LOCALES = ['en', 'fr', 'es', 'de'];

describe('pageMetadata contentLocales', () => {
  it('fully translated pages keep a localized canonical and all locales in hreflang', () => {
    const meta = pageMetadata({ locale: 'fr', path: '/features', title: 'x' });
    expect(meta.alternates?.canonical).toBe('https://salelinx.com/fr/features');
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages)).toEqual(
      expect.arrayContaining(['en', 'fr', 'es', 'de', 'ar', 'zh', 'x-default']),
    );
  });

  it('a translated docs locale keeps its own canonical but hreflang omits fallback locales', () => {
    const meta = pageMetadata({
      locale: 'de',
      path: '/docs/inventory/crosslist',
      title: 'x',
      contentLocales: DOCS_LOCALES,
    });
    expect(meta.alternates?.canonical).toBe(
      'https://salelinx.com/de/docs/inventory/crosslist',
    );
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual(
      ['de', 'en', 'es', 'fr', 'x-default'].sort(),
    );
  });

  it('a fallback locale canonicalizes to the default-locale URL', () => {
    const meta = pageMetadata({
      locale: 'ar',
      path: '/docs/inventory/crosslist',
      title: 'x',
      contentLocales: DOCS_LOCALES,
    });
    expect(meta.alternates?.canonical).toBe(
      'https://salelinx.com/docs/inventory/crosslist',
    );
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(languages.ar).toBeUndefined();
    expect(languages.zh).toBeUndefined();
    // og:url must agree with the canonical, not the localized request URL.
    expect(
      (meta.openGraph as { url?: string; locale?: string }).url,
    ).toBe('https://salelinx.com/docs/inventory/crosslist');
    expect((meta.openGraph as { locale?: string }).locale).toBe('en');
  });

  it('single-language pages carry a canonical but no hreflang block', () => {
    for (const locale of ['en', 'fr', 'zh']) {
      const meta = pageMetadata({
        locale,
        path: '/legal/privacy',
        title: 'x',
        contentLocales: ['en'],
      });
      expect(meta.alternates?.canonical).toBe('https://salelinx.com/legal/privacy');
      expect(meta.alternates?.languages).toBeUndefined();
    }
  });
});
