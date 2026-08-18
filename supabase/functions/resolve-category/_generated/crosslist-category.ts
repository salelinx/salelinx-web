// GENERATED FILE - DO NOT EDIT.
//
// Synced from the extension repo by scripts/sync-category-maps.mjs.
// Edit the source there (and its tests), then re-run the sync and redeploy.

// Category-mapping types shared by the crosslist features, the mapping tables
// in src/data/, and the resolve-category edge function.
//
// The mapping tables themselves are NOT bundled into the extension: nothing
// under src/ imports them at runtime, so webpack never reaches them from an
// entry point. They are synced into the website repo's edge function by
// scripts/sync-category-maps.mjs and resolved server-side. See
// docs/technical/CROSSLISTING.md.
//
// This file is part of the synced set, so it must stay dependency-free and
// contain types only.

/** Depop category resolved to its Vinted equivalent. */
export interface CategoryMapping {
  vintedCatalogId: number;
  vintedLabel: string;
}

/** Vinted catalog resolved to its Depop equivalent. */
export interface DepopCategoryMapping {
  depopCategoryId: number;
  depopLabel: string;
}

/**
 * Depop draft category tuple: [productType, department]. Feeds the Depop
 * draft builder's productType slug.
 */
export type DepopDraftCategory = [string, string];

/**
 * Depop -> Vinted resolution request.
 *
 * `isKids` is computed client-side from the raw listing payload (the Depop
 * API exposes it under three different keys) so the raw payload never leaves
 * the browser. The server still applies its own category-id based kids check
 * on top of this hint.
 */
export interface DepopToVintedRequest {
  categoryId: number | null;
  title: string;
  description: string;
  isKids: boolean;
}

export interface DepopToVintedResult {
  mapping: CategoryMapping | null;
  warnings: string[];
}

/** One entry in a batch resolve call. `id` is echoed back so results can be paired up. */
export interface CategoryResolveItem {
  id: string;
  direction: 'depopToVinted' | 'vintedToDepop' | 'depopDraft' | 'depopProductType';
  depopToVinted?: DepopToVintedRequest;
  /** Vinted catalog_id, for direction 'vintedToDepop'. */
  catalogId?: number;
  /** Depop legacy category id, for direction 'depopDraft'. */
  depopCategoryId?: number;
  /** Listing wording, for direction 'depopProductType'. */
  text?: { title: string; description: string };
}

export interface CategoryResolveResult {
  id: string;
  depopToVinted?: DepopToVintedResult;
  vintedToDepop?: DepopCategoryMapping | null;
  depopDraft?: DepopDraftCategory | null;
  depopProductType?: string | null;
  /** Set when this one item failed while others in the batch succeeded. */
  error?: string;
}

export interface CategoryResolveResponse {
  results: CategoryResolveResult[];
}
