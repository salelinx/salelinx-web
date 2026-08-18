// Turn a linked_accounts row into a link to the seller's public shop, so an
// admin looking at a support ticket can see the actual storefront in one click.
//
// The two platforms key their profile URLs differently, and we store both parts
// (platform_user_id and platform_username, migration 001_core_schema.sql):
//
//   Depop   /{username}/        username only. The numeric id the extension
//                               reads from the profile API is not routable, so
//                               a row with a null username is NOT linkable.
//   Vinted  /member/{id}        numeric id, from the v_uid cookie. The slug
//                               form (/member/{id}-{username}) is equivalent;
//                               Vinted resolves the bare id fine.
//
// Vinted runs a domain per market (.co.uk, .fr, .de, ...) and linked_accounts
// does not record which one the seller uses. We link the UK domain because that
// is where the user base is; Vinted redirects a member id to the right market
// itself, so a non-UK seller still lands on their profile.

import type { LinkedPlatform } from "@/lib/types/admin";

const VINTED_DOMAIN = "https://www.vinted.co.uk";
const DEPOP_DOMAIN = "https://www.depop.com";

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
  return null;
}

// Display name for the platform. Platform names are never translated (the admin
// console is English-only anyway), so this is purely capitalisation.
export function platformLabel(platform: LinkedPlatform): string {
  return platform === "depop" ? "Depop" : "Vinted";
}
