import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { MARKETPLACE_LABELS } from '@/lib/docs/status';
import type { Marketplace } from '@/lib/docs/types';

// Shared Open Graph card for docs articles and blog posts. Each route
// segment's opengraph-image.tsx exports its own alt/size/contentType and
// calls this. Fonts: satori needs raw TTF data, so the Geist instances live
// in assets/fonts/ (see the README there) instead of next/font.

export const OG_SIZE = { width: 1200, height: 630 };

const MONO_TRACKING = '0.14em';

// Footer label order, and the set shown when a page names no marketplaces.
const MARKETPLACE_ORDER: Marketplace[] = ['depop', 'vinted', 'ebay'];

/** "Depop + Vinted" from a page's marketplaces, in the site's fixed order. */
export function marketplaceLine(marketplaces?: readonly Marketplace[]): string {
  const shown = marketplaces?.length
    ? MARKETPLACE_ORDER.filter((m) => marketplaces.includes(m))
    : MARKETPLACE_ORDER;
  return shown.map((m) => MARKETPLACE_LABELS[m]).join(' + ');
}

export async function articleOgImage({
  section,
  eyebrow,
  title,
  description,
  marketplaces,
}: {
  // Greyed word after the wordmark: "Docs", "Blog".
  section: string;
  eyebrow?: string;
  title: string;
  description?: string;
  // The page's own marketplaces, for the footer. All three when absent.
  marketplaces?: readonly Marketplace[];
}): Promise<ImageResponse> {
  const [regular, semibold, iconData] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Geist-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Geist-SemiBold.ttf')),
    readFile(join(process.cwd(), 'public/salelinx-icon.png')),
  ]);
  const icon = `data:image/png;base64,${iconData.toString('base64')}`;

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
              {section}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {eyebrow ? (
            <span
              style={{
                fontSize: 24,
                textTransform: 'uppercase',
                letterSpacing: MONO_TRACKING,
                color: '#71717a',
              }}
            >
              {eyebrow}
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
            {marketplaceLine(marketplaces)}
          </span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Geist', data: regular, style: 'normal', weight: 400 },
        { name: 'Geist', data: semibold, style: 'normal', weight: 600 },
      ],
    },
  );
}
