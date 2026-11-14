// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { assertEquals } from 'jsr:@std/assert@1';
import { eligibleIdsFromResponse, offerErrorCode, sendOfferBody } from './negotiation.ts';

Deno.test('eligible ids: listing ids only, empty on a 204', () => {
  assertEquals(eligibleIdsFromResponse({ eligibleItems: [{ listingId: '123' }, { listingId: 'x' }] }), ['123']);
  assertEquals(eligibleIdsFromResponse({}), []);
});

Deno.test('send offer: a discount, fixed at 2 days with no counters', () => {
  assertEquals(sendOfferBody({ listingId: '123', discountPercentage: 10, message: ' hi ' }).body, {
    allowCounterOffer: false,
    offerDuration: { unit: 'DAY', value: 2 },
    offeredItems: [{ listingId: '123', quantity: 1, discountPercentage: '10' }],
    message: 'hi',
  });
});

Deno.test('send offer: a set price wins over a discount, and no empty message', () => {
  assertEquals(sendOfferBody({ listingId: '1', price: 8.5, currency: 'GBP', discountPercentage: 10 }).body, {
    allowCounterOffer: false,
    offerDuration: { unit: 'DAY', value: 2 },
    offeredItems: [{ listingId: '1', quantity: 1, price: { value: '8.50', currency: 'GBP' } }],
  });
});

Deno.test('send offer: refuses what eBay would', () => {
  assertEquals(sendOfferBody({ discountPercentage: 10 }).error, 'Missing listingId');
  assertEquals(sendOfferBody({ listingId: '1', discountPercentage: 4 }).error, 'Discount must be 5 to 90%');
  assertEquals(sendOfferBody({ listingId: '1', price: 0 }).error, 'Offer price must be above 0');
  assertEquals(
    sendOfferBody({ listingId: '1', discountPercentage: 10, message: 'x'.repeat(2001) }).error,
    'Message is over 2000 characters',
  );
});

Deno.test('offer errors map to reasons, anything else stays ebay', () => {
  assertEquals(offerErrorCode(150019), 'already_offered');
  assertEquals(offerErrorCode('150008'), 'offer_price');
  assertEquals(offerErrorCode(150000), 'ebay');
});
