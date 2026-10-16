// Turn a linked_accounts row into a link to the seller's public shop, so an
// admin looking at a support ticket can see the actual storefront in one click.
//
// The platforms key their profile URLs differently, and we store both parts
// (platform_user_id and platform_username, migration 001_core_schema.sql):
//
//   Depop   /{username}/        username only. The numeric id the extension
//                               reads from the profile API is not routable, so
//                               a row with a null username is NOT linkable.
//   Vinted  /member/{id}        numeric id, from the v_uid cookie. The slug
//                               form (/member/{id}-{username}) is equivalent;
//                               Vinted resolves the bare id fine.
//   eBay    /usr/{username}     username only. The id the ebay function stores
//                               is eBay's immutable Identity API user id, which
//                               no eBay page is keyed by.
//
// Vinted runs a domain per market (.co.uk, .fr, .de, ...) and linked_accounts
// does not record which one the seller uses. We link the UK domain because that
// is where the user base is; Vinted redirects a member id to the right market
// itself, so a non-UK seller still lands on their profile. eBay is the same: the
// seller's site lives in ebay_tokens, which the console cannot read, and the UK
// site shows any eBay seller's profile.

import type { LinkedPlatform } from "@/lib/types/admin";

const VINTED_DOMAIN = "https://www.vinted.co.uk";
const DEPOP_DOMAIN = "https://www.depop.com";
const EBAY_DOMAIN = "https://www.ebay.co.uk";

export function platformProfileUrl(
  platform: LinkedPlatform,
  platformUserId: string,
  platformUsername: string | null,
): string | null {
  if (platform === "depop") {
    if (!platformUsername) return null;
    return `${DEPOP_DOMAIN}/${encodeURIComponent(platformUsername)}/`;
  }
  if (platform === "vinted") {
    if (!platformUserId) return null;
    return `${VINTED_DOMAIN}/member/${encodeURIComponent(platformUserId)}`;
  }
  if (platform === "ebay") {
    if (!platformUsername) return null;
    return `${EBAY_DOMAIN}/usr/${encodeURIComponent(platformUsername)}`;
  }
  return null;
}

// Display name for the platform. Platform names are never translated (the admin
// console is English-only anyway), and "eBay" is why this is a table rather than
// capitalising the key.
const PLATFORM_LABEL: Record<LinkedPlatform, string> = {
  depop: "Depop",
  vinted: "Vinted",
  ebay: "eBay",
};

export function platformLabel(platform: LinkedPlatform): string {
  return PLATFORM_LABEL[platform] ?? platform;
}
