import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno Edge Functions: they run on Supabase under Deno (https:// / jsr:
    // imports, Deno.* globals, @ts-nocheck for the Deno TS config), not Node,
    // and are already excluded from tsc. The Next/Node ESLint ruleset does not
    // apply to them. Use the Deno VSCode extension for inline checking there.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
