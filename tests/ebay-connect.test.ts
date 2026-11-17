import { describe, expect, it } from 'vitest';
import {
  EBAY_CONSENT_RE,
  SHOPIFY_ADMIN_RE,
  ebayFailureOf,
  matchesMaskedEmail,
} from '@/lib/ebay-connect';

describe('the eBay connect page only leaves for eBay and returns to Shopify', () => {
  it("takes eBay's own sign-in, production or sandbox", () => {
    expect(EBAY_CONSENT_RE.test('https://auth.ebay.com/oauth2/authorize?client_id=x')).toBe(true);
    expect(EBAY_CONSENT_RE.test('https://auth.sandbox.ebay.com/oauth2/authorize?a=1')).toBe(true);
    expect(EBAY_CONSENT_RE.test('https://auth.ebay.com.evil.com/oauth2/authorize?a=1')).toBe(false);
    expect(EBAY_CONSENT_RE.test('https://evil.com/?https://auth.ebay.com/oauth2/authorize?')).toBe(false);
  });

  it("goes back only to a store's admin", () => {
    expect(SHOPIFY_ADMIN_RE.test('https://a-b.myshopify.com/admin/apps/cid')).toBe(true);
    expect(SHOPIFY_ADMIN_RE.test('http://a.myshopify.com/admin/apps/cid')).toBe(false);
    expect(SHOPIFY_ADMIN_RE.test('https://a.myshopify.com.evil.com/admin/')).toBe(false);
    expect(SHOPIFY_ADMIN_RE.test('javascript:alert(1)//a.myshopify.com/admin/')).toBe(false);
  });
});

describe('ebayFailureOf', () => {
  it("names the link refusals a seller can act on, and the rest as a failure", () => {
    expect(ebayFailureOf('ALREADY_LINKED_ELSEWHERE')).toBe('alreadyLinked');
    expect(ebayFailureOf('ALREADY_TRIALED')).toBe('alreadyTrialed');
    expect(ebayFailureOf('ebay')).toBe('failed');
    expect(ebayFailureOf(undefined)).toBe('failed');
  });
});

describe('matchesMaskedEmail', () => {
  const mask = 'se•••@gmail.com';

  it('matches the login the Shopify store is connected to', () => {
    expect(matchesMaskedEmail('seller@gmail.com', mask)).toBe(true);
    expect(matchesMaskedEmail('SELLER@Gmail.com', mask)).toBe(true);
  });

  it('flags a login that clearly differs', () => {
    expect(matchesMaskedEmail('other@gmail.com', mask)).toBe(false);
    expect(matchesMaskedEmail('seller@outlook.com', mask)).toBe(false);
    expect(matchesMaskedEmail('seller@notgmail.com', mask)).toBe(false);
  });

  it('never warns without a mask it can read', () => {
    expect(matchesMaskedEmail('anyone@x.com', null)).toBe(true);
    expect(matchesMaskedEmail('anyone@x.com', 'not a mask')).toBe(true);
  });
});
