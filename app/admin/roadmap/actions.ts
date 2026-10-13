"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { ROADMAP_CACHE_TAG } from "@/lib/roadmap/data";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";

// Server actions behind /admin/roadmap.
//
// All three go through the is_admin()-gated RPCs from 032_roadmap_items.sql,
// which are the real boundary (the web app never holds the service-role key)
// and which write their own audit entries. These wrappers exist to marshal
// arguments and revalidate, not to enforce anything.

export type RoadmapResult = { ok: boolean; error?: string };

export type RoadmapDraft = Pick<
  RoadmapItem,
  | "id"
  | "status"
  | "tag"
  | "marketplaces"
  | "title"
  | "description"
  | "target_quarter"
  | "shipped_month"
  | "visible"
>;

async function run(
  fn: string,
  args: Record<string, unknown>,
): Promise<RoadmapResult> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc(fn, args);

  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? "failed" };

  // The homepage reads through unstable_cache under this tag; expiring it
  // means the next visit fetches fresh rows instead of waiting out the 60s
  // TTL. The page path is revalidated too, since the homepage is itself ISR.
  revalidateTag(ROADMAP_CACHE_TAG, { expire: 0 });
  revalidatePath("/[locale]", "page");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function saveRoadmapItem(
  draft: RoadmapDraft,
  isNew: boolean,
): Promise<RoadmapResult> {
  return run("admin_save_roadmap_item", {
    p_id: draft.id,
    p_is_new: isNew,
    p_status: draft.status,
    p_tag: draft.tag,
    p_marketplaces: draft.marketplaces,
    p_title: draft.title,
    p_description: draft.description,
    p_target_quarter: draft.target_quarter,
    p_shipped_month: draft.shipped_month,
    p_visible: draft.visible,
  });
}

export async function deleteRoadmapItem(id: string): Promise<RoadmapResult> {
  return run("admin_delete_roadmap_item", { p_id: id });
}

export async function reorderRoadmapItems(
  status: RoadmapStatus,
  ids: string[],
): Promise<RoadmapResult> {
  return run("admin_reorder_roadmap_items", { p_status: status, p_ids: ids });
}
