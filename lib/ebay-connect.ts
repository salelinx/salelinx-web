// Checks for the website's eBay connect page (components/EbayConnect.tsx). Kept apart from the
// component so they are tested without React.

/** A store's admin, the only place the page sends a seller back to. */
export const SHOPIFY_ADMIN_RE = /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com\/admin\//;

/** eBay's own sign-in, the only place the page sends a seller off to. */
export const EBAY_CONSENT_RE = /^https:\/\/auth(\.sandbox)?\.ebay\.com\/oauth2\/authorize\?/;

export type EbayFailure = 'expired' | 'declined' | 'alreadyLinked' | 'alreadyTrialed' | 'failed';

/** What the ebay function's link refusal means for the seller. */
export function ebayFailureOf(code: unknown): EbayFailure {
  if (code === 'ALREADY_LINKED_ELSEWHERE') return 'alreadyLinked';
  if (code === 'ALREADY_TRIALED') return 'alreadyTrialed';
  return 'failed';
}

/**
 * Whether an email could be the one behind a masked address from the Shopify app's page
 * ("se•••@gmail.com": the first letters and the domain). Unknown when there is no
 * usable mask, which counts as a match: the warning is only for a login that clearly differs.
 */
export function matchesMaskedEmail(email: string, mask: string | null): boolean {
  if (!mask) return true;
  const m = /^([^@•]+)•+@(.+)$/.exec(mask);
  if (!m) return true;
  const e = email.toLowerCase();
  return e.startsWith(m[1].toLowerCase()) && e.endsWith(`@${m[2].toLowerCase()}`);
}
