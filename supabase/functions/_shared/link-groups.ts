// Linked listings, read on the server: the copies of one item on each marketplace. The extension
// owns the links (salelinx-app src/shared/link-groups.ts and docs/technical/CLOUD-SYNC.md "Link
// groups"); this reads them the same way. A cloud row's link_id holds a group key `grp_<anchor id>`,
// whose anchor counts as a member whatever its own row says, or, from before groups, its partner's
// id. Row ids start with the marketplace (`ebay_<item id>`, `shopify_<product id>_<variant id>`).

export const GROUP_KEY_PREFIX = 'grp_';

/** Ids and keys safe to put in a PostgREST filter list as they are. */
export const SAFE_LISTING_ID = /^[A-Za-z0-9_-]{1,200}$/;

export interface LinkRow {
  id: string;
  link_id: string | null;
}

export interface EbayRow extends LinkRow {
  status: string | null;
  url: string | null;
}

/** What the server needs to read to find the eBay listings linked to these rows. */
export function ebayLookup(rows: LinkRow[]): { linkIds: string[]; ids: string[] } {
  const linkIds = new Set<string>();
  const ids = new Set<string>();
  for (const row of rows) {
    // An old-style partner may point back at this row.
    linkIds.add(row.id);
    const link = row.link_id;
    if (!link || !SAFE_LISTING_ID.test(link)) continue;
    if (link.startsWith(GROUP_KEY_PREFIX)) {
      linkIds.add(link);
      const anchor = link.slice(GROUP_KEY_PREFIX.length);
      if (anchor.startsWith('ebay_')) ids.add(anchor);
    } else if (link.startsWith('ebay_')) {
      ids.add(link);
    }
  }
  return {
    linkIds: [...linkIds].filter((v) => SAFE_LISTING_ID.test(v)),
    ids: [...ids],
  };
}

/** Each row's eBay listing, from the eBay rows `ebayLookup` named. A live one wins over an ended one. */
export function ebayPartners(rows: LinkRow[], ebayRows: EbayRow[]): Map<string, EbayRow> {
  const out = new Map<string, EbayRow>();
  for (const row of rows) {
    const link = row.link_id;
    const anchor =
      link && link.startsWith(GROUP_KEY_PREFIX) ? link.slice(GROUP_KEY_PREFIX.length) : null;
    const found = ebayRows.filter(
      (e) =>
        // In its group: holding the key, or the key's anchor.
        (anchor !== null && (e.link_id === link || e.id === anchor)) ||
        // Old-style pair, pointing either way.
        (link !== null && anchor === null && e.id === link) ||
        e.link_id === row.id,
    );
    const best = found.find((e) => e.status === 'active') ?? found[0];
    if (best) out.set(row.id, best);
  }
  return out;
}
