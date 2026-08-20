import { defineRouting } from 'next-intl/routing';

// Exported separately because defineRouting types localeCookie as optional,
// so reading routing.localeCookie.name back out does not type-check.
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export const routing = defineRouting({
  locales: ['en', 'fr', 'es', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: 60 * 60 * 24 * 365,
  },
});
