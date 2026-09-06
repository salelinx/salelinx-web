// The proxy matcher decides which paths run intlMiddleware. Anything served
// from OUTSIDE the [locale] tree must be excluded, or intlMiddleware rewrites
// it into [locale]/[...rest] and it 404s as an HTML error page.
//
// This has now bitten twice: first robots.txt / sitemap.xml, then
// /api/health/supabase, which 404'd in production the moment it shipped. A
// `next build` does not catch it — the route compiles and registers fine, and
// the rewrite only happens at request time. Hence a unit test.
//
// The pattern is read out of proxy.ts as TEXT rather than imported. Two
// reasons, and the ugliness is deliberate:
//   1. Importing proxy.ts pulls in next-intl -> next/server, which does not
//      resolve in this node test environment.
//   2. Extracting the pattern into a shared module would be tidier, but Next
//      requires `export const config` in a middleware file to be statically
//      analyzable. A pattern imported from elsewhere risks Next silently not
//      applying the matcher at all — a far worse failure than an awkward test.
// So the literal stays put, and the test asserts against the shipped source.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

/** Pull the matcher string literal out of `export const config`. */
function readMatcherPattern(): string {
  const found = source.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/);
  if (!found) throw new Error("could not find the matcher literal in proxy.ts");
  // JSON.parse turns the source-level escaping (\\.) into the real string (\.).
  return JSON.parse(found[1]) as string;
}

const matcher = new RegExp(`^${readMatcherPattern()}$`);

/** True when the middleware (and so intlMiddleware) runs for this path. */
const runsMiddleware = (pathname: string): boolean => matcher.test(pathname);

describe("proxy matcher", () => {
  it("skips API route handlers", () => {
    // The regression this test exists for. /api lives outside [locale].
    expect(runsMiddleware("/api/health/supabase")).toBe(false);
    expect(runsMiddleware("/api/anything/nested/deeper")).toBe(false);
  });

  it("still skips the paths that were excluded before", () => {
    expect(runsMiddleware("/robots.txt")).toBe(false);
    expect(runsMiddleware("/sitemap.xml")).toBe(false);
    expect(runsMiddleware("/favicon.ico")).toBe(false);
    expect(runsMiddleware("/_next/static/chunks/main.js")).toBe(false);
    expect(runsMiddleware("/_next/image")).toBe(false);
    expect(runsMiddleware("/docs/search-index.en.json")).toBe(false);
    expect(runsMiddleware("/logo.svg")).toBe(false);
  });

  it("still runs for real pages, which need the locale and the cookie refresh", () => {
    expect(runsMiddleware("/")).toBe(true);
    expect(runsMiddleware("/en/pricing")).toBe(true);
    expect(runsMiddleware("/account")).toBe(true);
    expect(runsMiddleware("/admin/users")).toBe(true);
  });

  it("still runs for the non-locale handlers that need the cookie refresh", () => {
    // These are excluded from intlMiddleware inside the proxy function via
    // `skipIntl`, NOT here — they still need Supabase cookie handling, so they
    // must keep matching. Excluding them here instead would break login.
    expect(runsMiddleware("/auth/callback")).toBe(true);
    expect(runsMiddleware("/auth/signout")).toBe(true);
    expect(runsMiddleware("/r/abc123")).toBe(true);
  });

  it("does not exclude paths that merely start with the letters 'api'", () => {
    // The exclusion is the segment `api`, not a prefix match — a marketing
    // page at /api-docs must still be localized.
    expect(runsMiddleware("/api-docs")).toBe(true);
  });
});
