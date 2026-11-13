// Writes supabase/functions/_shared/_generated/shopify-extended-attributes.ts: each extended
// attribute's metafield key, and the base attribute whose values it takes.
//
// Shopify's taxonomy gives some categories their own copy of a base attribute under another
// name: Handbags' "Bag/Case closure" is "Bag closure", Watches' "Band color" is "Color". The Admin
// API lists a category's attributes by their base name, while the category's metafield templates
// carry the extended name and key, so the function can't pair the two by name. Shopify publishes
// the link in its taxonomy data, read here from the release matching the function's API version.
//
// Run with `node scripts/build-shopify-extended-attributes.mjs`, again whenever the shopify
// function moves to a newer Admin API version (change TAXONOMY_VERSION to match).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TAXONOMY_VERSION = 'v2026-10';
const SOURCE = `https://raw.githubusercontent.com/Shopify/product-taxonomy/${TAXONOMY_VERSION}/dist/en/categories.json`;
const OUT = path.join(
  process.cwd(),
  'supabase',
  'functions',
  '_shared',
  '_generated',
  'shopify-extended-attributes.ts',
);

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Could not read ${SOURCE}: ${res.status}`);
const taxonomy = await res.json();

/** Extended key -> base attribute id; one base each, or the data has changed shape. */
const base = new Map();
for (const vertical of taxonomy.verticals) {
  for (const category of vertical.categories) {
    for (const a of category.attributes ?? []) {
      if (!a.extended) continue;
      const was = base.get(a.handle);
      if (was && was !== a.id) throw new Error(`${a.handle} extends both ${was} and ${a.id}`);
      base.set(a.handle, a.id);
    }
  }
}
if (base.size === 0) throw new Error('No extended attributes found: has the data changed shape?');

const lines = [...base]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, id]) => `  '${key}': '${id}',`);

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `// GENERATED FILE - DO NOT EDIT.
//
// Made by scripts/build-shopify-extended-attributes.mjs from Shopify's product taxonomy
// ${TAXONOMY_VERSION} (github.com/Shopify/product-taxonomy, dist/en/categories.json). Run it again
// when the shopify function moves to a newer Admin API version.

/** An extended attribute's metafield key, to the base attribute whose values it takes: the API
 *  lists a category's attribute by its base name ("Bag closure"), its template by the extended
 *  one ("Bag/Case closure", key bag-case-closure). */
export const EXTENDED_ATTRIBUTE_BASE: Record<string, string> = {
${lines.join('\n')}
};
`,
);
console.log(
  `${base.size} extended attributes from taxonomy ${TAXONOMY_VERSION} -> ${path.relative(process.cwd(), OUT)}`,
);
