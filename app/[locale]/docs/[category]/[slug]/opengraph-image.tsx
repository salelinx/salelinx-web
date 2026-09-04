import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { getArticle } from '@/lib/docs/getArticle';
import type { CategorySlug } from '@/lib/docs/types';
import type { Locale } from '@/lib/i18n/locales';

// Per-article Open Graph image. The file convention emits the og:image /
// twitter:image tags itself and overrides config-based metadata, so the
// page's pageMetadata() call sets segmentOgImage: true to stop declaring the
// generic /og.png. Fonts: satori needs raw TTF data, so the Geist instances
// live in assets/fonts/ (see the README there) instead of next/font.

export const alt = 'SaleLinx documentation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const MONO_TRACKING = '0.14em';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;
  const article = getArticle(locale as Locale, category as CategorySlug, slug);
  const t = await getTranslations({ locale, namespace: 'Docs' });

  const [regular, semibold, iconData] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Geist-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Geist-SemiBold.ttf')),
    readFile(join(process.cwd(), 'public/salelinx-icon.png')),
  ]);
  const icon = `data:image/png;base64,${iconData.toString('base64')}`;

  const title = article?.metadata.title ?? 'SaleLinx Docs';
  const description = article?.metadata.description ?? '';
  const categoryTitle = article
    ? t(`category.${article.metadata.category}.title`)
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#fafafa',
          padding: '64px 72px',
          fontFamily: 'Geist',
          borderTop: '10px solid #18181b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" width={52} height={52} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 34, fontWeight: 600, color: '#18181b' }}>
              SaleLinx
            </span>
            <span style={{ fontSize: 34, fontWeight: 400, color: '#71717a' }}>
              Docs
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {categoryTitle ? (
            <span
              style={{
                fontSize: 24,
                textTransform: 'uppercase',
                letterSpacing: MONO_TRACKING,
                color: '#71717a',
              }}
            >
              {categoryTitle}
            </span>
          ) : null}
          <span
            style={{
              fontSize: title.length > 42 ? 56 : 68,
              fontWeight: 600,
              lineHeight: 1.12,
              color: '#18181b',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>
          {description ? (
            <span
              style={{
                fontSize: 28,
                lineHeight: 1.4,
                color: '#52525b',
                maxWidth: 980,
              }}
            >
              {description}
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 24, color: '#71717a' }}>salelinx.com</span>
          <span
            style={{
              fontSize: 22,
              textTransform: 'uppercase',
              letterSpacing: MONO_TRACKING,
              color: '#a1a1aa',
            }}
          >
            Depop + Vinted
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: regular, style: 'normal', weight: 400 },
        { name: 'Geist', data: semibold, style: 'normal', weight: 600 },
      ],
    },
  );
}
