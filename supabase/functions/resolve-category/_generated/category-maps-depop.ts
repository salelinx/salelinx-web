// GENERATED FILE - DO NOT EDIT.
//
// Synced from the extension repo by scripts/sync-category-maps.mjs.
// Edit the source there (and its tests), then re-run the sync and redeploy.

// Category mapping tables for crosslisting between Depop and Vinted
// Depop legacy_category_id (from api.depop.com/api/v3/attributes/) → Vinted UK catalog_id
// Vinted IDs sourced from vinted.co.uk catalog. IDs must be leaf nodes.

import type {
  CategoryMapping,
  DepopCategoryMapping,
  DepopDraftCategory,
} from './crosslist-category.ts';

export type { CategoryMapping, DepopCategoryMapping };

// Depop legacy_category_id → Vinted catalog_id
// Labels must include every intermediate level for dropdown navigation.
// Verified against docs/vinted-category-tree.md
const DEPOP_CATEGORY_ID_TO_VINTED: Record<number, CategoryMapping> = {
  // ═══ MENSWEAR — Tops ═══
  2: {
    vintedCatalogId: 1868,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > T-shirts > Other t-shirts',
  },
  43: {
    vintedCatalogId: 1868,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > T-shirts > Other t-shirts',
  },
  44: { vintedCatalogId: 1811, vintedLabel: 'Men > Clothing > Jumpers & sweaters > Jumpers' },
  45: { vintedCatalogId: 266, vintedLabel: 'Men > Clothing > Jumpers & sweaters > Cardigans' },
  46: {
    vintedCatalogId: 267,
    vintedLabel: 'Men > Clothing > Jumpers & sweaters > Hoodies & sweaters',
  },
  47: {
    vintedCatalogId: 267,
    vintedLabel: 'Men > Clothing > Jumpers & sweaters > Hoodies & sweaters',
  },
  48: {
    vintedCatalogId: 560,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > Vests & sleeveless t-shirts',
  },
  49: {
    // 5492, not 1809 — 1809 is not a real Vinted catalog id (see the note at
    // the top of category-maps-vinted.ts), so every polo crosslisted to Vinted
    // was sent to a category that does not exist.
    vintedCatalogId: 5492,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > Polo shirts',
  },
  52: {
    vintedCatalogId: 1868,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > T-shirts > Other t-shirts',
  },

  // ═══ MENSWEAR — Bottoms ═══
  3: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' },
  35: { vintedCatalogId: 1818, vintedLabel: 'Men > Clothing > Jeans > Slim fit jeans' },
  36: { vintedCatalogId: 1821, vintedLabel: 'Men > Clothing > Trousers > Joggers' },
  41: { vintedCatalogId: 272, vintedLabel: 'Men > Clothing > Shorts > Other shorts' },
  42: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' },

  // ═══ MENSWEAR — Outerwear ═══
  5: { vintedCatalogId: 1206, vintedLabel: 'Men > Clothing > Outerwear' },
  80: { vintedCatalogId: 2553, vintedLabel: 'Men > Clothing > Outerwear > Gilets & body warmers' },
  82: { vintedCatalogId: 1206, vintedLabel: 'Men > Clothing > Outerwear' },

  // ═══ MENSWEAR — Suits ═══
  81: { vintedCatalogId: 1789, vintedLabel: 'Men > Clothing > Suits & blazers > Suit sets' },

  // ═══ MENSWEAR — Shoes ═══
  6: { vintedCatalogId: 1242, vintedLabel: 'Men > Shoes > Trainers' },
  54: { vintedCatalogId: 1242, vintedLabel: 'Men > Shoes > Trainers' },
  55: { vintedCatalogId: 2968, vintedLabel: 'Men > Shoes > Sandals' },
  58: { vintedCatalogId: 1242, vintedLabel: 'Men > Shoes > Trainers' },
  216: { vintedCatalogId: 2662, vintedLabel: 'Men > Shoes > Boots > Desert & lace-up boots' },
  217: { vintedCatalogId: 1238, vintedLabel: 'Men > Shoes > Formal shoes' },

  // ═══ MENSWEAR — Accessories ═══
  59: { vintedCatalogId: 246, vintedLabel: 'Men > Accessories > Bags & backpacks > Backpacks' },
  60: { vintedCatalogId: 96, vintedLabel: 'Men > Accessories > Belts' },
  61: { vintedCatalogId: 287, vintedLabel: 'Men > Accessories > Hats & caps > Caps' },
  63: { vintedCatalogId: 91, vintedLabel: 'Men > Accessories > Gloves' },
  64: { vintedCatalogId: 87, vintedLabel: 'Men > Accessories > Scarves & shawls' },
  65: { vintedCatalogId: 98, vintedLabel: 'Men > Accessories > Sunglasses' },
  66: { vintedCatalogId: 97, vintedLabel: 'Men > Accessories > Watches' },
  67: { vintedCatalogId: 1828, vintedLabel: 'Men > Clothing > Socks & underwear > Socks' },
  68: { vintedCatalogId: 99, vintedLabel: 'Men > Accessories > Other accessories' },

  // ═══ MENSWEAR — Underwear & Swimwear ═══
  4: { vintedCatalogId: 1829, vintedLabel: 'Men > Clothing > Socks & underwear > Underwear' },
  83: { vintedCatalogId: 1829, vintedLabel: 'Men > Clothing > Socks & underwear > Underwear' },
  85: { vintedCatalogId: 84, vintedLabel: 'Men > Clothing > Swimwear' },
  86: { vintedCatalogId: 1830, vintedLabel: 'Men > Clothing > Socks & underwear > Dressing gowns' },

  // ═══ WOMENSWEAR — Tops ═══
  87: { vintedCatalogId: 221, vintedLabel: 'Women > Clothing > Tops & t-shirts > T-shirts' },
  88: { vintedCatalogId: 1043, vintedLabel: 'Women > Clothing > Tops & t-shirts > Blouses' },
  208: { vintedCatalogId: 222, vintedLabel: 'Women > Clothing > Tops & t-shirts > Shirts' },
  91: { vintedCatalogId: 1041, vintedLabel: 'Women > Clothing > Tops & t-shirts > Crop tops' },
  93: {
    vintedCatalogId: 196,
    vintedLabel: 'Women > Clothing > Jumpers & sweaters > Hoodies & sweatshirts',
  },
  94: {
    vintedCatalogId: 529,
    vintedLabel: 'Women > Clothing > Jumpers & sweaters > Jumpers > Knitted jumpers',
  },
  95: { vintedCatalogId: 194, vintedLabel: 'Women > Clothing > Jumpers & sweaters > Cardigans' },
  96: {
    vintedCatalogId: 196,
    vintedLabel: 'Women > Clothing > Jumpers & sweaters > Hoodies & sweatshirts',
  },
  97: { vintedCatalogId: 534, vintedLabel: 'Women > Clothing > Tops & t-shirts > Vest tops' },
  98: { vintedCatalogId: 1835, vintedLabel: 'Women > Clothing > Tops & t-shirts > Bodysuits' },
  99: {
    vintedCatalogId: 228,
    vintedLabel: 'Women > Clothing > Tops & t-shirts > Other tops & t-shirts',
  },
  207: {
    vintedCatalogId: 228,
    vintedLabel: 'Women > Clothing > Tops & t-shirts > Other tops & t-shirts',
  },
  9: { vintedCatalogId: 1874, vintedLabel: 'Women > Clothing > Jumpers & sweaters > Waistcoats' },

  // ═══ WOMENSWEAR — Bottoms ═══
  10: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  },
  100: { vintedCatalogId: 198, vintedLabel: 'Women > Clothing > Skirts > Mini skirts' },
  101: {
    vintedCatalogId: 205,
    vintedLabel: 'Women > Clothing > Shorts & cropped trousers > Other shorts & cropped trousers',
  },
  107: { vintedCatalogId: 525, vintedLabel: 'Women > Clothing > Trousers & leggings > Leggings' },
  117: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  },
  229: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  },

  // ═══ WOMENSWEAR — Jeans ═══
  // Depop ID 10 is shared between trousers/jeans — jeans handled separately if needed

  // ═══ WOMENSWEAR — Dresses ═══
  11: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' },

  // ═══ WOMENSWEAR — Jumpsuits ═══
  113: {
    vintedCatalogId: 1131,
    vintedLabel: 'Women > Clothing > Jumpsuits & playsuits > Jumpsuits',
  },
  210: {
    vintedCatalogId: 1131,
    vintedLabel: 'Women > Clothing > Jumpsuits & playsuits > Jumpsuits',
  },

  // ═══ WOMENSWEAR — Outerwear ═══
  13: { vintedCatalogId: 1037, vintedLabel: 'Women > Clothing > Outerwear' },
  142: {
    vintedCatalogId: 2524,
    vintedLabel: 'Women > Clothing > Outerwear > Gilets & body warmers',
  },
  145: { vintedCatalogId: 1037, vintedLabel: 'Women > Clothing > Outerwear' },

  // ═══ WOMENSWEAR — Suits ═══
  129: { vintedCatalogId: 1125, vintedLabel: 'Women > Clothing > Suits & blazers > Trouser suits' },
  138: { vintedCatalogId: 532, vintedLabel: 'Women > Clothing > Suits & blazers > Blazers' },

  // ═══ WOMENSWEAR — Shoes ═══
  14: { vintedCatalogId: 2632, vintedLabel: 'Women > Shoes > Trainers' },
  164: { vintedCatalogId: 2949, vintedLabel: 'Women > Shoes > Sandals' },
  165: { vintedCatalogId: 2954, vintedLabel: 'Women > Shoes > Boat shoes, loafers & moccasins' },
  166: { vintedCatalogId: 2618, vintedLabel: 'Women > Shoes > Boots > Ankle boots' },
  170: { vintedCatalogId: 2952, vintedLabel: 'Women > Shoes > Flip-flops & slides' },
  171: { vintedCatalogId: 2632, vintedLabel: 'Women > Shoes > Trainers' },
  174: { vintedCatalogId: 2632, vintedLabel: 'Women > Shoes > Trainers' },
  225: { vintedCatalogId: 2951, vintedLabel: 'Women > Shoes > Lace-up shoes' },

  // ═══ WOMENSWEAR — Bags ═══
  146: { vintedCatalogId: 156, vintedLabel: 'Women > Bags > Handbags' },
  148: { vintedCatalogId: 160, vintedLabel: 'Women > Bags > Wallets & purses' },

  // ═══ WOMENSWEAR — Accessories ═══
  147: { vintedCatalogId: 89, vintedLabel: 'Women > Accessories > Scarves & shawls' },
  149: { vintedCatalogId: 20, vintedLabel: 'Women > Accessories > Belts' },
  150: { vintedCatalogId: 26, vintedLabel: 'Women > Accessories > Sunglasses' },
  151: { vintedCatalogId: 231, vintedLabel: 'Women > Accessories > Hats & caps > Hats' },
  153: { vintedCatalogId: 1262, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Socks' },
  154: { vintedCatalogId: 22, vintedLabel: 'Women > Accessories > Watches' },
  155: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' },
  194: { vintedCatalogId: 1123, vintedLabel: 'Women > Accessories > Hair accessories' },
  212: { vintedCatalogId: 90, vintedLabel: 'Women > Accessories > Gloves' },

  // ═══ WOMENSWEAR — Underwear, Swimwear, Nightwear ═══
  156: {
    vintedCatalogId: 220,
    vintedLabel: 'Women > Clothing > Swimwear > Other swimwear & beachwear',
  },
  157: { vintedCatalogId: 124, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Other' },
  158: { vintedCatalogId: 119, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Bras' },
  160: { vintedCatalogId: 124, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Other' },
  161: { vintedCatalogId: 123, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Nightwear' },
  162: {
    vintedCatalogId: 1030,
    vintedLabel: 'Women > Clothing > Lingerie & nightwear > Dressing gowns',
  },
  163: { vintedCatalogId: 124, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Other' },

  // ═══ SHARED — Jewellery (refined by title/description in crosslister.ts) ═══
  17: { vintedCatalogId: 162, vintedLabel: 'Women > Accessories > Jewellery > Other jewellery' },

  // ═══ KIDSWEAR ═══
  // Depop kids categories map to Vinted Kids section
  // Girls clothing
  22: { vintedCatalogId: 1254, vintedLabel: "Kids > Girls clothing > Other girls' clothing" },
  230: { vintedCatalogId: 1254, vintedLabel: "Kids > Girls clothing > Other girls' clothing" },
  // Boys clothing
  231: { vintedCatalogId: 1205, vintedLabel: "Kids > Boys clothing > Other boys' clothing" },

  // ═══ MENSWEAR — Additional ═══
  50: {
    vintedCatalogId: 1868,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > T-shirts > Other t-shirts',
  }, // Dress shirts → generic top
  51: {
    vintedCatalogId: 1868,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > T-shirts > Other t-shirts',
  }, // Casual shirts
  205: {
    vintedCatalogId: 1868,
    vintedLabel: 'Men > Clothing > Tops & t-shirts > T-shirts > Other t-shirts',
  }, // Jerseys
  37: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' }, // Casual trousers
  38: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' }, // Dress trousers
  39: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' }, // Tracksuits
  40: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' }, // Overalls
  209: { vintedCatalogId: 263, vintedLabel: 'Men > Clothing > Trousers > Other trousers' }, // Dungarees
  53: { vintedCatalogId: 2662, vintedLabel: 'Men > Shoes > Boots > Desert & lace-up boots' }, // Ankle boots
  56: { vintedCatalogId: 1242, vintedLabel: 'Men > Shoes > Trainers' }, // Casual shoes
  57: { vintedCatalogId: 1238, vintedLabel: 'Men > Shoes > Formal shoes' }, // Dress shoes
  218: { vintedCatalogId: 2662, vintedLabel: 'Men > Shoes > Boots > Desert & lace-up boots' }, // Chelsea boots
  62: { vintedCatalogId: 287, vintedLabel: 'Men > Accessories > Hats & caps > Caps' }, // Caps (alias)
  84: { vintedCatalogId: 1829, vintedLabel: 'Men > Clothing > Socks & underwear > Underwear' }, // Briefs
  76: { vintedCatalogId: 532, vintedLabel: 'Women > Clothing > Suits & blazers > Blazers' }, // Blazers
  70: {
    vintedCatalogId: 1223,
    vintedLabel: 'Men > Clothing > Outerwear > Jackets > Bomber jackets',
  }, // Bomber jackets
  69: { vintedCatalogId: 1206, vintedLabel: 'Men > Clothing > Outerwear' }, // Leather jackets
  71: { vintedCatalogId: 1227, vintedLabel: 'Men > Clothing > Outerwear > Coats > Parkas' }, // Parkas
  72: {
    vintedCatalogId: 1861,
    vintedLabel: 'Men > Clothing > Outerwear > Coats > Peacoats',
  }, // Pea coats
  73: {
    vintedCatalogId: 1224,
    vintedLabel: 'Men > Clothing > Outerwear > Jackets > Denim jackets',
  }, // Denim jackets
  74: {
    vintedCatalogId: 1230,
    vintedLabel: 'Men > Clothing > Outerwear > Coats > Trench coats',
  }, // Trench coats
  75: {
    vintedCatalogId: 2551,
    vintedLabel: 'Men > Clothing > Outerwear > Jackets > Windbreakers',
  }, // Windbreakers
  77: { vintedCatalogId: 1206, vintedLabel: 'Men > Clothing > Outerwear' }, // Capes & ponchos
  78: {
    vintedCatalogId: 2536,
    vintedLabel: 'Men > Clothing > Outerwear > Jackets > Puffer jackets',
  }, // Puffer jackets
  79: { vintedCatalogId: 1206, vintedLabel: 'Men > Clothing > Outerwear' }, // Track jackets
  201: {
    vintedCatalogId: 1858,
    vintedLabel: 'Men > Clothing > Outerwear > Jackets > Fleece jackets',
  }, // Fleeces
  204: { vintedCatalogId: 1206, vintedLabel: 'Men > Clothing > Outerwear' }, // Snow suits

  // ═══ WOMENSWEAR — Additional ═══
  89: { vintedCatalogId: 119, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Bras' }, // Bralets
  90: {
    vintedCatalogId: 228,
    vintedLabel: 'Women > Clothing > Tops & t-shirts > Other tops & t-shirts',
  }, // Cami tops
  92: {
    vintedCatalogId: 228,
    vintedLabel: 'Women > Clothing > Tops & t-shirts > Other tops & t-shirts',
  }, // Bandeau tops
  206: {
    vintedCatalogId: 228,
    vintedLabel: 'Women > Clothing > Tops & t-shirts > Other tops & t-shirts',
  }, // Jerseys
  102: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Bootcut jeans
  103: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Skinny jeans
  104: {
    vintedCatalogId: 1131,
    vintedLabel: 'Women > Clothing > Jumpsuits & playsuits > Jumpsuits',
  }, // Dungarees
  105: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Boyfriend jeans
  106: {
    vintedCatalogId: 525,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Leggings',
  }, // Jeggings
  108: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Flare jeans
  109: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Casual trousers
  110: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Dress trousers
  111: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Wide leg jeans
  114: {
    vintedCatalogId: 205,
    vintedLabel: 'Women > Clothing > Shorts & cropped trousers > Other shorts & cropped trousers',
  }, // Culottes
  115: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Ripped jeans
  116: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // High waisted jeans
  214: { vintedCatalogId: 198, vintedLabel: 'Women > Clothing > Skirts > Mini skirts' }, // Mini skirts
  215: { vintedCatalogId: 198, vintedLabel: 'Women > Clothing > Skirts > Mini skirts' }, // Maxi skirts
  219: {
    vintedCatalogId: 189,
    vintedLabel: 'Women > Clothing > Trousers & leggings > Other trousers',
  }, // Mom Jeans
  220: { vintedCatalogId: 198, vintedLabel: 'Women > Clothing > Skirts > Mini skirts' }, // Pencil skirts
  221: { vintedCatalogId: 198, vintedLabel: 'Women > Clothing > Skirts > Mini skirts' }, // Pleated skirts
  118: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Casual dresses
  119: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Evening dresses
  120: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Going out dresses
  121: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Summer dresses
  122: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Maxi dresses
  123: {
    vintedCatalogId: 1131,
    vintedLabel: 'Women > Clothing > Jumpsuits & playsuits > Jumpsuits',
  }, // Jumpsuits (alias)
  124: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Midi dresses
  125: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Prom dresses
  126: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Babydoll dresses
  127: {
    vintedCatalogId: 1131,
    vintedLabel: 'Women > Clothing > Jumpsuits & playsuits > Jumpsuits',
  }, // Rompers
  128: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Bodycon dresses
  130: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Other dresses
  222: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Shirt dresses
  223: { vintedCatalogId: 176, vintedLabel: 'Women > Clothing > Dresses > Other dresses' }, // Wrap dresses
  131: { vintedCatalogId: 1037, vintedLabel: 'Women > Clothing > Outerwear' }, // Leather jackets
  132: {
    vintedCatalogId: 1078,
    vintedLabel: 'Women > Clothing > Outerwear > Jackets > Bomber jackets',
  }, // Bomber jackets
  133: {
    vintedCatalogId: 1087,
    vintedLabel: 'Women > Clothing > Outerwear > Coats > Parkas',
  }, // Parkas
  134: {
    vintedCatalogId: 1076,
    vintedLabel: 'Women > Clothing > Outerwear > Coats > Peacoats',
  }, // Pea coats
  135: {
    vintedCatalogId: 1079,
    vintedLabel: 'Women > Clothing > Outerwear > Jackets > Denim jackets',
  }, // Denim jackets
  136: {
    vintedCatalogId: 1834,
    vintedLabel: 'Women > Clothing > Outerwear > Coats > Trench coats',
  }, // Trench coats
  137: {
    vintedCatalogId: 2532,
    vintedLabel: 'Women > Clothing > Outerwear > Jackets > Windbreakers',
  }, // Windbreakers
  139: { vintedCatalogId: 1773, vintedLabel: 'Women > Clothing > Outerwear > Capes & ponchos' }, // Capes
  140: {
    vintedCatalogId: 2614,
    vintedLabel: 'Women > Clothing > Outerwear > Jackets > Puffer jackets',
  }, // Puffer jackets
  141: { vintedCatalogId: 1037, vintedLabel: 'Women > Clothing > Outerwear' }, // Track jackets
  143: { vintedCatalogId: 1037, vintedLabel: 'Women > Clothing > Outerwear' }, // Kimonos
  144: {
    vintedCatalogId: 1090,
    vintedLabel: 'Women > Clothing > Outerwear > Coats > Faux fur coats',
  }, // Faux fur coats
  202: {
    vintedCatalogId: 1086,
    vintedLabel: 'Women > Clothing > Outerwear > Jackets > Fleece jackets',
  }, // Fleeces
  203: { vintedCatalogId: 1037, vintedLabel: 'Women > Clothing > Outerwear' }, // Snow suits
  159: { vintedCatalogId: 123, vintedLabel: 'Women > Clothing > Lingerie & nightwear > Nightwear' }, // Nightgowns
  211: { vintedCatalogId: 1125, vintedLabel: 'Women > Clothing > Suits & blazers > Trouser suits' }, // Suits
  167: { vintedCatalogId: 543, vintedLabel: 'Women > Shoes > Heels' }, // Heels
  168: { vintedCatalogId: 2618, vintedLabel: 'Women > Shoes > Boots > Ankle boots' }, // Knee high boots
  169: { vintedCatalogId: 2632, vintedLabel: 'Women > Shoes > Trainers' }, // Platforms
  172: { vintedCatalogId: 2632, vintedLabel: 'Women > Shoes > Trainers' }, // Wedges
  173: { vintedCatalogId: 2632, vintedLabel: 'Women > Shoes > Trainers' }, // Flats
  224: { vintedCatalogId: 2618, vintedLabel: 'Women > Shoes > Boots > Ankle boots' }, // Ankle boots
  226: { vintedCatalogId: 2618, vintedLabel: 'Women > Shoes > Boots > Ankle boots' }, // Chelsea boots
  227: { vintedCatalogId: 2618, vintedLabel: 'Women > Shoes > Boots > Ankle boots' }, // Over the knee boots
  152: { vintedCatalogId: 1123, vintedLabel: 'Women > Accessories > Hair accessories' }, // Hair accessories
  213: { vintedCatalogId: 287, vintedLabel: 'Men > Accessories > Hats & caps > Caps' }, // Caps

  // ═══ JEWELLERY — Subcategories ═══
  183: { vintedCatalogId: 164, vintedLabel: 'Women > Accessories > Jewellery > Necklaces' },
  184: { vintedCatalogId: 553, vintedLabel: 'Women > Accessories > Jewellery > Rings' },
  185: { vintedCatalogId: 163, vintedLabel: 'Women > Accessories > Jewellery > Earrings' },
  186: { vintedCatalogId: 165, vintedLabel: 'Women > Accessories > Jewellery > Bracelets' },
  187: { vintedCatalogId: 162, vintedLabel: 'Women > Accessories > Jewellery > Other jewellery' }, // Body jewellery
  188: { vintedCatalogId: 167, vintedLabel: 'Women > Accessories > Jewellery > Brooches' }, // Pins
  189: { vintedCatalogId: 22, vintedLabel: 'Women > Accessories > Watches' }, // Watches (in Jewellery)
  190: { vintedCatalogId: 162, vintedLabel: 'Women > Accessories > Jewellery > Other jewellery' }, // Other

  // ═══ ART ═══
  18: {
    vintedCatalogId: 3849,
    vintedLabel: 'Home > Home accessories > Wall decor > Posters/prints',
  },
  175: {
    vintedCatalogId: 3849,
    vintedLabel: 'Home > Home accessories > Wall decor > Posters/prints',
  }, // Prints
  176: { vintedCatalogId: 3848, vintedLabel: 'Home > Home accessories > Wall decor > Photography' }, // Photography
  177: { vintedCatalogId: 3847, vintedLabel: 'Home > Home accessories > Wall decor > Paintings' }, // Paintings
  178: {
    vintedCatalogId: 4875,
    vintedLabel: 'Hobbies & collectables > Trading cards > Single trading cards',
  }, // Collectibles → best match
  179: {
    vintedCatalogId: 3849,
    vintedLabel: 'Home > Home accessories > Wall decor > Posters/prints',
  }, // Drawings & Illustrations
  180: { vintedCatalogId: 3822, vintedLabel: 'Home > Home accessories > Sculptures/figurines' }, // Sculptures
  181: {
    vintedCatalogId: 3849,
    vintedLabel: 'Home > Home accessories > Wall decor > Posters/prints',
  }, // Mixed Media
  182: {
    vintedCatalogId: 3849,
    vintedLabel: 'Home > Home accessories > Wall decor > Posters/prints',
  }, // Other art

  // ═══ HOME ═══
  21: { vintedCatalogId: 1918, vintedLabel: 'Home' },

  // ═══ BEAUTY ═══
  23: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Beauty (generic)
  191: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Makeup
  192: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Skincare
  193: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Fragrance
  // 194 already mapped above (Women > Accessories > Hair accessories)
  195: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Bath & Body
  196: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Tools & Brushes
  197: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' }, // Other beauty

  // ═══ SPORTS EQUIPMENT ═══
  24: { vintedCatalogId: 4332, vintedLabel: 'Sports' },

  // ═══ TRANSPORTATION ═══
  25: { vintedCatalogId: 4332, vintedLabel: 'Sports' }, // Closest match (bikes, skateboards etc)

  // ═══ BOOKS & MAGAZINES ═══
  27: { vintedCatalogId: 2319, vintedLabel: 'Entertainment > Books > Literature/fiction' },

  // ═══ FILM ═══
  28: { vintedCatalogId: 3045, vintedLabel: 'Entertainment > Video > DVD' },

  // ═══ MUSIC ═══
  29: { vintedCatalogId: 3041, vintedLabel: 'Entertainment > Music > Vinyl records' },

  // ═══ OTHER ═══
  26: { vintedCatalogId: 3013, vintedLabel: 'Electronics > Other devices & accessories > Other' },
  228: {
    vintedCatalogId: 3075,
    vintedLabel: 'Electronics > Cameras & accessories > Cameras > Digital',
  }, // Cameras

  // ═══ FACE MASKS ═══
  200: { vintedCatalogId: 1140, vintedLabel: 'Women > Accessories > Other accessories' },
};

/** Look up Vinted catalog_id from Depop legacy_category_id */
export function depopCategoryIdToVinted(categoryId: number): CategoryMapping | null {
  return DEPOP_CATEGORY_ID_TO_VINTED[categoryId] ?? null;
}

/**
 * Depop category ID → [productType, group] for the draft/edit API.
 * productType = parent group slug (e.g. "tops", "jewellery", "shoes")
 * group = department slug (e.g. "menswear", "womenswear")
 * Matches the format returned by Depop's edit-listing endpoint.
 */
export const DEPOP_ID_TO_DRAFT_CATEGORY: Record<number, DepopDraftCategory> = {
  // ── Legacy IDs (used by vintedCategoryIdToDepop reverse mapping) ──
  2: ['t-shirt', 'menswear'], // Menswear > T-shirts
  3: ['trousers', 'menswear'], // Menswear > Trousers
  5: ['jacket', 'menswear'], // Menswear > Outerwear
  9: ['waistcoat', 'womenswear'], // Womenswear > Waistcoats
  10: ['trousers', 'womenswear'], // Womenswear > Trousers
  11: ['dresses', 'dresses'], // Womenswear > Dresses
  13: ['jacket', 'womenswear'], // Womenswear > Outerwear
  18: ['art', 'art'], // Art > Prints
  21: ['home', 'other'], // Home
  22: ['kids', 'kids'], // Kids > Girls Clothing
  24: ['sport', 'other'], // Sports Equipment
  26: ['other', 'other'], // Other
  27: ['books', 'books-and-magazine'], // Books & Magazines
  28: ['film', 'other'], // Film
  29: ['music', 'other'], // Music
  // ── Menswear Bottoms ──
  35: ['jeans', 'bottoms'], // Jeans
  36: ['joggers', 'menswear'], // Joggers
  37: ['trousers', 'menswear'], // Trousers
  38: ['trousers', 'menswear'], // Trousers
  39: ['trousers', 'menswear'], // Trousers
  40: ['trousers', 'menswear'], // Trousers
  41: ['shorts', 'bottoms'], // Shorts
  42: ['trousers', 'menswear'], // Trousers
  209: ['trousers', 'menswear'], // Trousers
  // ── Menswear Tops ──
  43: ['t-shirt', 'menswear'], // T-shirts
  44: ['jumper', 'menswear'], // Jumpers
  45: ['cardigan', 'menswear'], // Cardigans
  46: ['hoodies', 'menswear'], // Hoodies & Sweaters
  47: ['t-shirt', 'menswear'], // T-shirts
  48: ['vest', 'menswear'], // Vests
  49: ['polo', 'menswear'], // Polo Shirts
  50: ['shirt', 'menswear'], // Shirts
  51: ['shirt', 'menswear'], // Shirts
  52: ['t-shirt', 'menswear'], // T-shirts
  205: ['t-shirt', 'menswear'], // T-shirts
  // ── Menswear Shoes ──
  53: ['trainers', 'footwear'], // Trainers
  54: ['trainers', 'footwear'], // Trainers
  55: ['sandals', 'footwear'], // Sandals
  56: ['loafers', 'footwear'], // Loafers
  57: ['shoes', 'menswear'], // Shoes (generic)
  58: ['shoes', 'menswear'], // Shoes (generic)
  216: ['boots', 'footwear'], // Boots
  217: ['shoes', 'menswear'], // Formal Shoes
  218: ['slippers', 'footwear'], // Slippers
  // ── Menswear Accessories ──
  59: ['bag', 'accessories'], // Bags & Backpacks
  60: ['belt', 'accessories'], // Belts
  61: ['hat', 'accessories'], // Hats & Caps
  62: ['other-accessories', 'accessories'], // Accessories (generic)
  63: ['gloves', 'accessories'], // Gloves
  64: ['scarf', 'accessories'], // Scarves
  65: ['sunglasses', 'accessories'], // Sunglasses
  66: ['watch', 'accessories'], // Watches
  67: ['socks', 'underwear'], // Socks
  68: ['other-accessories', 'accessories'], // Other Accessories
  // ── Menswear Outerwear ──
  69: ['coat', 'menswear'], // Coats
  70: ['coat', 'menswear'], // Coats
  71: ['jacket', 'menswear'], // Jackets
  72: ['bomber', 'menswear'], // Bomber
  73: ['puffer', 'menswear'], // Puffer
  74: ['parka', 'menswear'], // Parka
  75: ['windbreaker', 'menswear'], // Windbreaker
  76: ['fleece', 'menswear'], // Fleece
  77: ['jacket', 'menswear'], // Jackets
  78: ['denim-jacket', 'menswear'], // Denim Jacket
  79: ['leather-jacket', 'menswear'], // Leather Jacket
  80: ['gilet', 'menswear'], // Gilets
  81: ['suit', 'menswear'], // Suits
  82: ['jacket', 'menswear'], // Jackets
  201: ['blazer', 'menswear'], // Blazers
  204: ['coat', 'menswear'], // Coats
  // ── Menswear Underwear ──
  83: ['underwear', 'menswear'], // Underwear
  84: ['boxers', 'menswear'], // Boxers
  85: ['swimwear', 'menswear'], // Swimwear
  86: ['robe', 'menswear'], // Dressing Gowns
  // ── Womenswear Tops ──
  87: ['t-shirt', 'womenswear'], // T-shirts
  88: ['blouse', 'womenswear'], // Blouses
  89: ['t-shirt', 'womenswear'], // Tops
  90: ['t-shirt', 'womenswear'], // Tops
  91: ['crop-top', 'tops'], // Crop Tops
  92: ['t-shirt', 'womenswear'], // Tops
  93: ['hoodies', 'womenswear'], // Hoodies & Sweatshirts
  94: ['jumper', 'womenswear'], // Jumpers
  95: ['cardigan', 'womenswear'], // Cardigans
  96: ['t-shirt', 'womenswear'], // Tops
  97: ['vest', 'womenswear'], // Vest Tops
  98: ['bodysuit', 'womenswear'], // Bodysuits
  99: ['t-shirt', 'womenswear'], // Other Tops
  206: ['corset', 'womenswear'], // Corsets
  207: ['tube-top', 'womenswear'], // Tube Tops
  208: ['shirt', 'womenswear'], // Shirts
  // ── Womenswear Bottoms ──
  100: ['skirt', 'womenswear'], // Mini Skirts
  101: ['shorts', 'bottoms'], // Shorts
  102: ['jeans', 'bottoms'], // Jeans
  103: ['trousers', 'bottoms'], // Trousers
  104: ['trousers', 'bottoms'], // Trousers
  105: ['trousers', 'bottoms'], // Trousers
  106: ['trousers', 'bottoms'], // Trousers
  107: ['leggings', 'bottoms'], // Leggings
  108: ['skirt', 'womenswear'], // Skirts
  109: ['trousers', 'bottoms'], // Trousers
  110: ['joggers', 'womenswear'], // Joggers
  111: ['trousers', 'bottoms'], // Trousers
  113: ['jumpsuit', 'jumpsuit-and-playsuit'], // Jumpsuits
  114: ['dungarees', 'womenswear'], // Dungarees
  115: ['co-ord', 'womenswear'], // Co-ords
  116: ['trousers', 'bottoms'], // Trousers
  117: ['trousers', 'bottoms'], // Trousers
  210: ['skirt', 'womenswear'], // Skirts
  214: ['leggings', 'bottoms'], // Leggings
  215: ['trousers', 'bottoms'], // Trousers
  219: ['shorts', 'bottoms'], // Shorts
  220: ['joggers', 'womenswear'], // Joggers
  221: ['jeans', 'bottoms'], // Jeans
  229: ['trousers', 'bottoms'], // Trousers
  // ── Womenswear Dresses ──
  118: ['dresses', 'dresses'], // Dresses
  119: ['dresses', 'dresses'], // Dresses
  120: ['dresses', 'dresses'], // Dresses
  121: ['dresses', 'dresses'], // Dresses
  122: ['dresses', 'dresses'], // Dresses
  123: ['dresses', 'dresses'], // Dresses
  124: ['dresses', 'dresses'], // Dresses
  125: ['dresses', 'dresses'], // Dresses
  126: ['dresses', 'dresses'], // Dresses
  127: ['dresses', 'dresses'], // Dresses
  128: ['dresses', 'dresses'], // Dresses
  129: ['suit', 'womenswear'], // Trouser Suits
  130: ['dresses', 'dresses'], // Dresses
  222: ['dresses', 'dresses'], // Dresses
  223: ['dresses', 'dresses'], // Dresses
  // ── Womenswear Outerwear ──
  131: ['coat', 'womenswear'], // Coats
  132: ['coat', 'womenswear'], // Coats
  133: ['jacket', 'womenswear'], // Jackets
  134: ['bomber', 'womenswear'], // Bomber
  135: ['puffer', 'womenswear'], // Puffer
  136: ['parka', 'womenswear'], // Parka
  137: ['windbreaker', 'womenswear'], // Windbreaker
  138: ['blazer', 'womenswear'], // Blazers
  139: ['fleece', 'womenswear'], // Fleece
  140: ['denim-jacket', 'womenswear'], // Denim Jacket
  141: ['leather-jacket', 'womenswear'], // Leather Jacket
  142: ['gilet', 'womenswear'], // Gilets
  143: ['jacket', 'womenswear'], // Jackets
  144: ['coat', 'womenswear'], // Coats
  145: ['jacket', 'womenswear'], // Jackets
  202: ['shacket', 'womenswear'], // Shackets
  203: ['jacket', 'womenswear'], // Jackets
  // ── Womenswear Accessories ──
  146: ['bag', 'accessories'], // Handbags
  147: ['scarf', 'accessories'], // Scarves
  148: ['wallet', 'accessories'], // Wallets & Purses
  149: ['belt', 'accessories'], // Belts
  150: ['sunglasses', 'accessories'], // Sunglasses
  151: ['hat', 'accessories'], // Hats
  152: ['other-accessories', 'accessories'], // Accessories (generic)
  153: ['socks', 'underwear'], // Socks
  154: ['watch', 'accessories'], // Watches
  155: ['other-accessories', 'accessories'], // Other Accessories
  212: ['gloves', 'accessories'], // Gloves
  213: ['hair-accessories', 'accessories'], // Hair Accessories
  // ── Womenswear Lingerie / Underwear ──
  156: ['swimwear', 'womenswear'], // Swimwear
  157: ['lingerie', 'womenswear'], // Lingerie
  158: ['bra', 'womenswear'], // Bras
  159: ['underwear', 'womenswear'], // Underwear
  160: ['shapewear', 'underwear'], // Shapewear
  161: ['pyjamas', 'womenswear'], // Nightwear
  162: ['robe', 'womenswear'], // Dressing Gowns
  163: ['lingerie', 'womenswear'], // Lingerie
  // ── Womenswear Shoes ──
  164: ['sandals', 'footwear'], // Sandals
  165: ['loafers', 'footwear'], // Loafers
  166: ['boots', 'footwear'], // Boots
  167: ['heels', 'womenswear'], // Heels
  168: ['flats', 'womenswear'], // Flats
  169: ['platforms', 'womenswear'], // Platforms
  170: ['slides', 'footwear'], // Flip-flops & Slides
  171: ['trainers', 'footwear'], // Trainers
  172: ['shoes', 'womenswear'], // Shoes (generic)
  173: ['slippers', 'footwear'], // Slippers
  174: ['shoes', 'womenswear'], // Shoes (generic)
  224: ['boots', 'footwear'], // Boots
  225: ['shoes', 'womenswear'], // Lace-up Shoes
  226: ['heels', 'womenswear'], // Heels
  227: ['shoes', 'womenswear'], // Shoes
  211: ['suit', 'womenswear'], // Trouser Suits
  // ── Jewellery ──
  183: ['jewellery', 'accessories'], // Necklaces
  184: ['jewellery', 'accessories'], // Rings
  185: ['jewellery', 'accessories'], // Earrings
  186: ['jewellery', 'accessories'], // Bracelets
  187: ['jewellery', 'accessories'], // Jewellery (generic)
  188: ['jewellery', 'accessories'], // Brooches
  189: ['jewellery', 'accessories'], // Jewellery
  190: ['jewellery', 'accessories'], // Jewellery Sets
  // ── Art ──
  175: ['art', 'art'],
  176: ['art', 'art'],
  177: ['art', 'art'],
  178: ['art', 'art'],
  179: ['art', 'art'],
  180: ['art', 'art'],
  181: ['art', 'art'],
  182: ['art', 'art'],
  // ── Beauty ──
  191: ['beauty', 'beauty'],
  192: ['beauty', 'beauty'],
  193: ['beauty', 'beauty'],
  194: ['hair-accessories', 'accessories'], // Hair Accessories
  195: ['beauty', 'beauty'],
  196: ['beauty', 'beauty'],
  197: ['beauty', 'beauty'],
  // ── Kids ──
  230: ['kids', 'kids'],
  231: ['kids', 'kids'],
  // ── Other ──
  25: ['other', 'other'], // Transportation
  200: ['other', 'other'], // Face masks and coverings
  228: ['other', 'other'],
};

/**
 * Refine jewellery category (Depop ID 17) based on title/description keywords.
 * Returns a more specific Vinted subcategory instead of "Other jewellery".
 */
export function refineJewelleryCategory(title: string, description: string): CategoryMapping {
  const text = `${title} ${description}`.toLowerCase();

  // Order matters — check most specific first
  const keywords: Array<{ pattern: RegExp; mapping: CategoryMapping }> = [
    {
      pattern: /\bring[s]?\b|\bsignet\b|\bband ring/,
      mapping: { vintedCatalogId: 553, vintedLabel: 'Women > Accessories > Jewellery > Rings' },
    },
    {
      pattern: /\bbracelet[s]?\b|\bbangle[s]?\b|\bcuff\b|\bchain bracelet/,
      mapping: { vintedCatalogId: 165, vintedLabel: 'Women > Accessories > Jewellery > Bracelets' },
    },
    {
      pattern: /\bnecklace[s]?\b|\bpendant[s]?\b|\bchoker[s]?\b|\bchain\b|\blocket/,
      mapping: { vintedCatalogId: 164, vintedLabel: 'Women > Accessories > Jewellery > Necklaces' },
    },
    {
      pattern: /\bearrings?\b|\bstud[s]?\b|\bhoop[s]?\b|\bdrop earring|\bhuggie/,
      mapping: { vintedCatalogId: 163, vintedLabel: 'Women > Accessories > Jewellery > Earrings' },
    },
    {
      pattern: /\bbrooch(es)?\b|\bpin[s]?\b|\bbadge[s]?\b/,
      mapping: { vintedCatalogId: 167, vintedLabel: 'Women > Accessories > Jewellery > Brooches' },
    },
    {
      pattern: /\banklet[s]?\b|\bankle chain/,
      mapping: { vintedCatalogId: 1785, vintedLabel: 'Women > Accessories > Jewellery > Anklets' },
    },
    {
      pattern:
        /\bjewellery set|\bjewelry set|\bmatching set|\bnecklace.*earring|\bearring.*necklace/,
      mapping: {
        vintedCatalogId: 166,
        vintedLabel: 'Women > Accessories > Jewellery > Jewellery sets',
      },
    },
  ];

  for (const { pattern, mapping } of keywords) {
    if (pattern.test(text)) return mapping;
  }

  // Default fallback
  return { vintedCatalogId: 162, vintedLabel: 'Women > Accessories > Jewellery > Other jewellery' };
}

/**
 * Refine outerwear category based on title/description keywords.
 * Outerwear has Coats vs Jackets subsections with specific types.
 */
export function refineOuterwearCategory(
  title: string,
  description: string,
  gender: 'men' | 'women',
): CategoryMapping {
  const text = `${title} ${description}`.toLowerCase();
  const base = gender === 'men' ? 'Men > Clothing > Outerwear' : 'Women > Clothing > Outerwear';

  // Coats
  const coatKeywords: Array<{ pattern: RegExp; mapping: CategoryMapping }> =
    gender === 'men'
      ? [
          {
            pattern: /\bduffle\b/,
            mapping: { vintedCatalogId: 1225, vintedLabel: `${base} > Coats > Duffle coats` },
          },
          {
            pattern: /\bparka\b/,
            mapping: { vintedCatalogId: 1227, vintedLabel: `${base} > Coats > Parkas` },
          },
          {
            pattern: /\bpeacoat\b/,
            mapping: { vintedCatalogId: 1861, vintedLabel: `${base} > Coats > Peacoats` },
          },
          {
            pattern: /\braincoat\b|\bwaterproof coat\b/,
            mapping: { vintedCatalogId: 1859, vintedLabel: `${base} > Coats > Raincoats` },
          },
          {
            pattern: /\btrench\b/,
            mapping: { vintedCatalogId: 1230, vintedLabel: `${base} > Coats > Trench coats` },
          },
          {
            pattern: /\bovercoat\b|\blong coat\b|\bwool coat\b/,
            mapping: {
              vintedCatalogId: 2533,
              vintedLabel: `${base} > Coats > Overcoats & long coats`,
            },
          },
        ]
      : [
          {
            pattern: /\bduffle\b/,
            mapping: { vintedCatalogId: 2525, vintedLabel: `${base} > Coats > Duffle coats` },
          },
          {
            pattern: /\bfaux fur\b|\bfur coat\b/,
            mapping: { vintedCatalogId: 1090, vintedLabel: `${base} > Coats > Faux fur coats` },
          },
          {
            pattern: /\bparka\b/,
            mapping: { vintedCatalogId: 1087, vintedLabel: `${base} > Coats > Parkas` },
          },
          {
            pattern: /\bpeacoat\b/,
            mapping: { vintedCatalogId: 1076, vintedLabel: `${base} > Coats > Peacoats` },
          },
          {
            pattern: /\braincoat\b|\bwaterproof coat\b/,
            mapping: { vintedCatalogId: 1080, vintedLabel: `${base} > Coats > Raincoats` },
          },
          {
            pattern: /\btrench\b/,
            mapping: { vintedCatalogId: 1834, vintedLabel: `${base} > Coats > Trench coats` },
          },
          {
            pattern: /\bovercoat\b|\blong coat\b|\bwool coat\b/,
            mapping: {
              vintedCatalogId: 2526,
              vintedLabel: `${base} > Coats > Overcoats & long coats`,
            },
          },
        ];

  for (const { pattern, mapping } of coatKeywords) {
    if (pattern.test(text)) return mapping;
  }

  // Jackets
  const jacketKeywords: Array<{ pattern: RegExp; mapping: CategoryMapping }> =
    gender === 'men'
      ? [
          {
            pattern: /\bbiker\b|\bracer\b|\bmoto\b/,
            mapping: {
              vintedCatalogId: 2534,
              vintedLabel: `${base} > Jackets > Biker & racer jackets`,
            },
          },
          {
            pattern: /\bbomber\b/,
            mapping: { vintedCatalogId: 1223, vintedLabel: `${base} > Jackets > Bomber jackets` },
          },
          {
            pattern: /\bdenim jacket\b|\bjean jacket\b/,
            mapping: { vintedCatalogId: 1224, vintedLabel: `${base} > Jackets > Denim jackets` },
          },
          {
            pattern: /\bfleece\b/,
            mapping: { vintedCatalogId: 1858, vintedLabel: `${base} > Jackets > Fleece jackets` },
          },
          {
            pattern: /\bharrington\b/,
            mapping: {
              vintedCatalogId: 1226,
              vintedLabel: `${base} > Jackets > Harrington jackets`,
            },
          },
          {
            pattern: /\bpuffer\b|\bpadded\b|\bdown jacket\b/,
            mapping: { vintedCatalogId: 2536, vintedLabel: `${base} > Jackets > Puffer jackets` },
          },
          {
            pattern: /\bquilted\b/,
            mapping: { vintedCatalogId: 2537, vintedLabel: `${base} > Jackets > Quilted jackets` },
          },
          {
            pattern: /\bshacket\b|\bshirt jacket\b/,
            mapping: { vintedCatalogId: 2538, vintedLabel: `${base} > Jackets > Shackets` },
          },
          {
            pattern: /\bski\b|\bsnowboard\b/,
            mapping: {
              vintedCatalogId: 2539,
              vintedLabel: `${base} > Jackets > Ski & snowboard jackets`,
            },
          },
          {
            pattern: /\bvarsity\b|\bletterman\b/,
            mapping: { vintedCatalogId: 2550, vintedLabel: `${base} > Jackets > Varsity jackets` },
          },
          {
            pattern: /\bwindbreaker\b|\bwind\b/,
            mapping: { vintedCatalogId: 2551, vintedLabel: `${base} > Jackets > Windbreakers` },
          },
        ]
      : [
          {
            pattern: /\bbiker\b|\bracer\b|\bmoto\b/,
            mapping: {
              vintedCatalogId: 2527,
              vintedLabel: `${base} > Jackets > Biker & racer jackets`,
            },
          },
          {
            pattern: /\bbomber\b/,
            mapping: { vintedCatalogId: 1078, vintedLabel: `${base} > Jackets > Bomber jackets` },
          },
          {
            pattern: /\bdenim jacket\b|\bjean jacket\b/,
            mapping: { vintedCatalogId: 1079, vintedLabel: `${base} > Jackets > Denim jackets` },
          },
          {
            pattern: /\bfleece\b/,
            mapping: { vintedCatalogId: 1086, vintedLabel: `${base} > Jackets > Fleece jackets` },
          },
          {
            pattern: /\bpuffer\b|\bpadded\b|\bdown jacket\b/,
            mapping: { vintedCatalogId: 2614, vintedLabel: `${base} > Jackets > Puffer jackets` },
          },
          {
            pattern: /\bquilted\b/,
            mapping: { vintedCatalogId: 2596, vintedLabel: `${base} > Jackets > Quilted jackets` },
          },
          {
            pattern: /\bshacket\b|\bshirt jacket\b/,
            mapping: { vintedCatalogId: 2529, vintedLabel: `${base} > Jackets > Shackets` },
          },
          {
            pattern: /\bski\b|\bsnowboard\b/,
            mapping: {
              vintedCatalogId: 2530,
              vintedLabel: `${base} > Jackets > Ski & snowboard jackets`,
            },
          },
          {
            pattern: /\bvarsity\b|\bletterman\b/,
            mapping: { vintedCatalogId: 2531, vintedLabel: `${base} > Jackets > Varsity jackets` },
          },
          {
            pattern: /\bwindbreaker\b|\bwind\b/,
            mapping: { vintedCatalogId: 2532, vintedLabel: `${base} > Jackets > Windbreakers` },
          },
        ];

  for (const { pattern, mapping } of jacketKeywords) {
    if (pattern.test(text)) return mapping;
  }

  // Poncho
  if (/\bponchos?\b|\bcapes?\b/.test(text)) {
    return gender === 'men'
      ? { vintedCatalogId: 2552, vintedLabel: `${base} > Ponchos` }
      : { vintedCatalogId: 1773, vintedLabel: `${base} > Capes & ponchos` };
  }

  // Gilet
  if (/\bgilets?\b|\bbody warmers?\b/.test(text)) {
    return gender === 'men'
      ? { vintedCatalogId: 2553, vintedLabel: `${base} > Gilets & body warmers` }
      : { vintedCatalogId: 2524, vintedLabel: `${base} > Gilets & body warmers` };
  }

  // "coat" generic → Overcoats & long coats (most generic coat leaf)
  if (/\bcoats?\b/.test(text)) {
    return gender === 'men'
      ? { vintedCatalogId: 2533, vintedLabel: `${base} > Coats > Overcoats & long coats` }
      : { vintedCatalogId: 2526, vintedLabel: `${base} > Coats > Overcoats & long coats` };
  }

  // Default: Field & utility jackets (most generic jacket leaf)
  return gender === 'men'
    ? { vintedCatalogId: 2535, vintedLabel: `${base} > Jackets > Field & utility jackets` }
    : { vintedCatalogId: 2528, vintedLabel: `${base} > Jackets > Field & utility jackets` };
}

/**
 * Refine jeans category based on title/description keywords.
 * Men's Jeans (257) has subtypes: Ripped, Skinny, Slim fit, Straight fit (no "Other").
 */
export function refineJeansCategory(title: string, description: string): CategoryMapping {
  const text = `${title} ${description}`.toLowerCase();
  const base = 'Men > Clothing > Jeans';

  if (/\bripped\b|\bdistressed\b/.test(text)) {
    return { vintedCatalogId: 1816, vintedLabel: `${base} > Ripped jeans` };
  }
  if (/\bskinny\b|\bsuper slim\b/.test(text)) {
    return { vintedCatalogId: 1817, vintedLabel: `${base} > Skinny jeans` };
  }
  if (/\bstraight\b|\bregular\b|\brelaxed\b|\bloose\b|\bwide\b|\bbaggy\b/.test(text)) {
    return { vintedCatalogId: 1819, vintedLabel: `${base} > Straight fit jeans` };
  }
  // Default to Slim fit (most common/generic)
  return { vintedCatalogId: 1818, vintedLabel: `${base} > Slim fit jeans` };
}

/**
 * Refine women's swimwear based on title/description keywords.
 */
export function refineSwimwearCategory(title: string, description: string): CategoryMapping {
  const text = `${title} ${description}`.toLowerCase();
  const base = 'Women > Clothing > Swimwear';

  if (/\bone.?pieces?\b|\bswimsuits?\b/.test(text)) {
    return { vintedCatalogId: 218, vintedLabel: `${base} > One-pieces` };
  }
  if (/\bbikinis?\b|\btankinis?\b/.test(text)) {
    return { vintedCatalogId: 219, vintedLabel: `${base} > Bikinis & tankinis` };
  }
  if (/\bcover.?ups?\b|\bsarongs?\b/.test(text)) {
    return { vintedCatalogId: 1780, vintedLabel: `${base} > Cover-ups & sarongs` };
  }
  return { vintedCatalogId: 220, vintedLabel: `${base} > Other swimwear & beachwear` };
}

/**
 * Refine generic shoes category based on title/description keywords.
 */
export function refineShoesCategory(
  title: string,
  description: string,
  gender: 'men' | 'women',
): CategoryMapping {
  const text = `${title} ${description}`.toLowerCase();

  if (gender === 'men') {
    const base = 'Men > Shoes';
    if (/\btrainers?\b|\bsneakers?\b/.test(text))
      return { vintedCatalogId: 1242, vintedLabel: `${base} > Trainers` };
    if (/\bboots?\b/.test(text))
      return { vintedCatalogId: 2662, vintedLabel: `${base} > Boots > Desert & lace-up boots` };
    if (/\bsandals?\b/.test(text))
      return { vintedCatalogId: 2968, vintedLabel: `${base} > Sandals` };
    if (/\bslides?\b|\bflip.?flops?\b/.test(text))
      return { vintedCatalogId: 2969, vintedLabel: `${base} > Flip-flops & slides` };
    if (/\bloafers?\b|\bmoccasins?\b|\bboat shoes?\b/.test(text))
      return { vintedCatalogId: 2656, vintedLabel: `${base} > Boat shoes, loafers & moccasins` };
    if (/\bformal\b|\boxfords?\b|\bderb(y|ies)\b|\bdress shoes?\b/.test(text))
      return { vintedCatalogId: 1238, vintedLabel: `${base} > Formal shoes` };
    if (/\bslippers?\b/.test(text))
      return { vintedCatalogId: 2659, vintedLabel: `${base} > Slippers` };
    if (/\bespadrilles?\b/.test(text))
      return { vintedCatalogId: 2657, vintedLabel: `${base} > Espadrilles` };
    return { vintedCatalogId: 1242, vintedLabel: `${base} > Trainers` };
  }

  const base = 'Women > Shoes';
  if (/\btrainers?\b|\bsneakers?\b/.test(text))
    return { vintedCatalogId: 2632, vintedLabel: `${base} > Trainers` };
  if (/\bboots?\b/.test(text))
    return { vintedCatalogId: 2618, vintedLabel: `${base} > Boots > Ankle boots` };
  if (/\bheels?\b|\bstilettos?\b|\bpumps?\b/.test(text))
    return { vintedCatalogId: 543, vintedLabel: `${base} > Heels` };
  if (/\bsandals?\b/.test(text)) return { vintedCatalogId: 2949, vintedLabel: `${base} > Sandals` };
  if (/\bslides?\b|\bflip.?flops?\b/.test(text))
    return { vintedCatalogId: 2952, vintedLabel: `${base} > Flip-flops & slides` };
  if (/\bloafers?\b|\bmoccasins?\b|\bboat shoes?\b/.test(text))
    return { vintedCatalogId: 2954, vintedLabel: `${base} > Boat shoes, loafers & moccasins` };
  if (/\bballerinas?\b|\bballet\b/.test(text))
    return { vintedCatalogId: 2955, vintedLabel: `${base} > Ballerinas` };
  if (/\bmary janes?\b/.test(text))
    return { vintedCatalogId: 2950, vintedLabel: `${base} > Mary Janes & T-bar shoes` };
  if (/\bclogs?\b|\bmules?\b/.test(text))
    return { vintedCatalogId: 2623, vintedLabel: `${base} > Clogs & mules` };
  if (/\bslippers?\b/.test(text))
    return { vintedCatalogId: 215, vintedLabel: `${base} > Slippers` };
  if (/\bespadrilles?\b/.test(text))
    return { vintedCatalogId: 2953, vintedLabel: `${base} > Espadrilles` };
  if (/\blace.?ups?\b/.test(text))
    return { vintedCatalogId: 2951, vintedLabel: `${base} > Lace-up shoes` };
  return { vintedCatalogId: 2632, vintedLabel: `${base} > Trainers` };
}

/**
 * Refine T-shirt category based on title/description keywords.
 * Men's T-shirts (77) and Women's T-shirts (221) have subtypes on Vinted.
 */
export function refineTshirtCategory(
  title: string,
  description: string,
  gender: 'men' | 'women',
): CategoryMapping {
  const text = `${title} ${description}`.toLowerCase();
  const base =
    gender === 'men'
      ? 'Men > Clothing > Tops & t-shirts > T-shirts'
      : 'Women > Clothing > Tops & t-shirts';

  if (gender === 'men') {
    // Men's T-shirts subtypes
    if (/\bpolos?\b/.test(text)) {
      return { vintedCatalogId: 1809, vintedLabel: `${base} > Polo shirts` };
    }
    if (/\blong.?sleeve|longsleeve/i.test(text)) {
      return { vintedCatalogId: 1810, vintedLabel: `${base} > Long-sleeved t-shirts` };
    }
    if (/\bstripe[ds]?\b/.test(text)) {
      return { vintedCatalogId: 1808, vintedLabel: `${base} > Striped t-shirts` };
    }
    if (/\bprints?\b|\bgraphics?\b|\blogos?\b|\bband tees?\b/.test(text)) {
      return { vintedCatalogId: 1807, vintedLabel: `${base} > Print t-shirts` };
    }
    if (/\bplain\b|\bbasic\b|\bsolid\b|\bblank\b/.test(text)) {
      return { vintedCatalogId: 1806, vintedLabel: `${base} > Plain t-shirts` };
    }
    // Default to Other t-shirts
    return { vintedCatalogId: 1868, vintedLabel: `${base} > Other t-shirts` };
  }

  // Women's T-shirts — flat subtypes under Tops & t-shirts (no T-shirts sub-level)
  // Just return T-shirts directly since women's is a direct child
  return { vintedCatalogId: 221, vintedLabel: `${base} > T-shirts` };
}
