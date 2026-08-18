// GENERATED FILE - DO NOT EDIT.
//
// Copied from the extension repo (salelinx-app/src/data/), which owns the
// source tables and the tests that guard them. NOTE: the sync script this
// header used to name does not exist in either repo yet, so this copy is
// maintained by hand and has already drifted from the extension's version.
// See docs/EDGE-FUNCTIONS.md "Wiring up resolve-category" before editing.

// Reverse category mappings: Vinted → Depop
// Plus package size defaults and Vinted JSON-LD category → Depop label lookups.

import type { DepopCategoryMapping } from './crosslist-category.ts';

// ── Reverse Category Mapping: Vinted → Depop ────────────────────────────────
// Vinted catalog_id → Depop legacy_category_id
// Built from the inverse of DEPOP_CATEGORY_ID_TO_VINTED plus additional common Vinted categories.

const VINTED_CATEGORY_ID_TO_DEPOP: Record<number, DepopCategoryMapping> = {
  // ═══ MENSWEAR — Tops ═══
  1868: { depopCategoryId: 2, depopLabel: 'Menswear > T-shirts' },
  1806: { depopCategoryId: 2, depopLabel: 'Menswear > T-shirts' }, // Plain
  1807: { depopCategoryId: 2, depopLabel: 'Menswear > T-shirts' }, // Print
  1808: { depopCategoryId: 2, depopLabel: 'Menswear > T-shirts' }, // Striped
  // 1809 removed — does not exist in Vinted catalog
  1810: { depopCategoryId: 2, depopLabel: 'Menswear > T-shirts' }, // Long-sleeved
  1811: { depopCategoryId: 44, depopLabel: 'Menswear > Jumpers' },
  266: { depopCategoryId: 45, depopLabel: 'Menswear > Cardigans' },
  267: { depopCategoryId: 46, depopLabel: 'Menswear > Hoodies & Sweaters' },
  560: { depopCategoryId: 48, depopLabel: 'Menswear > Vests' },
  // Men's Shirts (Vinted subcategories under Shirts)
  77: { depopCategoryId: 51, depopLabel: 'Menswear > Shirts' }, // Shirts parent
  // 1800 is Cufflinks (Men > Accessories > Jewellery), not Shirts
  1800: { depopCategoryId: 190, depopLabel: 'Men > Jewellery > Other' },
  1801: { depopCategoryId: 51, depopLabel: 'Menswear > Shirts' }, // Denim
  1802: { depopCategoryId: 51, depopLabel: 'Menswear > Shirts' }, // Plain
  1803: { depopCategoryId: 51, depopLabel: 'Menswear > Shirts' }, // Print
  1804: { depopCategoryId: 51, depopLabel: 'Menswear > Shirts' }, // Other
  1805: { depopCategoryId: 51, depopLabel: 'Menswear > Shirts' }, // Striped

  // ═══ MENSWEAR — Bottoms ═══
  263: { depopCategoryId: 3, depopLabel: 'Menswear > Trousers' },
  1816: { depopCategoryId: 35, depopLabel: 'Menswear > Jeans' }, // Ripped
  1817: { depopCategoryId: 35, depopLabel: 'Menswear > Jeans' }, // Skinny
  1818: { depopCategoryId: 35, depopLabel: 'Menswear > Jeans' }, // Slim fit
  1819: { depopCategoryId: 35, depopLabel: 'Menswear > Jeans' }, // Straight fit
  1821: { depopCategoryId: 36, depopLabel: 'Menswear > Joggers' },
  272: { depopCategoryId: 41, depopLabel: 'Menswear > Shorts' },

  // ═══ MENSWEAR — Outerwear ═══
  1206: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' },
  2553: { depopCategoryId: 80, depopLabel: 'Menswear > Gilets' },
  1223: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Bomber
  1224: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Denim
  1225: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Duffle
  1226: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Harrington
  1227: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Parkas
  1230: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Trench
  1858: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Fleece
  1861: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Peacoats
  1859: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Raincoats
  2533: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Overcoats
  2534: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Biker
  2535: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Field & utility
  2536: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Puffer
  2537: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Quilted
  2538: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Shackets
  2539: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Ski
  2550: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Varsity
  2551: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Windbreakers
  2552: { depopCategoryId: 5, depopLabel: 'Menswear > Outerwear' }, // Ponchos

  // ═══ MENSWEAR — Suits ═══
  1789: { depopCategoryId: 81, depopLabel: 'Menswear > Suits' },

  // ═══ MENSWEAR — Shoes ═══
  1242: { depopCategoryId: 54, depopLabel: 'Menswear > Trainers' },
  2968: { depopCategoryId: 55, depopLabel: 'Menswear > Sandals' },
  2662: { depopCategoryId: 216, depopLabel: 'Menswear > Boots' },
  1238: { depopCategoryId: 217, depopLabel: 'Menswear > Formal Shoes' },
  2656: { depopCategoryId: 58, depopLabel: 'Menswear > Shoes' }, // Loafers
  2657: { depopCategoryId: 58, depopLabel: 'Menswear > Shoes' }, // Espadrilles
  2659: { depopCategoryId: 58, depopLabel: 'Menswear > Shoes' }, // Slippers
  2969: { depopCategoryId: 58, depopLabel: 'Menswear > Shoes' }, // Flip-flops
  2661: { depopCategoryId: 216, depopLabel: 'Menswear > Boots' }, // Chelsea & slip-on boots

  // ═══ MENSWEAR — Accessories ═══
  246: { depopCategoryId: 59, depopLabel: 'Menswear > Bags & Backpacks' },
  96: { depopCategoryId: 60, depopLabel: 'Menswear > Belts' },
  287: { depopCategoryId: 61, depopLabel: 'Menswear > Hats & Caps' }, // Caps
  288: { depopCategoryId: 61, depopLabel: 'Menswear > Hats & Caps' }, // Hats
  91: { depopCategoryId: 63, depopLabel: 'Menswear > Gloves' },
  87: { depopCategoryId: 64, depopLabel: 'Menswear > Scarves' },
  98: { depopCategoryId: 65, depopLabel: 'Menswear > Sunglasses' },
  97: { depopCategoryId: 66, depopLabel: 'Menswear > Watches' },
  1828: { depopCategoryId: 67, depopLabel: 'Menswear > Socks' },
  99: { depopCategoryId: 68, depopLabel: 'Menswear > Other Accessories' },

  // ═══ MENSWEAR — Underwear & Swimwear ═══
  1829: { depopCategoryId: 83, depopLabel: 'Menswear > Underwear' },
  84: { depopCategoryId: 85, depopLabel: 'Menswear > Swimwear' },
  1830: { depopCategoryId: 86, depopLabel: 'Menswear > Dressing Gowns' },

  // ═══ WOMENSWEAR — Tops ═══
  221: { depopCategoryId: 87, depopLabel: 'Womenswear > T-shirts' },
  1043: { depopCategoryId: 88, depopLabel: 'Womenswear > Blouses' },
  222: { depopCategoryId: 208, depopLabel: 'Womenswear > Shirts' },
  1041: { depopCategoryId: 91, depopLabel: 'Womenswear > Crop Tops' },
  196: { depopCategoryId: 93, depopLabel: 'Womenswear > Hoodies & Sweatshirts' },
  529: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' },
  194: { depopCategoryId: 95, depopLabel: 'Womenswear > Cardigans' },
  534: { depopCategoryId: 97, depopLabel: 'Womenswear > Vest Tops' },
  1835: { depopCategoryId: 98, depopLabel: 'Womenswear > Bodysuits' },
  228: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' },
  1874: { depopCategoryId: 9, depopLabel: 'Womenswear > Waistcoats' },

  // ═══ WOMENSWEAR — Bottoms ═══
  189: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' },
  198: { depopCategoryId: 100, depopLabel: 'Womenswear > Mini Skirts' },
  205: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' },
  525: { depopCategoryId: 107, depopLabel: 'Womenswear > Leggings' },

  // ═══ WOMENSWEAR — Dresses ═══
  176: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' },

  // ═══ WOMENSWEAR — Jumpsuits ═══
  1131: { depopCategoryId: 113, depopLabel: 'Womenswear > Jumpsuits' },

  // ═══ WOMENSWEAR — Outerwear ═══
  1037: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' },
  2524: { depopCategoryId: 142, depopLabel: 'Womenswear > Gilets' },
  1078: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Bomber
  1079: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Denim
  1080: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Raincoats
  1086: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Fleece
  1087: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Parkas
  1076: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Peacoats
  1090: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Faux fur
  1773: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Capes & ponchos
  1834: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Trench
  2525: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Duffle
  2526: { depopCategoryId: 13, depopLabel: 'Womenswear > Outerwear' }, // Overcoats
  2527: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Biker
  2528: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Field & utility
  2529: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Shackets
  2530: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Ski
  2531: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Varsity
  2532: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Windbreakers
  2596: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Quilted
  2614: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Puffer

  // ═══ WOMENSWEAR — Suits ═══
  1125: { depopCategoryId: 129, depopLabel: 'Womenswear > Trouser Suits' },
  532: { depopCategoryId: 138, depopLabel: 'Womenswear > Blazers' },

  // ═══ WOMENSWEAR — Shoes ═══
  2632: { depopCategoryId: 171, depopLabel: 'Womenswear > Trainers' },
  2949: { depopCategoryId: 164, depopLabel: 'Womenswear > Sandals' },
  2954: { depopCategoryId: 165, depopLabel: 'Womenswear > Loafers' },
  2618: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' },
  2952: { depopCategoryId: 170, depopLabel: 'Womenswear > Flip-flops & Slides' },
  2951: { depopCategoryId: 225, depopLabel: 'Womenswear > Lace-up Shoes' },
  543: { depopCategoryId: 167, depopLabel: 'Womenswear > Shoes > Heels' },
  2955: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Ballerinas
  2950: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Mary Janes
  2623: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Clogs & mules
  215: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Slippers
  2953: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Espadrilles
  2619: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' }, // Mid-calf boots
  211: { depopCategoryId: 168, depopLabel: 'Womenswear > Knee High Boots' },
  2620: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' }, // Over-the-knee boots
  2621: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' }, // Snow boots
  213: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Wellington boots
  2622: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' }, // Work boots
  2651: { depopCategoryId: 171, depopLabel: 'Womenswear > Trainers' }, // Running shoes

  // ═══ WOMENSWEAR — Bags ═══
  156: { depopCategoryId: 146, depopLabel: 'Womenswear > Handbags' },
  160: { depopCategoryId: 148, depopLabel: 'Womenswear > Wallets & Purses' },

  // ═══ WOMENSWEAR — Accessories ═══
  89: { depopCategoryId: 147, depopLabel: 'Womenswear > Scarves' },
  20: { depopCategoryId: 149, depopLabel: 'Womenswear > Belts' },
  26: { depopCategoryId: 150, depopLabel: 'Womenswear > Sunglasses' },
  231: { depopCategoryId: 151, depopLabel: 'Womenswear > Hats' },
  1262: { depopCategoryId: 153, depopLabel: 'Womenswear > Socks' },
  22: { depopCategoryId: 154, depopLabel: 'Womenswear > Watches' },
  1140: { depopCategoryId: 155, depopLabel: 'Womenswear > Other Accessories' },
  1123: { depopCategoryId: 194, depopLabel: 'Womenswear > Hair Accessories' },
  90: { depopCategoryId: 212, depopLabel: 'Womenswear > Gloves' },

  // ═══ JEWELLERY (Women) ═══
  // Use Depop leaf IDs: 184=Rings, 185=Earrings, 186=Bracelets, 183=Necklaces, 188=Pins, 187=Body, 190=Other, 189=Watches
  // Labels include gender prefix so fetch-vinted gender detection picks it up
  162: { depopCategoryId: 190, depopLabel: 'Women > Jewellery > Other' },
  553: { depopCategoryId: 184, depopLabel: 'Women > Jewellery > Rings' },
  165: { depopCategoryId: 186, depopLabel: 'Women > Jewellery > Bracelets' },
  164: { depopCategoryId: 183, depopLabel: 'Women > Jewellery > Necklaces' },
  163: { depopCategoryId: 185, depopLabel: 'Women > Jewellery > Earrings' },
  167: { depopCategoryId: 188, depopLabel: 'Women > Jewellery > Brooches' },
  1785: { depopCategoryId: 190, depopLabel: 'Women > Jewellery > Anklets' },
  166: { depopCategoryId: 190, depopLabel: 'Women > Jewellery > Jewellery Sets' },

  // ═══ JEWELLERY (Men) ═══
  241: { depopCategoryId: 183, depopLabel: 'Men > Jewellery > Necklaces' },
  242: { depopCategoryId: 184, depopLabel: 'Men > Jewellery > Rings' },
  243: { depopCategoryId: 186, depopLabel: 'Men > Jewellery > Bracelets' },
  244: { depopCategoryId: 190, depopLabel: 'Men > Jewellery > Other' },
  2966: { depopCategoryId: 185, depopLabel: 'Men > Jewellery > Earrings' },
  2967: { depopCategoryId: 190, depopLabel: 'Men > Jewellery > Other' }, // Charms & pendants

  // ═══ WOMENSWEAR — Underwear, Swimwear, Nightwear ═══
  218: { depopCategoryId: 156, depopLabel: 'Womenswear > Swimwear' }, // One-pieces
  219: { depopCategoryId: 156, depopLabel: 'Womenswear > Swimwear' }, // Bikinis
  220: { depopCategoryId: 156, depopLabel: 'Womenswear > Swimwear' }, // Other
  1780: { depopCategoryId: 156, depopLabel: 'Womenswear > Swimwear' }, // Cover-ups
  124: { depopCategoryId: 157, depopLabel: 'Womenswear > Lingerie' },
  119: { depopCategoryId: 158, depopLabel: 'Womenswear > Bras' },
  123: { depopCategoryId: 161, depopLabel: 'Womenswear > Nightwear' },
  1030: { depopCategoryId: 162, depopLabel: 'Womenswear > Dressing Gowns' },

  // ═══ KIDSWEAR — Girls Clothing ═══
  1254: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' },
  1195: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Root
  1243: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Baby girls
  1514: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Rompers
  1515: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Bodysuits
  1516: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Dungarees
  1517: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Sets
  1875: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Other baby
  1535: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // T-shirts
  1536: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Polo
  1537: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Shirts
  1538: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Short-sleeved
  1539: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Long-sleeved
  1540: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Sleeveless
  1541: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Tunics
  1878: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Other tops
  1542: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Jumpers
  1550: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Hoodies
  1554: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Short dresses
  1553: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Long dresses
  1248: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Skirts
  1559: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Jeans
  1565: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Leggings
  1250: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Shorts
  1518: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Gilets
  1606: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Fancy dress
  1253: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Activewear
  // Girls shoes
  1255: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' },
  1525: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Baby shoes
  // Girls accessories
  1258: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Bags
  1577: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Caps/hats
  1582: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Hairbands
  1586: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Jewellery
  1590: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Swimwear one-piece
  1592: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Bikinis
  1596: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // One-piece pyjamas
  1597: { depopCategoryId: 22, depopLabel: 'Kids > Girls Clothing' }, // Two-piece pyjamas

  // ═══ KIDSWEAR — Boys Clothing ═══
  1205: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' },
  1194: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Root
  1196: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Baby boys
  1642: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Rompers
  1643: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Bodysuits
  1644: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Dungarees
  1645: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Sets
  1883: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Other baby
  1662: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // T-shirts
  1663: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Polo
  1664: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Shirts
  1665: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Short-sleeved
  1666: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Long-sleeved
  1667: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Sleeveless
  1886: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Other tops
  1668: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Jumpers
  1672: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Hoodies
  1696: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Jeans
  1701: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Leggings
  1201: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Shorts
  1646: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Gilets
  1762: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Fancy dress
  1204: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Activewear
  // Boys shoes
  1256: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' },
  1653: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Baby shoes
  // Boys accessories
  1257: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Bags
  1749: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Caps/hats
  1750: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Swimming trunks
  1754: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // One-piece pyjamas
  1755: { depopCategoryId: 231, depopLabel: 'Kids > Boys Clothing' }, // Two-piece pyjamas

  // ═══ NON-CLOTHING — Art / Home / Posters ═══
  3849: { depopCategoryId: 18, depopLabel: 'Art > Prints' },
  3847: { depopCategoryId: 18, depopLabel: 'Art > Paintings' },
  3848: { depopCategoryId: 18, depopLabel: 'Art > Photography' },
  3822: { depopCategoryId: 18, depopLabel: 'Art > Sculptures' },
  3829: { depopCategoryId: 18, depopLabel: 'Art > Collectibles' },

  // ═══ NON-CLOTHING — Home ═══
  1918: { depopCategoryId: 21, depopLabel: 'Home' },
  1974: { depopCategoryId: 21, depopLabel: 'Home' }, // Cushions
  1925: { depopCategoryId: 21, depopLabel: 'Home' }, // Blankets
  1940: { depopCategoryId: 21, depopLabel: 'Home' }, // Vases
  1956: { depopCategoryId: 21, depopLabel: 'Home' }, // Candles
  1957: { depopCategoryId: 21, depopLabel: 'Home' }, // Candle holders
  1968: { depopCategoryId: 21, depopLabel: 'Home' }, // Wall mirrors
  1969: { depopCategoryId: 21, depopLabel: 'Home' }, // Table mirrors
  1966: { depopCategoryId: 21, depopLabel: 'Home' }, // Table clocks
  1967: { depopCategoryId: 21, depopLabel: 'Home' }, // Wall clocks
  1962: { depopCategoryId: 21, depopLabel: 'Home' }, // Baskets
  1963: { depopCategoryId: 21, depopLabel: 'Home' }, // Boxes
  1954: { depopCategoryId: 21, depopLabel: 'Home' }, // Rugs
  2006: { depopCategoryId: 21, depopLabel: 'Home' }, // Cups/mugs
  1960: { depopCategoryId: 21, depopLabel: 'Home' }, // Plates
  1959: { depopCategoryId: 21, depopLabel: 'Home' }, // Bowls
  1958: { depopCategoryId: 21, depopLabel: 'Home' }, // Dinner sets

  // ═══ NON-CLOTHING — Entertainment ═══
  2319: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Fiction
  2320: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Non-fiction
  2363: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Young adults
  2364: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Kids books
  2365: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Babies/toddlers
  5425: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Comics/manga
  5426: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Textbooks
  5427: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Colouring/puzzle books
  5424: { depopCategoryId: 27, depopLabel: 'Books & Magazines' }, // Magazines
  3041: { depopCategoryId: 29, depopLabel: 'Music' }, // Vinyl records
  3039: { depopCategoryId: 29, depopLabel: 'Music' }, // CDs
  3038: { depopCategoryId: 29, depopLabel: 'Music' }, // Audio cassettes
  3040: { depopCategoryId: 29, depopLabel: 'Music' }, // MiniDiscs
  3045: { depopCategoryId: 28, depopLabel: 'Film' }, // DVD
  3044: { depopCategoryId: 28, depopLabel: 'Film' }, // Blu-ray
  3042: { depopCategoryId: 28, depopLabel: 'Film' }, // 4K Blu-ray
  3048: { depopCategoryId: 28, depopLabel: 'Film' }, // VHS
  3043: { depopCategoryId: 28, depopLabel: 'Film' }, // Betamax
  3046: { depopCategoryId: 28, depopLabel: 'Film' }, // HD DVD
  3047: { depopCategoryId: 28, depopLabel: 'Film' }, // LaserDisc

  // ═══ NON-CLOTHING — Electronics ═══
  3075: { depopCategoryId: 228, depopLabel: 'Other > Cameras' }, // Digital cameras
  3076: { depopCategoryId: 228, depopLabel: 'Other > Cameras' }, // Film cameras
  3074: { depopCategoryId: 228, depopLabel: 'Other > Cameras' }, // Action cameras
  3077: { depopCategoryId: 228, depopLabel: 'Other > Cameras' }, // Instant cameras
  3078: { depopCategoryId: 228, depopLabel: 'Other > Cameras' }, // Video cameras
  3661: { depopCategoryId: 26, depopLabel: 'Other' }, // Mobile phones
  3580: { depopCategoryId: 26, depopLabel: 'Other' }, // Laptops
  3581: { depopCategoryId: 26, depopLabel: 'Other' }, // Desktop computers
  3728: { depopCategoryId: 26, depopLabel: 'Other' }, // Tablets
  3678: { depopCategoryId: 26, depopLabel: 'Other' }, // Headphones
  3681: { depopCategoryId: 26, depopLabel: 'Other' }, // Portable speakers
  3738: { depopCategoryId: 26, depopLabel: 'Other' }, // TVs
  3025: { depopCategoryId: 26, depopLabel: 'Other' }, // Consoles
  3026: { depopCategoryId: 26, depopLabel: 'Other' }, // Games
  3013: { depopCategoryId: 26, depopLabel: 'Other' }, // Other electronics

  // ═══ NON-CLOTHING — Hobbies & Collectables ═══
  4875: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Trading cards
  4876: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Booster packs
  4877: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Booster boxes
  4878: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Card decks
  4879: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Lots
  4881: { depopCategoryId: 26, depopLabel: 'Other' }, // Board games
  4882: { depopCategoryId: 26, depopLabel: 'Other' }, // Puzzles
  4883: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Tabletop gaming
  4897: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Coins
  4896: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Banknotes
  4889: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Stamps individual
  4890: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Stamps lots
  4894: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Postcards
  4902: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Sports memorabilia
  4903: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Music memorabilia
  4904: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Film/TV memorabilia
  4905: { depopCategoryId: 178, depopLabel: 'Art > Collectibles' }, // Other memorabilia

  // ═══ NON-CLOTHING — Sports ═══
  4332: { depopCategoryId: 24, depopLabel: 'Sports Equipment' },

  // ═══ NON-CLOTHING — Kids (non-clothing) ═══
  1764: { depopCategoryId: 26, depopLabel: 'Other' }, // Soft toys
  1767: { depopCategoryId: 26, depopLabel: 'Other' }, // Blocks & building
  3312: { depopCategoryId: 26, depopLabel: 'Other' }, // Toy figures
  1766: { depopCategoryId: 26, depopLabel: 'Other' }, // Musical toys
  1612: { depopCategoryId: 26, depopLabel: 'Other' }, // Buggies/pushchairs
  3383: { depopCategoryId: 26, depopLabel: 'Other' }, // Car seats
  1502: { depopCategoryId: 26, depopLabel: 'Other' }, // Other kids items
  // ── Additional accessories / jewellery ──
  2938: { depopCategoryId: 183, depopLabel: 'Women > Jewellery > Necklaces' }, // Charms & pendants
  1852: { depopCategoryId: 68, depopLabel: 'Menswear > Other Accessories' }, // Keychains
  2939: { depopCategoryId: 186, depopLabel: 'Women > Jewellery > Bracelets' }, // Anklets
  2937: { depopCategoryId: 188, depopLabel: 'Women > Jewellery > Brooches' }, // Brooches & pins

  // ═══ ADDITIONAL MAPPINGS (from Vinted catalog audit) ═══

  // ── Women's Jumpers & Sweaters (variants) ──
  190: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // V-neck
  191: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // Turtleneck
  192: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // Long
  193: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // ¾-sleeve
  1066: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // Other jumpers
  1067: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Kimonos
  195: { depopCategoryId: 95, depopLabel: 'Womenswear > Cardigans' }, // Boleros
  197: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // Other jumpers & sweaters

  // ── Women's Skirts (variants) ──
  199: { depopCategoryId: 100, depopLabel: 'Womenswear > Skirts' }, // Midi
  200: { depopCategoryId: 100, depopLabel: 'Womenswear > Skirts' }, // Maxi
  2927: { depopCategoryId: 100, depopLabel: 'Womenswear > Skirts' }, // Knee-length
  2928: { depopCategoryId: 100, depopLabel: 'Womenswear > Skirts' }, // Asymmetric
  5491: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Skorts

  // ── Women's Jumpsuits & Playsuits ──
  1132: { depopCategoryId: 113, depopLabel: 'Womenswear > Jumpsuits' }, // Playsuits
  1134: { depopCategoryId: 113, depopLabel: 'Womenswear > Jumpsuits' }, // Other

  // ── Women's Tops (additional) ──
  14: { depopCategoryId: 90, depopLabel: 'Womenswear > Cami Tops' }, // Camis
  223: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Short-sleeved
  224: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Long-sleeved
  225: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // ¾-sleeve
  227: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Tunics
  1042: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Off-the-shoulder
  1044: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Halterneck
  1045: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Turtlenecks
  1837: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Peplum

  // ── Women's Jeans (variants) ──
  1839: { depopCategoryId: 105, depopLabel: 'Womenswear > Bottoms > Boyfriend jeans' }, // Boyfriend
  1840: { depopCategoryId: 10, depopLabel: 'Womenswear > Bottoms' }, // Cropped - no Depop leaf
  1841: { depopCategoryId: 108, depopLabel: 'Womenswear > Bottoms > Flare jeans' }, // Flared
  1842: { depopCategoryId: 116, depopLabel: 'Womenswear > Bottoms > High waisted jeans' }, // High waisted
  1843: { depopCategoryId: 115, depopLabel: 'Womenswear > Bottoms > Ripped jeans' }, // Ripped
  1844: { depopCategoryId: 103, depopLabel: 'Womenswear > Bottoms > Skinny jeans' }, // Skinny
  1845: { depopCategoryId: 10, depopLabel: 'Womenswear > Bottoms' }, // Straight - no Depop leaf
  1864: { depopCategoryId: 10, depopLabel: 'Womenswear > Bottoms' }, // Other - no Depop leaf

  // ── Women's Trousers & Leggings (variants) ──
  184: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Leather
  185: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Skinny
  187: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Tailored
  1070: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Cropped
  1071: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Wide-leg
  1846: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Straight-leg
  526: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Harem

  // ── Women's Shorts (variants) ──
  538: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Denim
  1099: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // High-waisted
  1100: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Leather
  1101: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Lace
  1103: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Cargo
  1838: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Low-waisted
  203: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Knee-length
  204: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Cropped trousers

  // ── Women's Dresses (variants) ──
  178: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Mini
  179: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Denim
  1055: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Long
  1056: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Midi
  1057: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Formal
  1058: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Little black
  1059: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Casual
  1060: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Backless
  1061: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Strapless
  1065: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Summer
  1775: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Party & cocktail
  1776: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Wedding
  1777: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Prom
  1778: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Evening
  1779: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Winter

  // ── Women's Bags (variants) ──
  157: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Backpacks
  158: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Shoulder bags
  159: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Clutches
  552: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Tote bags
  161: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Makeup bags
  1784: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Satchels & messenger
  1848: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Bum bags
  1849: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Holdalls
  1850: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Luggage
  2940: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Beach bags
  2941: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Briefcases
  2942: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Bucket bags
  2944: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Gym bags
  2945: { depopCategoryId: 146, depopLabel: 'Womenswear > Bags' }, // Hobo bags

  // ── Women's Accessories (variants) ──
  230: { depopCategoryId: 151, depopLabel: 'Womenswear > Hats' }, // Caps
  234: { depopCategoryId: 151, depopLabel: 'Womenswear > Hats' }, // Headbands
  2931: { depopCategoryId: 147, depopLabel: 'Womenswear > Scarves' }, // Bandanas
  2934: { depopCategoryId: 151, depopLabel: 'Womenswear > Hats' }, // Beanies
  2935: { depopCategoryId: 155, depopLabel: 'Womenswear > Other Accessories' }, // Earmuffs
  2936: { depopCategoryId: 151, depopLabel: 'Womenswear > Hats' }, // Fascinators
  1851: { depopCategoryId: 155, depopLabel: 'Womenswear > Other Accessories' }, // Umbrellas

  // ── Women's Lingerie & Nightwear (variants) ──
  120: { depopCategoryId: 157, depopLabel: 'Womenswear > Lingerie' }, // Panties
  229: { depopCategoryId: 157, depopLabel: 'Womenswear > Lingerie' }, // Sets
  1781: { depopCategoryId: 157, depopLabel: 'Womenswear > Lingerie' }, // Shapewear
  1263: { depopCategoryId: 153, depopLabel: 'Womenswear > Socks & Tights' }, // Tights

  // ── Women's Maternity ──
  1177: { depopCategoryId: 10, depopLabel: 'Womenswear > Trousers' }, // Maternity trousers
  1178: { depopCategoryId: 100, depopLabel: 'Womenswear > Skirts' }, // Maternity skirts
  1179: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Maternity tops
  1181: { depopCategoryId: 113, depopLabel: 'Womenswear > Jumpsuits' }, // Maternity jumpsuits
  1182: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Maternity dresses
  1183: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Maternity coats
  1184: { depopCategoryId: 94, depopLabel: 'Womenswear > Jumpers' }, // Maternity jumpers
  1185: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Maternity shorts
  1186: { depopCategoryId: 156, depopLabel: 'Womenswear > Swimwear' }, // Maternity swim
  1615: { depopCategoryId: 157, depopLabel: 'Womenswear > Lingerie' }, // Maternity panties
  1616: { depopCategoryId: 161, depopLabel: 'Womenswear > Nightwear' }, // Maternity sleepwear
  1618: { depopCategoryId: 158, depopLabel: 'Womenswear > Bras' }, // Maternity bras
  2084: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Maternity activewear

  // ── Women's Activewear (clothing items) ──
  571: { depopCategoryId: 145, depopLabel: 'Womenswear > Jackets' }, // Activewear outerwear
  572: { depopCategoryId: 93, depopLabel: 'Womenswear > Hoodies & Sweatshirts' }, // Tracksuits
  573: { depopCategoryId: 107, depopLabel: 'Womenswear > Leggings' }, // Activewear trousers
  574: { depopCategoryId: 11, depopLabel: 'Womenswear > Dresses' }, // Activewear dresses
  575: { depopCategoryId: 100, depopLabel: 'Womenswear > Skirts' }, // Activewear skirts
  576: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Activewear tops
  577: { depopCategoryId: 93, depopLabel: 'Womenswear > Hoodies & Sweatshirts' }, // Activewear hoodies
  578: { depopCategoryId: 101, depopLabel: 'Womenswear > Shorts' }, // Activewear shorts
  580: { depopCategoryId: 99, depopLabel: 'Womenswear > Other Tops' }, // Other activewear

  // ── Women's Suits & Blazers (variants) ──
  1126: { depopCategoryId: 129, depopLabel: 'Womenswear > Suits' }, // Skirt suits
  1128: { depopCategoryId: 129, depopLabel: 'Womenswear > Suits' }, // Suit separates
  1129: { depopCategoryId: 129, depopLabel: 'Womenswear > Suits' }, // Other

  // ── Men's Jumpers & Sweaters (variants) ──
  264: { depopCategoryId: 44, depopLabel: 'Menswear > Jumpers' }, // V-neck
  265: { depopCategoryId: 44, depopLabel: 'Menswear > Jumpers' }, // Turtleneck
  1814: { depopCategoryId: 44, depopLabel: 'Menswear > Jumpers' }, // Long
  1815: { depopCategoryId: 44, depopLabel: 'Menswear > Jumpers' }, // Chunky-knit
  1825: { depopCategoryId: 48, depopLabel: 'Menswear > Vests' }, // Sleeveless
  268: { depopCategoryId: 44, depopLabel: 'Menswear > Jumpers' }, // Other

  // ── Men's Trousers (variants) ──
  259: { depopCategoryId: 37, depopLabel: 'Menswear > Trousers' }, // Skinny
  260: { depopCategoryId: 37, depopLabel: 'Menswear > Trousers' }, // Wide-leg
  261: { depopCategoryId: 37, depopLabel: 'Menswear > Trousers' }, // Tailored
  271: { depopCategoryId: 37, depopLabel: 'Menswear > Trousers' }, // Cropped

  // ── Men's Shorts (variants) ──
  1822: { depopCategoryId: 41, depopLabel: 'Menswear > Shorts' }, // Cargo
  1823: { depopCategoryId: 41, depopLabel: 'Menswear > Shorts' }, // Chino
  1824: { depopCategoryId: 41, depopLabel: 'Menswear > Shorts' }, // Denim

  // ── Men's Sleepwear ──
  2911: { depopCategoryId: 86, depopLabel: 'Menswear > Dressing Gowns' }, // One-piece pyjamas
  2912: { depopCategoryId: 86, depopLabel: 'Menswear > Dressing Gowns' }, // Pyjama bottoms
  2913: { depopCategoryId: 86, depopLabel: 'Menswear > Dressing Gowns' }, // Pyjama sets
  2914: { depopCategoryId: 86, depopLabel: 'Menswear > Dressing Gowns' }, // Pyjama tops

  // ── Men's Activewear (clothing items) ──
  581: { depopCategoryId: 82, depopLabel: 'Menswear > Jackets' }, // Activewear outerwear
  582: { depopCategoryId: 46, depopLabel: 'Menswear > Hoodies & Sweaters' }, // Tracksuits
  583: { depopCategoryId: 37, depopLabel: 'Menswear > Trousers' }, // Activewear trousers
  584: { depopCategoryId: 43, depopLabel: 'Menswear > T-shirts' }, // Activewear tops
  586: { depopCategoryId: 41, depopLabel: 'Menswear > Shorts' }, // Activewear shorts

  // ── Men's Socks & Underwear (additional) ──
  1867: { depopCategoryId: 67, depopLabel: 'Menswear > Socks' }, // Other socks & underwear

  // ── Men's Accessories (additional) ──
  248: { depopCategoryId: 59, depopLabel: 'Menswear > Bags' }, // Wallets

  // ── Women's Shoes — Sports (key types) ──
  2639: { depopCategoryId: 171, depopLabel: 'Womenswear > Trainers' }, // Basketball
  2642: { depopCategoryId: 174, depopLabel: 'Womenswear > Shoes' }, // Dance
  2643: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' }, // Football boots
  2645: { depopCategoryId: 166, depopLabel: 'Womenswear > Boots' }, // Hiking boots
  2655: { depopCategoryId: 171, depopLabel: 'Womenswear > Trainers' }, // Tennis shoes

  // ── Men's Shoes — Sports (key types) ──
  2663: { depopCategoryId: 54, depopLabel: 'Menswear > Trainers' }, // Basketball
  2669: { depopCategoryId: 54, depopLabel: 'Menswear > Trainers' }, // Running shoes
  2670: { depopCategoryId: 216, depopLabel: 'Menswear > Boots' }, // Hiking boots
  2673: { depopCategoryId: 54, depopLabel: 'Menswear > Trainers' }, // Tennis shoes

  // ── Kids' Shoes (expanded) ──
  2695: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls ankle boots
  2696: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls mid-calf boots
  2697: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls snow boots
  2698: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls wellington boots
  2690: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls clogs & mules
  2753: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls ballerinas/mary janes
  2701: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls espadrilles
  2702: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls lace-up shoes
  2704: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls flip-flops
  2705: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls sandals
  2707: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls slides
  1528: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls formal shoes
  1534: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls slippers
  2721: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys ankle boots
  2722: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys mid-calf boots
  2723: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys snow boots
  2724: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys wellington boots
  2726: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys lace-up shoes
  2729: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys flip-flops
  2730: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys sandals
  2732: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys slides
  1656: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys formal shoes
  1661: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys slippers
  2733: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Boys trainers
  2691: { depopCategoryId: 231, depopLabel: 'Kids > Shoes' }, // Girls trainers

  // ── Costumes & special outfits ──
  1782: { depopCategoryId: 155, depopLabel: 'Womenswear > Other' }, // Costumes
};

/** Look up Depop category from Vinted catalog_id */
export function vintedCategoryIdToDepop(catalogId: number): DepopCategoryMapping | null {
  return VINTED_CATEGORY_ID_TO_DEPOP[catalogId] ?? null;
}

// ── Vinted JSON-LD Category → Depop Category Label ──────────────────────────
// Maps the category string from Vinted's JSON-LD structured data to the
// matching option text in Depop's category dropdown on /products/create/.
// Depop has 319 options (repeated across Men/Women/Kids sections).

export const VINTED_TO_DEPOP_CATEGORY_LABEL: Record<string, string> = {
  // ═══ WOMEN — Outerwear ═══
  'women outerwear': 'Coats',
  'women capes & ponchos': 'Coats',
  'women coats': 'Coats',
  'women duffle coats': 'Coats',
  'women faux fur coats': 'Coats',
  'women overcoats & long coats': 'Coats',
  'women parkas': 'Coats',
  'women peacoats': 'Coats',
  'women raincoats': 'Coats',
  'women trench coats': 'Coats',
  'women gilets & body warmers': 'Gilets',
  'women jackets': 'Jackets',
  'women biker & racer jackets': 'Jackets',
  'women bomber jackets': 'Jackets',
  'women denim jackets': 'Jackets',
  'women field & utility jackets': 'Jackets',
  'women fleece jackets': 'Jackets',
  'women puffer jackets': 'Jackets',
  'women quilted jackets': 'Jackets',
  'women shackets': 'Jackets',
  'women ski & snowboard jackets': 'Jackets',
  'women varsity jackets': 'Jackets',
  'women windbreakers': 'Jackets',

  // ═══ WOMEN — Jumpers & sweaters ═══
  'women hoodies & sweatshirts': 'Hoodies',
  'women hoodies': 'Hoodies',
  'women sweatshirts': 'Sweatshirts',
  'women jumpers': 'Jumpers',
  'women v-neck jumpers': 'Jumpers',
  'women turtleneck jumpers': 'Jumpers',
  'women long jumpers': 'Jumpers',
  'women knitted jumpers': 'Jumpers',
  'women 3/4-sleeve jumpers': 'Jumpers',
  'women other jumpers': 'Jumpers',
  'women kimonos': 'Cardigans',
  'women cardigans': 'Cardigans',
  'women boleros': 'Cardigans',
  'women waistcoats': 'Waistcoats',
  'women other jumpers & sweaters': 'Jumpers',

  // ═══ WOMEN — Suits & blazers ═══
  'women blazers': 'Tailored jackets',
  'women trouser suits': 'Suits',
  'women skirt suits': 'Suits',
  'women suit separates': 'Suits',
  'women suits': 'Suits',
  'women other suits & blazers': 'Suits',

  // ═══ WOMEN — Dresses ═══
  'women dresses': 'Dresses',
  'women mini-dresses': 'Dresses',
  'women midi-dresses': 'Dresses',
  'women long dresses': 'Dresses',
  'women party & cocktail dresses': 'Going out dresses',
  'women wedding dresses': 'Wedding dresses',
  'women prom dresses': 'Prom dresses',
  'women evening dresses': 'Formal dresses',
  'women backless dresses': 'Going out dresses',
  'women summer dresses': 'Summer dresses',
  'women winter dresses': 'Dresses',
  'women formal & work dresses': 'Work dresses',
  'women casual dresses': 'Casual dresses',
  'women strapless dresses': 'Dresses',
  'women little black dresses': 'Going out dresses',
  'women denim dresses': 'Casual dresses',
  'women other dresses': 'Dresses',

  // ═══ WOMEN — Skirts ═══
  'women skirts': 'Skirts',
  'women mini skirts': 'Skirts',
  'women knee-length skirts': 'Skirts',
  'women midi skirts': 'Skirts',
  'women maxi skirts': 'Skirts',
  'women skorts': 'Skirts',

  // ═══ WOMEN — Tops & t-shirts ═══
  'women tops': 'T-shirts',
  'women tops & t-shirts': 'T-shirts',
  'women shirts': 'Shirts',
  'women blouses': 'Blouses',
  'women camis': 'Vests',
  'women t-shirts': 'T-shirts',
  'women vest tops': 'Vests',
  'women tunics': 'Blouses',
  'women crop tops': 'Crop tops',
  'women short-sleeved tops': 'T-shirts',
  'women 3/4-sleeve tops': 'T-shirts',
  'women long-sleeved tops': 'T-shirts',
  'women bodysuits': 'Bodysuits',
  'women off-the-shoulder tops': 'T-shirts',
  'women turtlenecks': 'Jumpers',
  'women peplum tops': 'Blouses',
  'women halterneck tops': 'Vests',
  'women other tops & t-shirts': 'T-shirts',
  'women polo shirts': 'Polo shirts',

  // ═══ WOMEN — Jeans ═══
  'women jeans': 'Jeans',
  'women boyfriend jeans': 'Jeans',
  'women cropped jeans': 'Jeans',
  'women flared jeans': 'Jeans',
  'women high waisted jeans': 'Jeans',
  'women ripped jeans': 'Jeans',
  'women skinny jeans': 'Jeans',
  'women straight jeans': 'Jeans',

  // ═══ WOMEN — Trousers & leggings ═══
  'women trousers': 'Trousers',
  'women trousers & leggings': 'Trousers',
  'women wide-leg trousers': 'Trousers',
  'women skinny trousers': 'Trousers',
  'women tailored trousers': 'Trousers',
  'women leather trousers': 'Trousers',
  'women leggings': 'Leggings',
  'women other trousers': 'Trousers',

  // ═══ WOMEN — Shorts ═══
  'women shorts': 'Shorts',
  'women shorts & cropped trousers': 'Shorts',
  'women denim shorts': 'Shorts',
  'women cargo shorts': 'Shorts',
  'women other shorts': 'Shorts',

  // ═══ WOMEN — Jumpsuits & playsuits ═══
  'women jumpsuits': 'Jumpsuits',
  'women playsuits': 'Playsuits',
  'women jumpsuits & playsuits': 'Jumpsuits',
  'women other jumpsuits & playsuits': 'Jumpsuits',

  // ═══ WOMEN — Swimwear ═══
  'women swimwear': 'Swimsuits',
  'women one-pieces': 'Swimsuits',
  'women bikinis & tankinis': 'Bikini and tankini sets',
  'women cover-ups & sarongs': 'Cover ups',
  'women other swimwear & beachwear': 'Swimsuits',

  // ═══ WOMEN — Lingerie & nightwear ═══
  'women lingerie': 'Bras',
  'women lingerie & nightwear': 'Bras',
  'women bras': 'Bras',
  'women panties': 'Panties',
  'women sets': 'Bras',
  'women shapewear': 'Shapewear',
  'women nightwear': 'Pyjamas',
  'women dressing gowns': 'Robes',
  'women tights & stockings': 'Tights',
  'women socks': 'Socks',

  // ═══ WOMEN — Activewear ═══
  'women activewear': 'T-shirts',
  'women sports bras': 'Bras',
  'women tracksuits': 'Hoodies',

  // ═══ WOMEN — Costumes ═══
  'women costumes & special outfits': 'Fancy dress',

  // ═══ WOMEN — Shoes ═══
  'women shoes': 'Trainers',
  'women ballerinas': 'Ballet shoes',
  'women boat shoes, loafers & moccasins': 'Loafers',
  'women boots': 'Boots',
  'women ankle boots': 'Boots',
  'women mid-calf boots': 'Boots',
  'women knee-high boots': 'Boots',
  'women over-the-knee boots': 'Boots',
  'women snow boots': 'Boots',
  'women wellington boots': 'Boots',
  'women work boots': 'Boots',
  'women clogs & mules': 'Mules',
  'women espadrilles': 'Espadrilles',
  'women flip-flops & slides': 'Slides',
  'women heels': 'Courts',
  'women lace-up shoes': 'Brogues',
  'women mary janes & t-bar shoes': 'Courts',
  'women sandals': 'Sandals',
  'women slippers': 'Slippers',
  'women sports shoes': 'Trainers',
  'women running shoes': 'Trainers',
  'women trainers': 'Trainers',

  // ═══ WOMEN — Bags ═══
  'women bags': 'Bags',
  'women backpacks': 'Bags',
  'women handbags': 'Bags',
  'women shoulder bags': 'Bags',
  'women tote bags': 'Bags',
  'women clutches': 'Bags',
  'women bum bags': 'Bags',
  'women bucket bags': 'Bags',
  'women satchels & messenger bags': 'Bags',
  'women wallets & purses': 'Wallets and cardholders',
  'women makeup bags': 'Bags',
  'women holdalls & duffel bags': 'Bags',
  'women luggage & suitcases': 'Bags',

  // ═══ WOMEN — Accessories ═══
  'women accessories': 'Jewellery',
  'women belts': 'Belts',
  'women gloves': 'Gloves',
  'women hair accessories': 'Hair accessories',
  'women hats & caps': 'Hats and caps',
  'women hats': 'Hats and caps',
  'women caps': 'Hats and caps',
  'women beanies': 'Hats and caps',
  'women headbands': 'Hair accessories',
  'women fascinators': 'Hats and caps',
  'women jewellery': 'Jewellery',
  'women anklets': 'Jewellery',
  'women bracelets': 'Jewellery',
  'women brooches': 'Jewellery',
  'women charms & pendants': 'Jewellery',
  'women earrings': 'Jewellery',
  'women jewellery sets': 'Jewellery',
  'women necklaces': 'Jewellery',
  'women rings': 'Jewellery',
  'women other jewellery': 'Jewellery',
  'women body jewellery': 'Jewellery',
  'women keyrings': 'Other',
  'women scarves & shawls': 'Scarves and wraps',
  'women scarves': 'Scarves and wraps',
  'women sunglasses': 'Sunglasses',
  'women tech accessories': 'Other',
  'women umbrellas': 'Other',
  'women watches': 'Watches',
  'women other accessories': 'Other',
  'women bandanas & headscarves': 'Scarves and wraps',

  // ═══ WOMEN — Beauty ═══
  'women make-up': 'Makeup',
  'women perfume': 'Fragrance',
  'women beauty': 'Skincare',
  'women facial care': 'Skincare',
  'women body care': 'Bath and body',
  'women hair care': 'Haircare',
  'women nail care': 'Nails',

  // ═══ MEN — Outerwear ═══
  'men outerwear': 'Coats',
  'men coats': 'Coats',
  'men duffle coats': 'Coats',
  'men overcoats & long coats': 'Coats',
  'men parkas': 'Coats',
  'men peacoats': 'Coats',
  'men raincoats': 'Coats',
  'men trench coats': 'Coats',
  'men gilets & body warmers': 'Gilets',
  'men jackets': 'Jackets',
  'men biker & racer jackets': 'Jackets',
  'men bomber jackets': 'Jackets',
  'men denim jackets': 'Jackets',
  'men field & utility jackets': 'Jackets',
  'men fleece jackets': 'Jackets',
  'men harrington jackets': 'Jackets',
  'men puffer jackets': 'Jackets',
  'men quilted jackets': 'Jackets',
  'men shackets': 'Jackets',
  'men ski & snowboard jackets': 'Jackets',
  'men varsity jackets': 'Jackets',
  'men windbreakers': 'Jackets',
  'men ponchos': 'Coats',

  // ═══ MEN — Tops & t-shirts ═══
  'men tops': 'T-shirts',
  'men tops & t-shirts': 'T-shirts',
  'men shirts': 'Shirts',
  'men checked shirts': 'Shirts',
  'men denim shirts': 'Shirts',
  'men plain shirts': 'Shirts',
  'men print shirts': 'Shirts',
  'men striped shirts': 'Shirts',
  'men other shirts': 'Shirts',
  'men t-shirts': 'T-shirts',
  'men plain t-shirts': 'T-shirts',
  'men print t-shirts': 'T-shirts',
  'men striped t-shirts': 'T-shirts',
  'men polo shirts': 'Polo shirts',
  'men long-sleeved t-shirts': 'T-shirts',
  'men other t-shirts': 'T-shirts',
  'men vests': 'Vests',
  'men vests & sleeveless t-shirts': 'Vests',

  // ═══ MEN — Suits & blazers ═══
  'men suits': 'Suits',
  'men suits & blazers': 'Suits',
  'men suit jackets & blazers': 'Tailored jackets',
  'men blazers': 'Tailored jackets',
  'men suit trousers': 'Tailored trousers',
  'men waistcoats': 'Waistcoats',
  'men suit sets': 'Suits',
  'men wedding suits': 'Suits',

  // ═══ MEN — Jumpers & sweaters ═══
  'men jumpers': 'Jumpers',
  'men jumpers & sweaters': 'Jumpers',
  'men hoodies & sweaters': 'Hoodies',
  'men hoodies': 'Hoodies',
  'men zip-through hoodies & sweaters': 'Hoodies',
  'men cardigans': 'Cardigans',
  'men crew neck jumpers': 'Jumpers',
  'men v-neck jumpers': 'Jumpers',
  'men turtleneck jumpers': 'Jumpers',
  'men chunky-knit jumpers': 'Jumpers',
  'men sleeveless jumpers': 'Vests',
  'men other jumpers & sweaters': 'Jumpers',
  'men sweatshirts': 'Sweatshirts',

  // ═══ MEN — Jeans ═══
  'men jeans': 'Jeans',
  'men ripped jeans': 'Jeans',
  'men skinny jeans': 'Jeans',
  'men slim fit jeans': 'Jeans',
  'men straight fit jeans': 'Jeans',

  // ═══ MEN — Trousers ═══
  'men trousers': 'Trousers',
  'men chinos': 'Trousers',
  'men joggers': 'Sweatpants',
  'men skinny trousers': 'Trousers',
  'men tailored trousers': 'Tailored trousers',
  'men wide-legged trousers': 'Trousers',
  'men other trousers': 'Trousers',

  // ═══ MEN — Shorts ═══
  'men shorts': 'Shorts',
  'men cargo shorts': 'Shorts',
  'men chino shorts': 'Shorts',
  'men denim shorts': 'Shorts',
  'men other shorts': 'Shorts',

  // ═══ MEN — Socks & underwear ═══
  'men underwear': 'Boxers and briefs',
  'men socks': 'Socks',
  'men dressing gowns': 'Robes',
  'men socks & underwear': 'Socks',
  'men sleepwear': 'Pyjamas',

  // ═══ MEN — Swimwear ═══
  'men swimwear': 'Swim briefs and shorts',

  // ═══ MEN — Activewear ═══
  'men activewear': 'T-shirts',
  'men tracksuits': 'Hoodies',

  // ═══ MEN — Costumes ═══
  'men costumes & special outfits': 'Fancy dress',

  // ═══ MEN — Shoes ═══
  'men shoes': 'Trainers',
  'men boat shoes, loafers & moccasins': 'Loafers',
  'men boots': 'Boots',
  'men chelsea & slip-on boots': 'Boots',
  'men desert & lace-up boots': 'Boots',
  'men snow boots': 'Boots',
  'men wellington boots': 'Boots',
  'men work boots': 'Boots',
  'men clogs & mules': 'Slippers',
  'men espadrilles': 'Espadrilles',
  'men flip-flops & slides': 'Slides',
  'men formal shoes': 'Oxfords',
  'men sandals': 'Sandals',
  'men slippers': 'Slippers',
  'men sports shoes': 'Trainers',
  'men running shoes': 'Trainers',
  'men trainers': 'Trainers',

  // ═══ MEN — Accessories ═══
  'men accessories': 'Jewellery',
  'men bags': 'Bags',
  'men bags & backpacks': 'Bags',
  'men backpacks': 'Bags',
  'men wallets': 'Wallets and cardholders',
  'men belts': 'Belts',
  'men gloves': 'Gloves',
  'men hats & caps': 'Hats and caps',
  'men hats': 'Hats and caps',
  'men caps': 'Hats and caps',
  'men beanies': 'Hats and caps',
  'men jewellery': 'Jewellery',
  'men bracelets': 'Jewellery',
  'men cufflinks': 'Jewellery',
  'men earrings': 'Jewellery',
  'men necklaces': 'Jewellery',
  'men rings': 'Jewellery',
  'men other jewellery': 'Jewellery',
  'men scarves & shawls': 'Scarves and wraps',
  'men scarves': 'Scarves and wraps',
  'men sunglasses': 'Sunglasses',
  'men ties & bow ties': 'Other',
  'men watches': 'Watches',
  'men other accessories': 'Other',
  'men bandanas & headscarves': 'Scarves and wraps',

  // ═══ MEN — Grooming ═══
  'men grooming': 'Grooming',
  'men aftershave & cologne': 'Fragrance',

  // ═══ KIDS / BOYS / GIRLS — Clothing ═══
  'girls outerwear': 'Coats',
  'boys outerwear': 'Coats',
  'girls coats': 'Coats',
  'boys coats': 'Coats',
  'girls jackets': 'Jackets',
  'boys jackets': 'Jackets',
  'girls gilets & body warmers': 'Gilets',
  'boys gilets & body warmers': 'Gilets',
  'girls jumpers & sweaters': 'Jumpers',
  'boys jumpers & sweaters': 'Jumpers',
  'girls hoodies & sweatshirts': 'Hoodies',
  'boys hoodies & sweatshirts': 'Hoodies',
  'girls hoodies & sweaters': 'Hoodies',
  'boys hoodies & sweaters': 'Hoodies',
  'girls cardigans': 'Cardigans',
  'boys cardigans': 'Cardigans',
  'girls jumpers': 'Jumpers',
  'boys jumpers': 'Jumpers',
  'girls tops & t-shirts': 'T-shirts',
  'boys tops & t-shirts': 'T-shirts',
  'girls t-shirts': 'T-shirts',
  'boys t-shirts': 'T-shirts',
  'girls shirts': 'Shirts',
  'boys shirts': 'Shirts',
  'girls blouses': 'Blouses',
  'girls polo shirts': 'Polo shirts',
  'boys polo shirts': 'Polo shirts',
  'girls vests & sleeveless t-shirts': 'Vests',
  'boys vests & sleeveless t-shirts': 'Vests',
  // ═══ KIDS — Dresses ═══
  'girls dresses': 'Dresses',
  'boys dresses': 'Dresses',
  'girls mini-dresses': 'Dresses',
  'girls midi-dresses': 'Dresses',
  'girls long dresses': 'Dresses',
  'girls casual dresses': 'Casual dresses',
  'girls formal dresses': 'Formal dresses',
  'girls summer dresses': 'Summer dresses',
  'girls party & cocktail dresses': 'Dresses',
  'girls short dresses': 'Dresses',
  'girls other dresses': 'Dresses',
  // ═══ KIDS — Bottoms ═══
  'girls jeans': 'Jeans',
  'boys jeans': 'Jeans',
  'girls trousers': 'Trousers',
  'boys trousers': 'Trousers',
  'girls trousers & leggings': 'Trousers',
  'boys trousers & leggings': 'Trousers',
  'girls shorts': 'Shorts',
  'boys shorts': 'Shorts',
  'girls shorts & cropped trousers': 'Shorts',
  'boys shorts & cropped trousers': 'Shorts',
  'girls leggings': 'Leggings',
  'boys leggings': 'Leggings',
  'girls skirts': 'Skirts',
  'girls joggers': 'Sweatpants',
  'boys joggers': 'Sweatpants',
  // ═══ KIDS — Suits / Jumpsuits ═══
  'girls suits & blazers': 'Suits',
  'boys suits & blazers': 'Suits',
  'girls waistcoats': 'Waistcoats',
  'boys waistcoats': 'Waistcoats',
  'girls jumpsuits': 'Jumpsuits',
  'boys jumpsuits': 'Jumpsuits',
  'girls jumpsuits & playsuits': 'Jumpsuits',
  'boys jumpsuits & playsuits': 'Jumpsuits',
  'girls playsuits': 'Playsuits',
  'boys playsuits': 'Playsuits',
  'girls dungarees': 'Dungarees',
  'boys dungarees': 'Dungarees',
  // ═══ KIDS — Swimwear / Nightwear ═══
  'girls swimwear': 'Swimsuits',
  'boys swimwear': 'Swimsuits',
  'girls one-pieces': 'Swimsuits',
  'girls bikinis & tankinis': 'Swimsuits',
  'girls nightwear': 'Pyjamas',
  'boys nightwear': 'Pyjamas',
  'girls sleepwear': 'Pyjamas',
  'boys sleepwear': 'Pyjamas',
  'girls pyjamas': 'Pyjamas',
  'boys pyjamas': 'Pyjamas',
  'girls dressing gowns': 'Robes',
  'boys dressing gowns': 'Robes',
  // ═══ KIDS — Shoes ═══
  'girls shoes': 'Trainers',
  'boys shoes': 'Trainers',
  'girls trainers': 'Trainers',
  'boys trainers': 'Trainers',
  'girls running shoes': 'Trainers',
  'boys running shoes': 'Trainers',
  'girls basketball shoes': 'Trainers',
  'boys basketball shoes': 'Trainers',
  'girls sports shoes': 'Trainers',
  'boys sports shoes': 'Trainers',
  'girls boots': 'Boots',
  'boys boots': 'Boots',
  'girls sandals': 'Sandals',
  'boys sandals': 'Sandals',
  'girls slippers': 'Slippers',
  'boys slippers': 'Slippers',
  'girls flip-flops & slides': 'Flip flops',
  'boys flip-flops & slides': 'Flip flops',
  'girls ballet shoes': 'Ballet shoes',
  'girls formal shoes': 'Oxfords',
  'boys formal shoes': 'Oxfords',
  // ═══ KIDS — Accessories ═══
  'girls bags & backpacks': 'Bags',
  'boys bags & backpacks': 'Bags',
  'girls hats & caps': 'Hats and caps',
  'boys hats & caps': 'Hats and caps',
  'girls gloves': 'Gloves',
  'boys gloves': 'Gloves',
  'girls scarves & shawls': 'Scarves and wraps',
  'boys scarves & shawls': 'Scarves and wraps',
  'girls sunglasses': 'Sunglasses',
  'boys sunglasses': 'Sunglasses',
  'girls belts': 'Belts',
  'boys belts': 'Belts',
  'girls jewellery': 'Jewellery',
  'boys jewellery': 'Jewellery',
  'girls watches': 'Watches',
  'boys watches': 'Watches',
  'girls hair accessories': 'Hair accessories',
  // ═══ KIDS — Costumes & Other ═══
  'girls costumes & special outfits': 'Fancy dress',
  'boys costumes & special outfits': 'Fancy dress',
  'girls activewear': 'T-shirts',
  'boys activewear': 'T-shirts',
  'girls other clothing': 'Other',
  'boys other clothing': 'Other',
  // ═══ KIDS — Baby ═══
  'girls baby girls clothing': 'Other',
  'boys baby boys clothing': 'Other',
  'girls rompers': 'Other',
  'boys rompers': 'Other',
  'girls bodysuits': 'Other',
  'boys bodysuits': 'Other',
  'girls sets': 'Other',
  'boys sets': 'Other',
  // ═══ KIDS — Underwear ═══
  'girls underwear & socks': 'Socks',
  'boys underwear & socks': 'Socks',
  'girls socks': 'Socks',
  'boys socks': 'Socks',
  'girls tights': 'Tights',

  // ═══ HOME ═══
  home: 'Other',
  'home textiles': 'Other',
  'home cushions': 'Other',
  'home blankets': 'Other',
  'home rugs': 'Other',
  'home rugs & mats': 'Other',
  'home tableware': 'Other',
  'home dinnerware': 'Other',
  'home drinkware': 'Other',
  'home cutlery': 'Other',
  'home cookware & bakeware': 'Other',
  'home kitchen tools': 'Other',
  'home home accessories': 'Other',
  'home candles & home fragrance': 'Other',
  'home vases': 'Other',
  'home mirrors': 'Other',
  'home clocks': 'Other',
  'home storage & organisation': 'Other',
  'home wall decor': 'Other',
  'home posters/prints': 'Other',
  'home paintings': 'Other',
  'home photography': 'Other',
  'home sculptures/figurines': 'Other',
  'home decorative accessories': 'Other',
  'home ornaments': 'Other',
  'home pet care': 'Other',

  // ═══ ENTERTAINMENT ═══
  entertainment: 'Other',
  'entertainment books': 'Other',
  'entertainment literature/fiction': 'Other',
  'entertainment non-fiction': 'Other',
  'entertainment comics/manga/graphic novels': 'Other',
  'entertainment textbooks/study materials': 'Other',
  'entertainment magazines': 'Other',
  'entertainment music': 'Other',
  'entertainment vinyl records': 'Other',
  'entertainment cds': 'Other',
  'entertainment audio cassettes': 'Other',
  'entertainment video': 'Other',
  'entertainment dvd': 'Other',
  'entertainment blu-ray': 'Other',
  'entertainment vhs': 'Other',

  // ═══ ELECTRONICS ═══
  electronics: 'Other',
  'electronics cameras & accessories': 'Other',
  'electronics cameras': 'Other',
  'electronics mobile phones & communication': 'Other',
  'electronics mobile phones': 'Other',
  'electronics computers & accessories': 'Other',
  'electronics laptops': 'Other',
  'electronics tablets, e-readers & accessories': 'Other',
  'electronics audio, headphones & hi-fi': 'Other',
  'electronics tv & home cinema': 'Other',
  'electronics video games & consoles': 'Other',
  'electronics consoles': 'Other',
  'electronics games': 'Other',

  // ═══ HOBBIES & COLLECTABLES ═══
  'hobbies & collectables': 'Other',
  'hobbies trading cards': 'Other',
  'hobbies board games': 'Other',
  'hobbies puzzles': 'Other',
  'hobbies coins & banknotes': 'Other',
  'hobbies stamps': 'Other',
  'hobbies postcards': 'Other',
  'hobbies memorabilia': 'Other',
  'hobbies tabletop & miniature gaming': 'Other',
  'hobbies musical instruments': 'Other',
  'hobbies arts & crafts': 'Other',

  // ═══ SPORTS ═══
  sports: 'Other',
  'sports fitness, running & yoga': 'Other',
  'sports cycling': 'Other',
  'sports team sports': 'Other',
  'sports water sports': 'Other',
  'sports winter sports': 'Other',
  'sports racquet sports': 'Other',
  'sports golf': 'Other',

  // ═══ KIDS — Non-clothing ═══
  'kids toys': 'Other',
  'kids soft toys & stuffed animals': 'Other',
  'kids blocks & building toys': 'Other',
  'kids toy figures & accessories': 'Other',
  'kids dolls & accessories': 'Other',
  'kids educational toys': 'Other',
  'kids electronic toys': 'Other',
  'kids musical toys': 'Other',
  'kids outdoor & sports toys': 'Other',
  'kids arts & crafts': 'Other',
  'kids pushchairs, carriers & car seats': 'Other',
  'kids furniture & decor': 'Other',
  'kids bathing & changing': 'Other',
  'kids nursing & feeding': 'Other',
  'kids sleep & bedding': 'Other',
  'kids school supplies': 'Other',
  'kids other kids items': 'Other',
};

// Package size defaults moved to ./package-size.ts — they are needed by the
// crosslist fetchers, which no longer import these server-side tables.
