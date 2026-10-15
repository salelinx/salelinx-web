// GENERATED FILE - DO NOT EDIT.
//
// Copied from the extension repo (salelinx-app/src/data/), which owns the
// source tables and the tests that guard them. NOTE: the sync script this
// header used to name does not exist in either repo yet, so this copy is
// maintained by hand and has already drifted from the extension's version.
// See docs/EDGE-FUNCTIONS.md "Wiring up resolve-category" before editing.

// An eBay category path ("Clothes, Shoes & Accessories:Women:Women's Clothing:Dresses") as a Depop
// department/group/product_type, the hub both other directions already map through. Copied by
// hand into salelinx-web's resolve-category function, which runs it: it is part of the paywall.

import { VINTED_DEPOP_TYPES } from './vinted-depop-types.ts';

export interface EbayDepopType {
  depopType: string;
  /** Depop legacy category id, which the Depop → Vinted mapping and its refiners take. */
  depopCategoryId: number;
  /** Every Vinted leaf filed under the same Depop type, the first as the default. */
  vintedCatalogIds: number[];
}

// eBay's words for what Depop names differently.
const SYNONYMS: Record<string, string> = {
  wristwatch: 'watch',
  handbag: 'bag',
  backpack: 'bag',
  rucksack: 'bag',
  sweater: 'jumper',
  sweatshirt: 'hoodie',
  sneaker: 'trainer',
  necklace: 'jewellery',
  bracelet: 'jewellery',
  earring: 'jewellery',
  ring: 'jewellery',
  charm: 'jewellery',
  pendant: 'jewellery',
  pant: 'trouser',
  chino: 'trouser',
  blazer: 'tailored',
  waistcoat: 'waistcoats',
  cap: 'hat',
  beanie: 'hat',
  heel: 'court',
  pyjama: 'pajama',
  swimwear: 'swim',
  swimsuit: 'swim',
  knicker: 'panty',
  brief: 'panty',
  fiction: 'book',
  novel: 'book',
  vinyl: 'cd',
  record: 'cd',
  dvd: 'cd',
  headphone: 'dj',
  earphone: 'dj',
  scarve: 'scarf',
  shawl: 'scarf',
  soft: 'stuffed',
  plush: 'stuffed',
  teddy: 'stuffed',
  lego: 'building',
  perfume: 'fragrance',
  aftershave: 'fragrance',
  vase: 'decor',
  candle: 'decor',
  outfit: 'bundle',
  snowsuit: 'coat',
  overcoat: 'coat',
  parka: 'coat',
  puffer: 'jacket',
  shoe: 'footwear',
  ccg: 'trading',
  mug: 'dinnerware',
  cup: 'dinnerware',
  plate: 'dinnerware',
  bowl: 'dinnerware',
};

const STOP = new Set(['and', 'other', 'accessories', 'clothing']);

const stem = (w: string): string =>
  w.length > 4 && w.endsWith('es') && /(ss|sh|ch|x)es$/.test(w)
    ? w.slice(0, -2)
    : w.length > 3 && w.endsWith('s') && !w.endsWith('ss')
      ? w.slice(0, -1)
      : w;

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/t-?shirt/g, 'tshirt')
      .replace(/football shirt/g, 'jersey')
      .replace(/make-?up/g, 'makeup')
      .split(/[^a-z]+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      .map(stem)
      .map((w) => SYNONYMS[w] ?? w),
  );
}

const DEPARTMENTS: [RegExp, string][] = [
  [/\b(baby|babies|kids?|girls?|boys?|children'?s?|toddler)\b/i, 'kidswear'],
  [/\bwomen'?s?\b|\bladies\b/i, 'womenswear'],
  [/\bmen'?s?\b/i, 'menswear'],
];

const GENDER_DEPARTMENT: Record<string, string> = {
  women: 'womenswear',
  men: 'menswear',
  kids: 'kidswear',
};

// One row per Depop type, with the first legacy id and Vinted leaf filed under it.
const TYPES: {
  depopType: string;
  dept: string;
  pt: Set<string>;
  grp: Set<string>;
  row: EbayDepopType;
}[] = [];
for (const [vintedId, [depopType, depopCategoryId]] of Object.entries(VINTED_DEPOP_TYPES)) {
  const seen = TYPES.find((t) => t.depopType === depopType);
  if (seen) {
    seen.row.vintedCatalogIds.push(Number(vintedId));
    continue;
  }
  const [dept, group, productType] = depopType.split('/');
  TYPES.push({
    depopType,
    dept,
    pt: words(productType),
    grp: words(group),
    row: { depopType, depopCategoryId, vintedCatalogIds: [Number(vintedId)] },
  });
}

/** The Depop type for an eBay listing: what its category's deepest naming level says, then the
 *  level above, with the title breaking ties. Kept to
 *  the department the path, the item's gender or its title gives. Null when neither level names one. */
export function depopTypeForEbay(
  path: string,
  title: string,
  gender: string | null = null,
): EbayDepopType | null {
  const levels = path.split(/:|>/).map((s) => s.trim());
  const dept =
    DEPARTMENTS.find(([re]) => levels.some((l) => re.test(l)))?.[1] ??
    GENDER_DEPARTMENT[gender ?? ''] ??
    DEPARTMENTS.find(([re]) => re.test(title))?.[1] ??
    null;
  const titled = words(title);
  // A product type counts double plus one per extra word it shares ("trading cards" over "cards"),
  // except an "other-" catch-all, which would otherwise outscore the type it gathers up.
  const hits = (t: (typeof TYPES)[number], ws: Set<string>) => {
    const pt = [...t.pt].filter((w) => ws.has(w)).length;
    const ptScore = pt ? 1 + (t.depopType.includes('/other-') ? 1 : pt) : 0;
    return ptScore + [...t.grp].filter((w) => ws.has(w)).length;
  };
  // Deepest level first; a level naming nothing ("Spanish Clubs") hands over to the one above.
  for (let i = levels.length - 1; i >= 0; i--) {
    const last = words(levels[i]);
    const prev = words(levels[i - 1] ?? '');
    let best: { score: number; row: EbayDepopType } | null = null;
    for (const t of TYPES) {
      if (dept && t.dept !== dept && t.dept !== 'everything-else') continue;
      if (!hits(t, last)) continue;
      // With no department to go on, Depop's non-clothing and then womenswear win a tie; an
      // "other-" catch-all loses one, and so does a type the level names only part of ("bag"
      // over "laptop cases bag").
      const lean =
        (dept ? 0 : t.dept === 'everything-else' ? 0.2 : t.dept === 'womenswear' ? 0.1 : 0) -
        (t.depopType.includes('/other-') ? 0.5 : 0) -
        0.15 * [...t.pt].filter((w) => !last.has(w)).length;
      const score = 10 * hits(t, last) + 3 * hits(t, prev) + hits(t, titled) + lean;
      if (!best || score > best.score) best = { score, row: t.row };
    }
    if (best) return best.row;
  }
  return null;
}
