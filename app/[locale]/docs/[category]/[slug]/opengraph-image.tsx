import { getTranslations } from 'next-intl/server';
import { getArticle } from '@/lib/docs/getArticle';
import type { CategorySlug } from '@/lib/docs/types';
import type { Locale } from '@/lib/i18n/locales';
import { OG_SIZE, articleOgImage } from '@/lib/og/article-card';

// Per-article Open Graph image. The file convention emits the og:image /
// twitter:image tags itself and overrides config-based metadata, so the
// page's pageMetadata() call sets segmentOgImage: true to stop declaring the
// generic /og.png. The card itself is shared with blog posts.

export const alt = 'SaleLinx documentation';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;
  const article = getArticle(locale as Locale, category as CategorySlug, slug);
  const t = await getTranslations({ locale, namespace: 'Docs' });

  return articleOgImage({
    section: 'Docs',
    eyebrow: article ? t(`category.${article.metadata.category}.title`) : undefined,
    title: article?.metadata.title ?? 'SaleLinx Docs',
    description: article?.metadata.description,
    marketplaces: article?.metadata.marketplaces,
  });
}
