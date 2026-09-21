// Reading the subscription off a Stripe invoice, across API versions.
//
// Lives here rather than in stripe-webhook/index.ts so it can be tested: that
// file imports Stripe over https, which the Node test runner cannot load. Same
// reason _shared/entitlement.ts exists.
//
// The history, because it is the whole point of the file. Both invoice
// handlers used to read `invoice.subscription` and `return` when it was null.
// Stripe removed that field in API version 2025-04-30.basil and moved it to
// `parent.subscription_details.subscription`. Webhook payloads render at the
// ACCOUNT's API version, not the one the function pins, so the shape changed
// with no deploy on our side and the handlers silently stopped working while
// still answering 200.
//
// What that cost, unnoticed, for weeks:
//   - first_paid_at never stamped, so every paying customer looked like they
//     had never paid and would be locked out the moment a renewal bounced
//     instead of getting the 7-day grace
//   - past_due_since never stamped, and never cleared on recovery
//   - referral conversions, which hang off the success handler, never fired
//
// Deliberately structural rather than typed against Stripe.Invoice: the type
// only describes one API version, and the problem is that production is on a
// different one.

type Ref = string | { id?: string } | null | undefined;

interface InvoiceShape {
  subscription?: Ref;
  parent?: { type?: string; subscription_details?: { subscription?: Ref } | null } | null;
}

const idOf = (ref: Ref): string | null => {
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && typeof ref.id === "string") return ref.id;
  return null;
};

/** The subscription id, from whichever shape this payload happens to use. */
export function subscriptionIdFromInvoice(invoice: InvoiceShape): string | null {
  return idOf(invoice?.subscription) ?? idOf(invoice?.parent?.subscription_details?.subscription);
}

/**
 * Does this invoice belong to a subscription at all?
 *
 * A one-off invoice legitimately has none, and must not be mistaken for a
 * broken payload. Both shapes carry a marker even when the id cannot be read,
 * which is what lets the caller throw on a real shape change and stay quiet
 * otherwise.
 */
export function isSubscriptionInvoice(invoice: InvoiceShape): boolean {
  if (invoice?.subscription) return true;
  return Boolean(invoice?.parent?.subscription_details);
}
