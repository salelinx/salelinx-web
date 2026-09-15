import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';
import { faqPlainText } from './plain-text';
import type { FAQGroup } from './types';

// FAQPage structured data for /help/faq.
//
// Worth being clear about what this does and does not buy: since Google
// restricted FAQ rich results to authoritative government and health sites,
// this will not put an expandable Q&A block under our search listing. It is
// here because answer engines (AI Overviews, ChatGPT, Perplexity) and general
// entity extraction still read it, and it costs one script tag.
//
// The FAQ is translated into every locale, so unlike the docs graph there is
// no canonical-locale remap: each locale describes its own URL.
export function faqJsonLd({
  locale,
  groups,
}: {
  locale: string;
  groups: FAQGroup[];
}): Record<string, unknown> {
  const url = absoluteUrl(locale, '/help/faq');

  const questions = groups
    .flatMap((group) => group.items)
    .map((item) => ({ q: item.q, text: faqPlainText(item.a) }))
    // An answer that flattens to nothing (a bare button, say) would be an
    // empty acceptedAnswer, which is invalid. Drop it rather than emit it.
    .filter((entry) => entry.text.length > 0)
    .map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.text },
    }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        inLanguage: locale,
        mainEntity: questions,
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/salelinx-icon.png`,
      },
    ],
  };
}
