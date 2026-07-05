import type { TierConfig } from "@/lib/types/tiers";

// Shared helpers for the tier edit modules (Tier limits + Feature flags).
// Both render a keys-by-tiers grid over the active tier_limits rows, so the
// column ordering and key collection live here once.

// Canonical column order for the standard tiers. Custom/bespoke tier ids
// (e.g. pro_custom_acme, see docs/ENTITLEMENTS.md) sort after these,
// alphabetically.
const TIER_ORDER = ["free", "starter", "pro", "business"];

export function sortTierConfigs(tiers: TierConfig[]): TierConfig[] {
  return [...tiers].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(a.tier_id);
    const bi = TIER_ORDER.indexOf(b.tier_id);
    if (ai !== bi) {
      // Known tiers in canonical order; unknown (custom) tiers after them.
      return (ai === -1 ? TIER_ORDER.length : ai) -
        (bi === -1 ? TIER_ORDER.length : bi);
    }
    if (a.tier_id !== b.tier_id) return a.tier_id.localeCompare(b.tier_id);
    return a.version - b.version;
  });
}

// Union of the keys of one jsonb column (features or limits) across all rows,
// sorted, so the grid shows every key even when a tier's row lacks some.
export function collectKeys(
  tiers: TierConfig[],
  column: "features" | "limits",
): string[] {
  const keys = new Set<string>();
  for (const t of tiers) {
    for (const k of Object.keys(t[column])) keys.add(k);
  }
  return Array.from(keys).sort();
}

// Stable identifier for a (tier_id, version) column in the grid UIs.
export function tierKey(t: TierConfig): string {
  return `${t.tier_id}:v${t.version}`;
}
