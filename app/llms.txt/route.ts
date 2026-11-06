import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/site';
import { LANDING_PAGES } from '@/lib/landing/pages';
import { listPosts } from '@/lib/blog/posts';
import { ARTICLE_MODULES_BY_LOCALE } from '@/lib/docs/manifest';

export const dynamic = 'force-static';

const url = (path: string) => absoluteUrl(routing.defaultLocale, path);
const line = (title: string, path: string, description?: string) =>
  `- [${title}](${url(path)})${description ? `: ${description}` : ''}`;

export function GET() {
  const body = [
    '# SaleLinx',
    '',
    '> SaleLinx is a Chrome extension for people who sell on Depop, Vinted and eBay. It crosslists listings between all three in any direction, and automates relisting, Depop refreshing, price drops, offers to likers, shipping labels and eBay bulk editing. Paid monthly plans with a 14-day free trial; prices in GBP, EUR and USD. The site is in English, French, Spanish, German, Arabic and Chinese.',
    '',
    'SaleLinx runs in a desktop Chrome browser, not on phones. It covers Depop, Vinted and eBay only, not Etsy, Poshmark, Mercari or Facebook Marketplace. Copies to Depop and Vinted are saved as drafts; copies to eBay go live after SaleLinx shows the eBay fee.',
    '',
    '## Product',
    '',
    line('Features', '/features', 'every feature on one page'),
    line('Pricing', '/pricing', 'plans, monthly limits and the free trial'),
    line('Roadmap', '/roadmap', 'what is planned and recently shipped'),
    line('Help and FAQ', '/help/faq', 'billing, accounts and troubleshooting'),
    ...LANDING_PAGES.map((p) => line(p.metaTitle, `/features/${p.slug}`, p.metaDescription)),
    '',
    '## Seller guides',
    '',
    ...listPosts().map(({ metadata: m }) => line(m.title, `/blog/${m.slug}`, m.description)),
    '',
    '## Docs',
    '',
    ...ARTICLE_MODULES_BY_LOCALE[routing.defaultLocale].map(({ metadata: m }) =>
      line(m.title, `/docs/${m.category}/${m.slug}`, m.description),
    ),
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
