import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import createNextIntlPlugin from 'next-intl/plugin';

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Only three external origins are ever contacted from the browser: Supabase
// (auth/DB), Google Analytics and the Google Ads conversion tag (both loaded
// post-consent by CookieConsent.tsx, each gated on its own category).
// Stripe Checkout is a full-page redirect built server-side, so js.stripe.com
// is deliberately absent. If you add a third-party script, extend this list
// consciously rather than loosening a directive.
//
// The Ads tag posts conversions to google.com/ccm/collect and
// ad.doubleclick.net, and GA4 posts to stats.g.doubleclick.net, none of which
// are covered by the *.google-analytics.com entries. Without them the tag
// loads and fires but every hit is refused, which looks exactly like a
// tracking bug: conversions silently never arrive. The google.<tld> entries
// are the localized ga-audiences pixel; google.com alone is not enough.
//
// script-src needs 'unsafe-inline' because the App Router injects inline
// bootstrap scripts; moving to nonces requires wiring them through proxy.ts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com https://www.google.com https://www.google.co.uk https://ad.doubleclick.net",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com https://ad.doubleclick.net https://stats.g.doubleclick.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  // CSP is production-only: local dev talks to localhost Supabase and uses
  // HMR websockets that a strict policy would break.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy', value: CSP }]
    : []),
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // DENY in production. SAMEORIGIN in development only, so the dev-only
  // /preview harnesses can frame the site inside real phone-sized viewports,
  // which is the only way to see `svh` and the `sm:` breakpoint behave as they
  // do on a device. Production framing protection is unchanged.
  {
    key: 'X-Frame-Options',
    value: process.env.NODE_ENV === 'production' ? 'DENY' : 'SAMEORIGIN',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  poweredByHeader: false,
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // The docs search index only changes on deploy (built by
        // scripts/build-docs-index.mjs), so let browsers and the CDN hold it
        // for an hour and serve stale while revalidating in the background.
        source: '/docs/search-index.:locale.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));
