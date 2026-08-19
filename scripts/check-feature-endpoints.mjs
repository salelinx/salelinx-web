// Validates lib/admin/feature-endpoints.ts against the shape that
// normalizeEndpointKey (extension repo) actually produces.
//
// This map is hand-maintained and its failure mode is SILENT: a typo in a
// pattern does not error, the feature just reports "no data" forever while
// looking like a legitimate quiet period. Nobody would notice until they needed
// the status view during an incident.
//
// Runs from prebuild alongside the docs index, so a bad pattern fails the build
// instead of shipping.

import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "lib", "admin", "feature-endpoints.ts");
const source = fs.readFileSync(file, "utf8");

// Pull the string literals out of each endpoints: [...] block. Parsing the TS
// properly would mean pulling in a compiler; the file is a plain literal array
// and this script fails loudly if that ever stops being true.
const blocks = [...source.matchAll(/key:\s*"([^"]+)"[\s\S]*?endpoints:\s*\[([\s\S]*?)\]/g)];

if (blocks.length === 0) {
  console.error(
    "check-feature-endpoints: parsed 0 features from feature-endpoints.ts.\n" +
      "The file shape probably changed - update this script rather than deleting it.",
  );
  process.exit(1);
}

const METHOD_PATH = /^(GET|POST|PUT|DELETE|PATCH) \//;
const problems = [];
const seenKeys = new Set();

for (const [, key, body] of blocks) {
  if (seenKeys.has(key)) problems.push(`duplicate feature key "${key}"`);
  seenKeys.add(key);

  const endpoints = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (endpoints.length === 0) problems.push(`"${key}" lists no endpoints`);

  for (const endpoint of endpoints) {
    if (!METHOD_PATH.test(endpoint)) {
      problems.push(`"${key}": "${endpoint}" is not METHOD /path`);
    }
    if (endpoint.startsWith("depop:") || endpoint.startsWith("vinted:")) {
      problems.push(`"${key}": "${endpoint}" must not carry a platform prefix`);
    }
    if (endpoint.includes("?")) {
      // The normaliser strips query strings, so a pattern carrying one can
      // never match.
      problems.push(`"${key}": "${endpoint}" contains a query string`);
    }
    if (/\/\d+(\/|$)/.test(endpoint)) {
      // A concrete id matches one user's traffic and nothing else.
      problems.push(`"${key}": "${endpoint}" has a literal id, use :id`);
    }
  }
}

if (problems.length > 0) {
  console.error("check-feature-endpoints: invalid feature endpoint map\n");
  for (const problem of problems) console.error("  - " + problem);
  console.error(
    "\nThese patterns can never match a real endpoint key, so the feature would\n" +
      "silently show 'no data'. See lib/admin/feature-endpoints.ts.",
  );
  process.exit(1);
}

console.log(
  `check-feature-endpoints: ${blocks.length} features, ` +
    `${[...source.matchAll(/"(GET|POST|PUT|DELETE|PATCH) \//g)].length} endpoint patterns OK`,
);
