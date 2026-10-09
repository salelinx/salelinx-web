import { describe, expect, it } from 'vitest';
import { classifySource } from '@/lib/signup-source';

const site = 'https://salelinx.com';
const src = (path: string, referrer = '') => classifySource(`${site}${path}`, referrer).source;

describe('classifySource', () => {
  it('prefers utm_source over everything else', () => {
    expect(src('/?utm_source=TikTok&gclid=x', 'https://www.google.com/')).toBe('tiktok');
  });

  it('reads ad click ids', () => {
    expect(src('/?gclid=abc')).toBe('google_ads');
    expect(src('/?ttclid=abc')).toBe('tiktok_ads');
    expect(src('/?fbclid=abc', 'https://l.instagram.com/')).toBe('instagram');
    expect(src('/?fbclid=abc')).toBe('meta');
  });

  it('maps known referrers and keeps unknown hosts', () => {
    expect(src('/', 'https://www.google.co.uk/')).toBe('google');
    expect(src('/', 'https://chromewebstore.google.com/detail/x')).toBe('chrome_web_store');
    expect(src('/', 'https://m.youtube.com/watch')).toBe('youtube');
    expect(src('/', 'https://www.someblog.net/post')).toBe('someblog.net');
  });

  it('treats no referrer or our own site as direct', () => {
    expect(src('/')).toBe('direct');
    expect(src('/', `${site}/features`)).toBe('direct');
  });

  it('keeps campaign and landing path', () => {
    const s = classifySource(`${site}/features?utm_source=ig&utm_campaign=bio`, '');
    expect(s).toMatchObject({ source: 'ig', campaign: 'bio', landing: '/features' });
  });
});
