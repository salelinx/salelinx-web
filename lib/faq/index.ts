import type { Locale } from '@/lib/i18n/locales';
import { FAQ_GROUPS_EN } from './data.en';
import { FAQ_GROUPS_FR } from './data.fr';
import { FAQ_GROUPS_ES } from './data.es';
import { FAQ_GROUPS_DE } from './data.de';
import { FAQ_GROUPS_AR } from './data.ar';
import { FAQ_GROUPS_ZH } from './data.zh';
import type { FAQGroup, FAQItem } from './types';

const BY_LOCALE: Record<Locale, FAQGroup[]> = {
  en: FAQ_GROUPS_EN,
  fr: FAQ_GROUPS_FR,
  es: FAQ_GROUPS_ES,
  de: FAQ_GROUPS_DE,
  ar: FAQ_GROUPS_AR,
  zh: FAQ_GROUPS_ZH,
};

export function getFaqGroups(locale: Locale): FAQGroup[] {
  return BY_LOCALE[locale] ?? BY_LOCALE.en;
}

export function getAllFAQItems(
  locale: Locale,
): Array<FAQItem & { groupSlug: string; groupTitle: string }> {
  return getFaqGroups(locale).flatMap((g) =>
    g.items.map((item) => ({
      ...item,
      groupSlug: g.slug,
      groupTitle: g.title,
    })),
  );
}

export type { FAQGroup, FAQItem } from './types';
