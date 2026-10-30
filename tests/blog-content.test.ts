import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static checks over content/blog/. The MDX modules themselves cannot load
// under plain vitest (no MDX loader), so this reads the sources as text, the
// same way scripts/build-docs-index.mjs parses docs metadata.

const ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'content', 'blog', 'en');
const MANIFEST = readFileSync(path.join(ROOT, 'lib', 'blog', 'posts.ts'), 'utf8');
const CATEGORIES = ['guides'];
const WORDS_PER_MINUTE = 220;

const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));

function parse(source: string) {
  const match = source.match(/export\s+const\s+metadata\s*=\s*(\{[\s\S]*?\n\});/);
  if (!match) throw new Error('no `export const metadata = {...};` block');
  const block = match[1];
  const pick = (key: string) => {
    const m = block.match(new RegExp(`\\b${key}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|(\\d+))`));
    return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
  };
  return {
    meta: {
      title: pick('title'),
      description: pick('description'),
      slug: pick('slug'),
      category: pick('category'),
      published: pick('published'),
      updated: pick('updated'),
      readingMinutes: Number(pick('readingMinutes')),
    },
    body: source.slice((match.index ?? 0) + match[0].length),
  };
}

function readingMinutes(body: string): number {
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const words = text.match(/[A-Za-z0-9£%][\w'£%.,-]*/g) ?? [];
  return Math.max(1, Math.round(words.length / WORDS_PER_MINUTE));
}

describe('blog posts', () => {
  it('has at least one post', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('only links feature pages to guides that exist', () => {
    const landing = readFileSync(path.join(ROOT, 'lib', 'landing', 'pages.ts'), 'utf8');
    const slugs = [...landing.matchAll(/guides: \[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/'([^']+)'/g)].map((s) => s[1]),
    );
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(files).toContain(`${slug}.mdx`);
  });

  for (const file of files) {
    describe(file, () => {
      const source = readFileSync(path.join(BLOG_DIR, file), 'utf8');
      const { meta, body } = parse(source);

      it('is registered in lib/blog/posts.ts', () => {
        expect(MANIFEST).toContain(`@/content/blog/en/${file}`);
      });

      it('has complete metadata', () => {
        expect(meta.slug).toBe(file.replace(/\.mdx$/, ''));
        expect(CATEGORIES).toContain(meta.category);
        expect(meta.title?.length ?? 0).toBeGreaterThan(10);
        // Longer titles get cut off in search results.
        expect(meta.title!.length).toBeLessThanOrEqual(65);
        expect(meta.description?.length ?? 0).toBeGreaterThanOrEqual(70);
        expect(meta.description!.length).toBeLessThanOrEqual(170);
        expect(meta.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(meta.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(meta.updated! >= meta.published!).toBe(true);
      });

      it('states a reading time that matches the body', () => {
        expect(meta.readingMinutes).toBe(readingMinutes(body));
      });

      it('has no em or en dashes', () => {
        // House style (CLAUDE.md "Writing style"), entities included.
        expect(source).not.toMatch(/[–—]|&mdash;|&ndash;/);
      });

      it('has a cover for the index card', () => {
        expect(existsSync(path.join(ROOT, 'public', 'blog', 'covers', file.replace(/\.mdx$/, '.svg')))).toBe(true);
      });

      it('leaves the h1 to the page', () => {
        // The post page renders metadata.title as the h1.
        expect(body).not.toMatch(/^# /m);
      });
    });
  }
});
