import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'content', 'docs');
const OUT_DIR = path.join(ROOT, 'public', 'docs');
const OUT_FILE = path.join(OUT_DIR, 'search-index.json');

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out;
}

function parseMetadata(source) {
  const match = source.match(
    /export\s+const\s+metadata\s*=\s*(\{[\s\S]*?\n\});/,
  );
  if (!match) return null;
  const body = match[1];
  const pick = (key) => {
    const re = new RegExp(`${key}\\s*:\\s*(?:'([^']*)'|"([^"]*)")`);
    const m = body.match(re);
    return m ? (m[1] ?? m[2]) : undefined;
  };
  const pickArray = (key) => {
    const re = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`);
    const m = body.match(re);
    if (!m) return [];
    return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  };
  return {
    title: pick('title'),
    description: pick('description'),
    category: pick('category'),
    slug: pick('slug'),
    updated: pick('updated'),
    status: pick('status'),
    tags: pickArray('tags'),
    marketplaces: pickArray('marketplaces'),
  };
}

function extractExcerpt(source, metaEnd) {
  const body = source.slice(metaEnd);
  const stripped = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 400);
}

async function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.warn(`[docs-index] no content dir at ${CONTENT_DIR}, skipping`);
    return;
  }

  const files = await walk(CONTENT_DIR);
  const records = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const meta = parseMetadata(source);
    if (!meta || !meta.title || !meta.category || !meta.slug) {
      console.warn(`[docs-index] skipping ${file}: missing metadata`);
      continue;
    }
    const match = source.match(
      /export\s+const\s+metadata\s*=\s*\{[\s\S]*?\n\};/,
    );
    const metaEnd = match ? (match.index ?? 0) + match[0].length : 0;
    const excerpt = extractExcerpt(source, metaEnd);
    records.push({
      title: meta.title,
      description: meta.description ?? '',
      category: meta.category,
      slug: meta.slug,
      url: `/docs/${meta.category}/${meta.slug}`,
      updated: meta.updated ?? '',
      status: meta.status ?? 'published',
      tags: meta.tags,
      marketplaces: meta.marketplaces,
      excerpt,
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify({ records }, null, 2), 'utf8');
  console.log(`[docs-index] wrote ${records.length} records to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
