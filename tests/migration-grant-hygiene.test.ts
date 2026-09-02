import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// CREATE [OR REPLACE] FUNCTION grants EXECUTE to PUBLIC by default, so every
// function created after the 024_function_grant_hygiene sweep must be paired
// with an explicit REVOKE ... ON FUNCTION (re-granting to specific roles where
// intended). This has been missed by hand twice (029's trigger guard, fixed in
// 040, and apply_storage_delta, open for a month before 040); this test closes
// the class instead of relying on reviewers remembering the CLAUDE.md gotcha.
//
// The revoke may live in a LATER migration than the CREATE (029 -> 040), so
// creations are collected from migrations 025+ but revokes from all of them.

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
const CONVENTION_STARTS_AT = 25; // 024 swept everything before it

const CREATE_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi;
const REVOKE_RE = /REVOKE[\s\S]{0,200}?ON\s+FUNCTION\s+public\.([a-z0-9_]+)/gi;

function sqlMigrations(): { name: string; content: string; seq: number | null }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => {
      const m = name.match(/^(\d{3})_/);
      return {
        name,
        content: readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"),
        seq: m ? Number(m[1]) : null,
      };
    });
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
    expect(files.length).toBeGreaterThan(30);
  });

  for (const file of files) {
    if (file.seq === null || file.seq < CONVENTION_STARTS_AT) continue;
    const created = [...file.content.matchAll(CREATE_RE)].map((m) =>
      m[1].toLowerCase(),
    );
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
