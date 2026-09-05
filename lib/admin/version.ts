// Extension version comparison for the admin console.
//
// Versions reach us self-reported through the device_sessions heartbeat
// (migration 041), so treat them as display data: never gate an action on the
// result, only tint a cell. A modified client can report any string.
//
// Mirrors compareVersions in the extension's src/utils/updates.ts. Kept as a
// separate copy rather than shared because the two repos have no shared
// package, the same way lib/types/tiers.ts is duplicated. If the extension's
// rules change, change both.

/**
 * Numeric semver-ish compare. Returns >0 if a > b, <0 if a < b, 0 if equal.
 * Handles 4-part manifest versions (legal in Chrome). Non-numeric segments
 * fall back to a string compare so a malformed report cannot throw.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? "0", 10);
    const nb = parseInt(pb[i] ?? "0", 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const sa = pa[i] ?? "";
      const sb = pb[i] ?? "";
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      continue;
    }
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Highest version present in a set of reported versions, or null when nothing
 * has reported one.
 *
 * This is the newest version we have OBSERVED, not the newest published. It is
 * the honest ceiling to compare a roster against: the admin console has no
 * feed of what the Web Store has live, and an install that has not heartbeated
 * since publishing day would otherwise make everyone look current.
 */
export function highestVersion(versions: (string | null)[]): string | null {
  let best: string | null = null;
  for (const v of versions) {
    if (!v) continue;
    if (best === null || compareVersions(v, best) > 0) best = v;
  }
  return best;
}
