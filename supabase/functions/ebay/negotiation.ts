// @ts-nocheck - this file runs under Deno, not the website's TS config.

// Send Offers on eBay: the Negotiation API, which offers a discount to every buyer watching a
// listing or holding it in their cart. One listing per call, and eBay fixes the offer at 2 days
// with no counter-offers.

export const MESSAGE_MAX = 2000;

export function eligibleIdsFromResponse(body): string[] {
  return (body?.eligibleItems ?? []).map((i) => String(i.listingId)).filter((id) => /^\d+$/.test(id));
}

export function sendOfferBody(r): { body?: unknown; error?: string } {
  if (!/^\d+$/.test(String(r.listingId))) return { error: 'Missing listingId' };
  const item: Record<string, unknown> = { listingId: String(r.listingId), quantity: 1 };
  if (r.price != null) {
    const price = Number(r.price);
    if (!(price > 0)) return { error: 'Offer price must be above 0' };
    item.price = { value: price.toFixed(2) };
    if (/^[A-Z]{3}$/.test(String(r.currency))) item.price.currency = r.currency;
  } else {
    const pct = Number(r.discountPercentage);
    if (!Number.isInteger(pct) || pct < 5 || pct > 90) return { error: 'Discount must be 5 to 90%' };
    item.discountPercentage = String(pct);
  }
  const message = typeof r.message === 'string' ? r.message.trim() : '';
  if (message.length > MESSAGE_MAX) return { error: `Message is over ${MESSAGE_MAX} characters` };
  return {
    body: {
      allowCounterOffer: false,
      offerDuration: { unit: 'DAY', value: 2 },
      offeredItems: [item],
      ...(message ? { message } : {}),
    },
  };
}

// eBay's refusals, as the codes the extension shows a reason for.
const OFFER_ERRORS: Record<number, string> = {
  150002: 'unsupported_site',
  150008: 'offer_price',
  150010: 'offer_message',
  150011: 'not_eligible',
  150013: 'not_eligible',
  150014: 'not_eligible',
  150015: 'offer_price',
  150016: 'offer_price',
  150017: 'not_eligible',
  150018: 'already_offered',
  150019: 'already_offered',
  150020: 'no_buyers',
  150022: 'offer_limit',
  150023: 'offer_limit',
  150026: 'not_eligible',
};

export function offerErrorCode(errorId: unknown): string {
  return OFFER_ERRORS[Number(errorId)] ?? 'ebay';
}
