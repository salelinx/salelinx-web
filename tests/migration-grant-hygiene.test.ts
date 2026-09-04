import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// CREATE [OR REPLACE] FUNCTION grants EXECUTE to PUBLIC by default, so every
// function created in a migration must be paired with an explicit
// REVOKE ... ON FUNCTION (re-granting to specific roles where intended). This
// was missed by hand twice in the pre-squash chain (029's trigger guard and
// apply_storage_delta, both fixed in 040); this test closes the class instead
// of relying on reviewers remembering the CLAUDE.md gotcha.
//
// The revoke may live in a LATER migration than the CREATE, so creations are
// checked per file but revokes are collected from all of them.

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

// Deliberately callable by everyone; documented in its migration file.
// platform_account_hash is not SECURITY DEFINER and discloses nothing on its
// own (the original 024 sweep left it alone on purpose).
const EXEMPT = new Set(["platform_account_hash"]);

const CREATE_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi;
const REVOKE_RE = /REVOKE[\s\S]{0,200}?ON\s+FUNCTION\s+public\.([a-z0-9_]+)/gi;

function sqlMigrations(): { name: string; content: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({
      name,
      content: readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"),
    }));
}

describe("migration function grant hygiene", () => {
  const files = sqlMigrations();

  const revokedFunctions = new Set<string>();
  for (const file of files) {
    for (const match of file.content.matchAll(REVOKE_RE)) {
      revokedFunctions.add(match[1].toLowerCase());
    }
  }

  it("found the migrations directory", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const created = [...file.content.matchAll(CREATE_RE)]
      .map((m) => m[1].toLowerCase())
      .filter((fn) => !EXEMPT.has(fn));
    if (created.length === 0) continue;

    it(`${file.name}: every created function has a REVOKE somewhere`, () => {
      const unrevoked = created.filter((fn) => !revokedFunctions.has(fn));
      expect(
        unrevoked,
        `CREATE [OR REPLACE] FUNCTION grants EXECUTE to PUBLIC by default. ` +
          `Add "REVOKE EXECUTE ON FUNCTION public.<name>(...) FROM PUBLIC, anon, authenticated;" ` +
          `(then GRANT to the roles that need it) for: ${unrevoked.join(", ")}`,
      ).toEqual([]);
    });
  }
});
