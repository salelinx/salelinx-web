import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private pages (/account/*, transactional /auth/* pages) are handled
        // with per-page noindex meta instead of a crawl block: robots.txt only
        // matches the unprefixed default-locale paths, and a crawler that is
        // blocked from a page can never see its noindex tag. Keep the block
        // to route handlers and the admin console only.
        disallow: ['/admin', '/api/', '/auth/callback', '/auth/signout'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
