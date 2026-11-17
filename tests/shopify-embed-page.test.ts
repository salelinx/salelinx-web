// The Shopify app's page (app/embed/shopify/route.ts) is one HTML string with its script inline, so
// nothing else would notice a script that no longer parses, or a string it reads that a locale
// lacks. This renders it in every locale and checks both.

import { describe, expect, it } from 'vitest';
import { GET } from '@/app/embed/shopify/route';

const LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'zh'];

async function render(locale: string) {
  const res = GET(
    new Request(`https://salelinx.com/embed/shopify?shop=my-shop.myshopify.com&locale=${locale}`),
  );
  return res.text();
}

/** The page's own script: the inline one, not Shopify's from its CDN. */
function pageScript(html: string): string {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(scripts).toHaveLength(1);
  return scripts[0];
}

describe("the Shopify app's page", () => {
  it.each(LOCALES)('has a script that parses (%s)', async (locale) => {
    const script = pageScript(await render(locale));
    expect(() => new Function(script)).not.toThrow();
  });

  it.each(LOCALES)('has every string its script reads (%s)', async (locale) => {
    const script = pageScript(await render(locale));
    const strings = JSON.parse(script.match(/const S = (\{[\s\S]*?\});\n/)![1]);
    const used = new Set([...script.matchAll(/\bS\.(\w+)/g)].map((m) => m[1]));
    const missing = [...used].filter((k) => typeof strings[k] !== 'string');
    expect(missing).toEqual([]);
  });
});
