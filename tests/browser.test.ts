import { describe, expect, it } from 'vitest';
import { browserName } from '@/lib/admin/browser';

const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('browserName', () => {
  it('names Chromium forks before Chrome, since they all carry Chrome/', () => {
    expect(browserName(chrome)).toBe('Chrome');
    expect(browserName(`${chrome} Edg/141.0.0.0`)).toBe('Edge');
    expect(browserName(`${chrome} OPR/124.0.0.0`)).toBe('Opera');
  });

  it('handles missing and unrecognised agents', () => {
    expect(browserName(null)).toBeNull();
    expect(browserName('curl/8.0')).toBe('Other');
  });
});
