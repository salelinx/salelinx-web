// GENERATED FILE - DO NOT EDIT.
//
// Copied from the extension repo (salelinx-app/src/data/), which owns the
// source tables and the tests that guard them. NOTE: the sync script this
// header used to name does not exist in either repo yet, so this copy is
// maintained by hand and has already drifted from the extension's version.
// See docs/EDGE-FUNCTIONS.md "Wiring up resolve-category" before editing.

// Depop <-> Vinted category resolution.
//
// This module is the crosslister's category brain: it turns a Depop category
// id plus the listing's own wording into a Vinted leaf catalog id, and applies
// the keyword refiners for the categories where a single Depop id spans many
// Vinted ones (jewellery, t-shirts, outerwear, jeans, swimwear, shoes, kids).
//
// It does NOT run in the extension. Nothing under src/ imports it, so webpack
// never pulls it into a bundle; scripts/sync-category-maps.mjs copies it into
// the website repo's resolve-category edge function, which is what the
// crosslister actually calls. It lives here so the mapping tests in
// tests/data/ (and the platform catalogs in scripts/data/) keep guarding it.
//
// Keep it pure and dependency-free apart from the mapping tables: it has to
// run unchanged under Deno.

import {
  depopCategoryIdToVinted,
  refineJewelleryCategory,
  refineOuterwearCategory,
  refineJeansCategory,
  refineSwimwearCategory,
  refineShoesCategory,
  refineTshirtCategory,
} from './category-maps-depop.ts';
import type { CategoryMapping } from './crosslist-category.ts';

/**
 * Map a Depop category ID to Vinted, applying keyword-based refinements.
 * Returns the resolved category mapping (or null) and debug warnings.
 *
 * `isKids` is the caller's hint from the raw Depop payload (which flags kids
 * items under three different keys). The category-id check below runs on top
 * of it, so a kids category still resolves correctly when the hint is false.
 */
export function mapDepopToVintedCategory(
  categoryId: number | undefined,
  title: string,
  description: string,
  isKids: boolean,
): { mapping: CategoryMapping | null; warnings: string[] } {
  const warnings: string[] = [];
  let catMapping = categoryId ? depopCategoryIdToVinted(categoryId) : null;

  // Jewellery (Depop ID 17) — refine based on title/description keywords
  if (categoryId === 17 && catMapping) {
    catMapping = refineJewelleryCategory(title, description);
  }

  // T-shirts (Depop IDs 2, 43, 52 for men; 87 for women) — refine subtype
  if ([2, 43, 52, 87].includes(categoryId ?? 0) && catMapping) {
    const gender = catMapping.vintedLabel.startsWith('Men') ? 'men' : 'women';
    catMapping = refineTshirtCategory(title, description, gender);
  }

  // Outerwear (Depop IDs 5, 82 for men; 13, 145 for women) — refine coat/jacket type
  if ([5, 82, 13, 145].includes(categoryId ?? 0) && catMapping) {
    const gender = catMapping.vintedLabel.startsWith('Men') ? 'men' : 'women';
    catMapping = refineOuterwearCategory(title, description, gender);
  }

  // Jeans (Depop ID 35) — refine skinny/slim/straight/ripped
  if (categoryId === 35 && catMapping) {
    catMapping = refineJeansCategory(title, description);
  }

  // Swimwear (Depop ID 156 for women) — refine one-piece/bikini/other
  if (categoryId === 156 && catMapping) {
    catMapping = refineSwimwearCategory(title, description);
  }

  // Generic shoes (Depop IDs 58 men, 174 women, 6/14 generic) — refine shoe type
  if ([58, 174].includes(categoryId ?? 0) && catMapping) {
    const gender = catMapping.vintedLabel.startsWith('Men') ? 'men' : 'women';
    catMapping = refineShoesCategory(title, description, gender);
  }

  // Kids — refine if mapped to generic kids categories, or fallback for unmapped kids
  const isKidsCategory = [22, 230, 231].includes(categoryId ?? 0) || isKids;

  if (isKidsCategory) {
    const text = `${title} ${description}`.toLowerCase();
    const isGirl = /\bgirls?\b|\bwoman\b|\bwomens?\b|\bfemales?\b/.test(text);

    // Detect specific product types from title/description
    const gc = isGirl ? 'Girls clothing' : 'Boys clothing';
    // All catalogIds MUST be leaf nodes (no children) or Vinted won't accept them.
    const kidsRefinements: Array<{ pattern: RegExp; catalogId: number; label: string }> = [
      // ── Shoes (specific types first, then generic) ──
      {
        pattern: /velcro|hook.?and.?loop|strap/i,
        catalogId: isGirl ? 2718 : 2750,
        label: `Kids > ${gc} > Shoes > Trainers > Hook-and-loop trainers`,
      },
      {
        pattern: /slip.?on/i,
        catalogId: isGirl ? 2720 : 2752,
        label: `Kids > ${gc} > Shoes > Trainers > Slip-on trainers`,
      },
      {
        pattern: /trainer|sneaker|running shoe/i,
        catalogId: isGirl ? 2719 : 2751,
        label: `Kids > ${gc} > Shoes > Trainers > Lace-up trainers`,
      },
      {
        pattern: /football boot/i,
        catalogId: isGirl ? 2710 : 2738,
        label: `Kids > ${gc} > Shoes > Football boots`,
      },
      {
        pattern: /snow boot/i,
        catalogId: isGirl ? 2697 : 2728,
        label: `Kids > ${gc} > Shoes > Boots > Snow boots`,
      },
      {
        pattern: /wellie|wellington/i,
        catalogId: isGirl ? 2698 : 2729,
        label: `Kids > ${gc} > Shoes > Boots > Wellington boots`,
      },
      {
        pattern: /ankle boot/i,
        catalogId: isGirl ? 2695 : 2726,
        label: `Kids > ${gc} > Shoes > Boots > Ankle boots`,
      },
      {
        pattern: /\bboots?\b/i,
        catalogId: isGirl ? 2695 : 2726,
        label: `Kids > ${gc} > Shoes > Boots > Ankle boots`,
      },
      {
        pattern: /sandal/i,
        catalogId: isGirl ? 2705 : 2733,
        label: `Kids > ${gc} > Shoes > Sandals`,
      },
      {
        pattern: /slipper/i,
        catalogId: isGirl ? 1534 : 1661,
        label: `Kids > ${gc} > Shoes > Slippers`,
      },
      {
        pattern: /flip.?flop/i,
        catalogId: isGirl ? 2704 : 2732,
        label: `Kids > ${gc} > Shoes > Flip-flops`,
      },
      {
        pattern: /\bslides?\b/i,
        catalogId: isGirl ? 2707 : 2734,
        label: `Kids > ${gc} > Shoes > Slides`,
      },
      {
        pattern: /ballet|mary.?jane/i,
        catalogId: isGirl ? 2753 : 1655,
        label: `Kids > ${gc} > Shoes > ${isGirl ? 'Ballerinas/Mary Janes' : 'Formal shoes'}`,
      },
      {
        pattern: /\bshoes?\b|footwear/i,
        catalogId: isGirl ? 2719 : 2751,
        label: `Kids > ${gc} > Shoes > Trainers > Lace-up trainers`,
      },
      // ── Outerwear (specific types, all leaf nodes) ──
      {
        pattern: /puffer|padded/i,
        catalogId: isGirl ? 2548 : 2576,
        label: `Kids > ${gc} > Outerwear > Jackets > Puffer jackets`,
      },
      {
        pattern: /bomber/i,
        catalogId: isGirl ? 2545 : 2573,
        label: `Kids > ${gc} > Outerwear > Jackets > Bomber jackets`,
      },
      {
        pattern: /denim jacket/i,
        catalogId: isGirl ? 2546 : 2574,
        label: `Kids > ${gc} > Outerwear > Jackets > Denim jackets`,
      },
      {
        pattern: /fleece/i,
        catalogId: isGirl ? 2547 : 2575,
        label: `Kids > ${gc} > Outerwear > Jackets > Fleece jackets`,
      },
      {
        pattern: /windbreaker|rain\s*coat/i,
        catalogId: isGirl ? 2549 : 2577,
        label: `Kids > ${gc} > Outerwear > Jackets > Windbreakers`,
      },
      {
        pattern: /blazer/i,
        catalogId: isGirl ? 2544 : 2571,
        label: `Kids > ${gc} > Outerwear > Jackets > Blazers`,
      },
      {
        pattern: /jacket/i,
        catalogId: isGirl ? 2548 : 2576,
        label: `Kids > ${gc} > Outerwear > Jackets > Puffer jackets`,
      },
      {
        pattern: /parka/i,
        catalogId: isGirl ? 2541 : 2562,
        label: `Kids > ${gc} > Outerwear > Coats > Parkas`,
      },
      {
        pattern: /duffle/i,
        catalogId: isGirl ? 2540 : 2561,
        label: `Kids > ${gc} > Outerwear > Coats > Duffle coats`,
      },
      {
        pattern: /trench/i,
        catalogId: isGirl ? 2543 : 2564,
        label: `Kids > ${gc} > Outerwear > Coats > Trench coats`,
      },
      {
        pattern: /\bcoats?\b/i,
        catalogId: isGirl ? 2541 : 2562,
        label: `Kids > ${gc} > Outerwear > Coats > Parkas`,
      },
      {
        pattern: /gilet|body warmer/i,
        catalogId: isGirl ? 1518 : 1646,
        label: `Kids > ${gc} > Outerwear > Gilets & body warmers`,
      },
      // ── Clothing (leaf nodes) ──
      {
        pattern: /dress\b|dresses/i,
        catalogId: 1554,
        label: `Kids > ${gc} > Dresses > Short dresses`,
      },
      {
        pattern: /hoodie|hoody|sweatshirt/i,
        catalogId: isGirl ? 1550 : 1672,
        label: `Kids > ${gc} > Jumpers & hoodies > Hoodies & sweatshirts`,
      },
      {
        pattern: /t-shirt|tees?\b|tshirt/i,
        catalogId: isGirl ? 1535 : 1662,
        label: `Kids > ${gc} > Tops & t-shirts > T-shirts`,
      },
      {
        pattern: /polo\s*shirt/i,
        catalogId: isGirl ? 1536 : 1663,
        label: `Kids > ${gc} > Tops & t-shirts > Polo shirts`,
      },
      {
        pattern: /\bshirts?\b|blouse/i,
        catalogId: isGirl ? 1537 : 1664,
        label: `Kids > ${gc} > Tops & t-shirts > Shirts`,
      },
      {
        pattern: /\bjean\b|\bjeans\b|denim pant/i,
        catalogId: isGirl ? 1559 : 1696,
        label: `Kids > ${gc} > Trousers > Jeans`,
      },
      {
        pattern: /legging/i,
        catalogId: isGirl ? 1565 : 1701,
        label: `Kids > ${gc} > Trousers > Leggings`,
      },
      {
        pattern: /trouser|pants?\b|chino|jogger/i,
        catalogId: isGirl ? 1560 : 1697,
        label: `Kids > ${gc} > Trousers > Skinny trousers`,
      },
      {
        pattern: /\bshort\b|\bshorts\b/i,
        catalogId: isGirl ? 1250 : 1201,
        label: `Kids > ${gc} > Shorts`,
      },
      { pattern: /skirt/i, catalogId: 1248, label: `Kids > ${gc} > Skirts` },
      {
        pattern: /jumper|sweater|knit/i,
        catalogId: isGirl ? 1542 : 1668,
        label: `Kids > ${gc} > Jumpers & hoodies > Jumpers`,
      },
      {
        pattern: /cardigan/i,
        catalogId: isGirl ? 1246 : 1199,
        label: `Kids > ${gc} > Jumpers & hoodies > Cardigans`,
      },
      {
        pattern: /jumpsuit|dungaree|overall/i,
        catalogId: isGirl ? 1568 : 1702,
        label: `Kids > ${gc} > Trousers > Jumpsuits & dungarees`,
      },
      {
        pattern: /romper|bodysuit|babygrow/i,
        catalogId: isGirl ? 1514 : 1642,
        label: `Kids > ${gc} > Baby clothing > Rompers`,
      },
      {
        pattern: /swimwear|swimsuit|swimming|bikini/i,
        catalogId: isGirl ? 1251 : 1202,
        label: `Kids > ${gc} > Swimwear`,
      },
      {
        pattern: /costume|fancy dress|halloween/i,
        catalogId: isGirl ? 1606 : 1762,
        label: `Kids > ${gc} > Fancy dress`,
      },
      // ── Accessories (leaf nodes) ──
      {
        pattern: /\bbags?\b|backpack|rucksack/i,
        catalogId: isGirl ? 1258 : 1257,
        label: `Kids > ${gc} > Bags & backpacks`,
      },
      {
        pattern: /\bcaps?\b|\bhats?\b|beanie/i,
        catalogId: isGirl ? 1577 : 1749,
        label: `Kids > ${gc} > Accessories > Caps & hats`,
      },
      {
        pattern: /glove|mitten/i,
        catalogId: isGirl ? 1578 : 1740,
        label: `Kids > ${gc} > Accessories > Gloves`,
      },
      {
        pattern: /scarf|shawl/i,
        catalogId: isGirl ? 1580 : 1741,
        label: `Kids > ${gc} > Accessories > Scarves & shawls`,
      },
    ];

    let refined = false;
    for (const { pattern, catalogId, label } of kidsRefinements) {
      if (pattern.test(text)) {
        catMapping = { vintedCatalogId: catalogId, vintedLabel: label };
        warnings.push(`Kids item refined to ${label}`);
        refined = true;
        break;
      }
    }

    // Default to generic kids clothing if no keyword match
    if (!refined && !catMapping) {
      catMapping = isGirl
        ? { vintedCatalogId: 1254, vintedLabel: "Kids > Girls clothing > Other girls' clothing" }
        : { vintedCatalogId: 1205, vintedLabel: "Kids > Boys clothing > Other boys' clothing" };
      warnings.push(`Kids item - no keyword match, defaulted to ${catMapping.vintedLabel}`);
    }
  }

  if (!catMapping) {
    warnings.push(
      `Depop category ${categoryId ?? 'unknown'} not mapped - select manually on Vinted`,
    );
  }

  return { mapping: catMapping, warnings };
}

/**
 * Last-resort Depop productType from the listing's own wording.
 *
 * Used when a Vinted catalog has no Depop mapping at all, so the draft would
 * otherwise land uncategorised. Order matters: distinctive nouns are tested
 * before generic ones, and the plain "shirt"/"top" catch-alls come last.
 */
export function depopProductTypeFromText(title: string, description: string): string | null {
  const text = `${title} ${description}`.toLowerCase();
  const kwMap: Array<[RegExp, string]> = [
    // ── Toys / figures / plushes / dolls (check first — distinctive nouns
    //    that don't overlap clothing terms). Maps to Depop's
    //    "everything-else.dolls-accessories" category. ──
    [
      /\b(plush(ie)?|figurine|action\s*figure|figure|funko|amiibo|doll[s]?|teddy|stuffed\s+(animal|toy|bear)|soft\s*toy|lego|nendoroid|pokemon|pokémon)\b/,
      'dolls-accessories',
    ],
    // ── Jewellery & Accessories (check first — specific items) ──
    [/\bring[s]?\b|\bsignet\b/, 'jewellery'],
    [/\bearring[s]?\b|\bear cuff/, 'jewellery'],
    [/\bnecklace[s]?\b|\bpendant[s]?\b|\bchain[s]?\b|\bcharm[s]?\b|\blocket/, 'jewellery'],
    [/\bbracelet[s]?\b|\bbangle[s]?\b|\banklet/, 'jewellery'],
    [/\bbrooch\b|\bpin[s]?\b/, 'jewellery'],
    [/\bjewel/, 'jewellery'],
    [/\bkeychain[s]?\b|\bkeyring[s]?\b|\bkey ring/, 'other-accessories'],
    [
      /\bhair\s*clip[s]?\b|\bhair\s*band[s]?\b|\bscrunchie[s]?\b|\bhair\s*accessori/,
      'hair-accessories',
    ],
    [/\bhat[s]?\b|\bcap[s]?\b|\bbeanie[s]?\b|\bbucket hat|\bfedora|\bberet/, 'hat'],
    [/\bbag[s]?\b|\bbackpack[s]?\b|\btote\b|\bhandbag[s]?\b|\bclutch|\bmessenger/, 'bag'],
    [/\bpurse[s]?\b|\bwallet[s]?\b|\bcard holder/, 'wallet'],
    [/\bbelt[s]?\b/, 'belt'],
    [/\bsunglasses\b|\bshades\b/, 'sunglasses'],
    [/\bwatch\b|\bwatches\b/, 'watch'],
    [/\bscarf\b|\bscarves\b/, 'scarf'],
    [/\bglove[s]?\b|\bmitten[s]?\b/, 'gloves'],
    [/\bphone case[s]?\b/, 'phone-case'],
    [/\bsock[s]?\b/, 'socks'],
    // ── Tops (specific before generic) ──
    [/\bpolo\s*shirt[s]?\b|\bpolo\b/, 'polo'],
    [/\bt-?shirt[s]?\b|\btee[s]?\b/, 't-shirt'],
    [/\bcrop\s*top[s]?\b/, 'crop-top'],
    [/\btube\s*top[s]?\b|\bbandeau/, 'tube-top'],
    [/\bcorset[s]?\b|\bbustier/, 'corset'],
    [/\bhoodie[s]?\b|\bsweatshirt[s]?\b/, 'hoodies'],
    [/\bjumper[s]?\b|\bsweater[s]?\b|\bknitwear\b|\bpullover/, 'jumper'],
    [/\bcardigan[s]?\b/, 'cardigan'],
    [/\bblouse[s]?\b/, 'blouse'],
    [/\bbodysuit[s]?\b/, 'bodysuit'],
    [/\bwaistcoat[s]?\b/, 'waistcoat'],
    // ── Outerwear (specific before generic jacket/coat) ──
    [/\bbomber\b/, 'bomber'],
    [/\bpuffer\b|\bpadded jacket/, 'puffer'],
    [/\bparka[s]?\b/, 'parka'],
    [/\bwindbreaker[s]?\b|\bwindcheater/, 'windbreaker'],
    [/\bdenim jacket[s]?\b/, 'denim-jacket'],
    [/\bleather jacket[s]?\b/, 'leather-jacket'],
    [/\bshacket[s]?\b/, 'shacket'],
    [/\bblazer[s]?\b/, 'blazer'],
    [/\bfleece[s]?\b/, 'fleece'],
    [/\bgilet[s]?\b/, 'gilet'],
    [/\bjacket[s]?\b/, 'jacket'],
    [/\bcoat[s]?\b|\bovercoat/, 'coat'],
    [/\bsuit[s]?\b/, 'suit'],
    // ── Shoes (specific before generic) ──
    [/\btrainer[s]?\b|\bsneaker[s]?\b/, 'trainers'],
    [/\bbootie[s]?\b|\bboot[s]?\b|\buggs?\b/, 'boots'],
    [/\bsandal[s]?\b/, 'sandals'],
    [/\bloafer[s]?\b|\bmoccasin[s]?\b/, 'loafers'],
    [/\bheel[s]?\b|\bstiletto[s]?\b|\bcourt[s]?\b/, 'heels'],
    [/\bplatform[s]?\b/, 'platforms'],
    [/\bflat[s]?\b|\bballet flat|\bballerina[s]?\b/, 'flats'],
    [/\bslide[s]?\b|\bflip.?flop[s]?\b/, 'slides'],
    [/\bslipper[s]?\b/, 'slippers'],
    [/\bmary\s*jane[s]?\b|\bt-?bar\s*shoe/, 'shoes'],
    [/\bclog[s]?\b|\bmule[s]?\b/, 'shoes'],
    [/\bespadrille[s]?\b/, 'shoes'],
    [/\bbrogue[s]?\b|\boxford[s]?\b/, 'shoes'],
    [/\bshoe[s]?\b/, 'shoes'],
    // ── Bottoms ──
    [/\bjeans\b|\bdenim\b/, 'jeans'],
    [/\bjogger[s]?\b|\bsweatpant[s]?\b|\btrack pant/, 'joggers'],
    [/\blegging[s]?\b/, 'leggings'],
    [/\btrousers\b|\bpants\b|\bchino[s]?\b|\bcargo/, 'trousers'],
    [/\bshorts\b/, 'shorts'],
    [/\bskirt[s]?\b/, 'skirt'],
    // ── Dresses & One-piece ──
    [/\bjumpsuit[s]?\b|\bplaysuit[s]?\b/, 'jumpsuit'],
    [/\bdungaree[s]?\b|\boverall[s]?\b/, 'dungarees'],
    [/\bco-?ord[s]?\b/, 'co-ord'],
    [/\bdress\b|\bdresses\b/, 'dresses'],
    // ── Underwear & Swimwear ──
    [/\bswimwear\b|\bbikini[s]?\b|\bswimsuit[s]?\b|\btrunks\b/, 'swimwear'],
    [/\blingerie\b/, 'lingerie'],
    [/\bbra[s]?\b|\bbralette/, 'bra'],
    [/\bboxer[s]?\b|\bunderwear\b|\bbrief[s]?\b/, 'underwear'],
    [/\bshapewear\b/, 'shapewear'],
    [/\bpyjama[s]?\b|\bnightwear\b|\bnightdress/, 'pyjamas'],
    [/\brobe[s]?\b|\bdressing gown/, 'robe'],
    // ── Other categories ──
    [/\bart\b|\bprint[s]?\b|\bposter[s]?\b|\bpainting/, 'art'],
    [/\bbook[s]?\b|\bmagazine[s]?\b/, 'books'],
    [/\bbeauty\b|\bmakeup\b|\bskincare\b|\bfragrance|\bperfume/, 'beauty'],
    [/\bsport[s]?\b|\bgym\b|\bfitness/, 'sport'],
    [/\bvinyl\b|\brecord[s]?\b|\bcd[s]?\b/, 'music'],
    // ── Generic fallbacks (last) ──
    [/\bshirt[s]?\b/, 'shirt'],
    [/\btop[s]?\b|\bvest[s]?\b/, 't-shirt'],
  ];
  for (const [pattern, pt] of kwMap) {
    if (pattern.test(text)) return pt;
  }
  return null;
}
