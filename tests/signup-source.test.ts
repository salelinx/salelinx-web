import { describe, expect, it } from 'vitest';
import { classifySource, deviceType, parseSignupSource } from '@/lib/signup-source';

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

describe('deviceType', () => {
  it('tells phones, tablets and computers apart', () => {
    expect(deviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')).toBe('phone');
    expect(deviceType('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537.36')).toBe('phone');
    expect(deviceType('Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/120 Safari/537.36')).toBe('tablet');
    expect(deviceType('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe('tablet');
    expect(deviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36')).toBe('computer');
  });

  it('counts an iPad reporting a Mac user agent as a tablet', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
    expect(deviceType(mac, 5)).toBe('tablet');
    expect(deviceType(mac, 0)).toBe('computer');
  });
});

describe('parseSignupSource', () => {
  it('keeps known string fields and drops the rest', () => {
    const raw = JSON.stringify({ source: 'tiktok', device: 'phone', landing: '/', role: 'admin', at: 1 });
    expect(parseSignupSource(raw)).toEqual({ source: 'tiktok', device: 'phone', landing: '/' });
  });

  it('rejects junk and caps long values', () => {
    expect(parseSignupSource(null)).toBeUndefined();
    expect(parseSignupSource('not json')).toBeUndefined();
    expect(parseSignupSource('{"medium":"x"}')).toBeUndefined();
    expect(parseSignupSource(JSON.stringify({ source: 'x'.repeat(500) }))?.source).toHaveLength(200);
  });
});
