import { describe, expect, it } from 'vitest';
import { platformLabel, platformProfileUrl } from '@/lib/admin/platform-links';

describe('platformProfileUrl', () => {
  it('links Depop by username', () => {
    expect(platformProfileUrl('depop', '123', 'shop_one')).toBe('https://www.depop.com/shop_one/');
    expect(platformProfileUrl('depop', '123', null)).toBeNull();
  });

  it('links Vinted by member id', () => {
    expect(platformProfileUrl('vinted', '456', null)).toBe('https://www.vinted.co.uk/member/456');
  });

  it('links eBay by username, never by the stored id', () => {
    expect(platformProfileUrl('ebay', 'abc123', 'seller.one')).toBe('https://www.ebay.co.uk/usr/seller.one');
    expect(platformProfileUrl('ebay', 'abc123', null)).toBeNull();
  });
});

describe('platformLabel', () => {
  it('names every marketplace', () => {
    expect(platformLabel('depop')).toBe('Depop');
    expect(platformLabel('vinted')).toBe('Vinted');
    expect(platformLabel('ebay')).toBe('eBay');
  });
});
