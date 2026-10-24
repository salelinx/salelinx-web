import { categoryTitle, getPost } from '@/lib/blog/posts';
import { OG_SIZE, articleOgImage } from '@/lib/og/article-card';

// Per-post Open Graph image; the page sets segmentOgImage: true so the
// generic /og.png does not shadow it. Same card as the docs articles.

export const alt = 'SaleLinx blog';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);

  return articleOgImage({
    section: 'Blog',
    eyebrow: post ? categoryTitle(post.metadata.category) : undefined,
    title: post?.metadata.title ?? 'SaleLinx Blog',
    description: post?.metadata.description,
    marketplaces: post?.metadata.marketplaces,
  });
}
