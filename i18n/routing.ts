import { defineRouting } from 'next-intl/routing';

// Exported separately because defineRouting types localeCookie as optional,
// so reading routing.localeCookie.name back out does not type-check.
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export const routing = defineRouting({
  locales: ['en', 'fr', 'es', 'de', 'ar', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  // The Link header lists untranslated locales too; pageMetadata() emits the right hreflang set.
  alternateLinks: false,
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: 60 * 60 * 24 * 365,
  },
});
