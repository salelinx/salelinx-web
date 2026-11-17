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

// Ids per PostgREST filter list, to keep each request's address short.
const LOOKUP_CHUNK = 100;

const chunks = (values: string[]): string[][] => {
  const out: string[][] = [];
  for (let i = 0; i < values.length; i += LOOKUP_CHUNK) out.push(values.slice(i, i + LOOKUP_CHUNK));
  return out;
};

/**
 * Each of these Shopify rows' eBay listing, from the account's cloud rows (service role, so every
 * read names the user). A Shopify row has to be saved to be linked, so only saved rows with a link
 * count. Throws on a failed read: not knowing isn't "not on eBay".
 */
// deno-lint-ignore no-explicit-any
export async function linkedEbayRows(admin: any, userId: string, rowIds: string[]): Promise<Map<string, EbayRow>> {
  const wanted = new Set(rowIds);
  const { data, error } = await admin
    .from('listings')
    .select('id, link_id')
    .eq('user_id', userId)
    .eq('platform', 'shopify')
    .not('link_id', 'is', null);
  if (error) throw new Error('Listings lookup failed');
  const rows: LinkRow[] = (data ?? []).filter((r: LinkRow) => wanted.has(r.id));
  if (rows.length === 0) return new Map();
  const { linkIds, ids } = ebayLookup(rows);
  const ebayRows: EbayRow[] = [];
  const lists = [
    ...chunks(linkIds).map((c) => `link_id.in.(${c.join(',')})`),
    ...chunks(ids).map((c) => `id.in.(${c.join(',')})`),
  ];
  for (const filter of lists) {
    const { data: found, error: ebayErr } = await admin
      .from('listings')
      .select('id, link_id, status, url')
      .eq('user_id', userId)
      .eq('platform', 'ebay')
      .or(filter);
    if (ebayErr) throw new Error('Listings lookup failed');
    ebayRows.push(...(found ?? []));
  }
  return ebayPartners(rows, ebayRows);
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
