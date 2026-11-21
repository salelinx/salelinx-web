"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { cleanTags, type SocialTags } from "@/lib/social/tags";
import type { SocialPlatform } from "@/lib/social/types";

// Server actions behind the Planner. Every write goes
// through an is_admin()-gated RPC from 052_social.sql, which is the real
// boundary and writes its own audit entry; these wrappers only marshal and
// revalidate. Deleting a post's files runs as the admin too, under the
// social-media bucket's admin-only policies.

export type SocialResult = { ok: boolean; error?: string; id?: string };

async function run(fn: string, args: Record<string, unknown>) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { supabase, result: { ok: false, error: error.message } as SocialResult & Record<string, unknown> };
  const result = (data ?? {}) as SocialResult & Record<string, unknown>;
  if (!result.ok) return { supabase, result: { ...result, ok: false, error: result.error ?? "failed" } };
  return { supabase, result };
}

const refresh = () => {
  revalidatePath("/admin/marketing/planner");
};

export type PostDraft = {
  id: string | null;
  name: string;
  media_path: string | null;
  media_bytes: number | null;
  media_type: string | null;
  cover_path: string | null;
  schedule: boolean;
  scheduled_at: string | null;
  notes: string | null;
  targets: {
    platform: SocialPlatform;
    title: string;
    caption: string;
    options: Record<string, unknown>;
  }[];
};

export async function saveSocialPost(draft: PostDraft): Promise<SocialResult> {
  const { result } = await run("admin_save_social_post", {
    p_id: draft.id,
    p_name: draft.name.trim() || "Untitled post",
    p_media_path: draft.media_path,
    p_media_bytes: draft.media_bytes,
    p_media_type: draft.media_type,
    p_cover_path: draft.cover_path,
    p_schedule: draft.schedule,
    p_scheduled_at: draft.scheduled_at,
    p_experiment_id: null,
    p_variant: null,
    p_notes: draft.notes?.trim() || null,
    p_targets: draft.targets,
  });
  refresh();
  return { ok: result.ok, error: result.error, id: result.id as string | undefined };
}

export async function deleteSocialPost(id: string): Promise<SocialResult> {
  const { supabase, result } = await run("admin_delete_social_post", { p_id: id });
  if (result.ok) {
    const orphans = (result.orphaned_files as string[] | undefined) ?? [];
    if (orphans.length) {
      const { error } = await supabase.storage.from("social-media").remove(orphans);
      // The post is gone either way; a file left behind only costs storage.
      if (error) console.error("[social] file cleanup failed:", error.message);
    }
  }
  refresh();
  return { ok: result.ok, error: result.error };
}

/** Removes an uploaded file that no saved post points at (a replaced or abandoned upload). */
export async function discardSocialUpload(path: string): Promise<SocialResult> {
  if (!/^(videos|covers)\/[\w.-]+$/.test(path)) return { ok: false, error: "bad_path" };
  const supabase = await createServerClient();
  const { count, error: countErr } = await supabase
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .or(`media_path.eq."${path}",cover_path.eq."${path}"`);
  if (countErr) return { ok: false, error: countErr.message };
  if (count) return { ok: true };
  const { error } = await supabase.storage.from("social-media").remove([path]);
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("log_admin_action", {
    p_action: "social.upload_discard",
    p_target_table: "storage.objects",
    p_target_id: `social-media/${path}`,
  });
  return { ok: true };
}

export async function retrySocialTarget(
  postId: string,
  platform: SocialPlatform,
): Promise<SocialResult> {
  const { result } = await run("admin_retry_social_target", {
    p_post_id: postId,
    p_platform: platform,
  });
  refresh();
  return { ok: result.ok, error: result.error };
}

/**
 * What is in a video (054_social_tags.sql): a planner post's tags, shared by
 * its platforms, or one lone video's. Allowed at any stage, posted or not.
 * mediaSeconds is the planner file's length, when the browser could read it.
 */
export async function setSocialTags(input: {
  postId: string | null;
  platform: SocialPlatform | null;
  externalId: string | null;
  tags: SocialTags;
  mediaSeconds?: number | null;
}): Promise<SocialResult> {
  if (!input.postId && !(input.platform && input.externalId)) return { ok: false, error: "nothing_to_tag" };
  const seconds =
    typeof input.mediaSeconds === "number" && Number.isFinite(input.mediaSeconds) && input.mediaSeconds > 0
      ? Math.min(36000, Math.round(input.mediaSeconds * 10) / 10)
      : null;
  const { result } = await run("admin_set_social_tags", {
    p_post_id: input.postId,
    p_platform: input.postId ? null : input.platform,
    p_external_id: input.postId ? null : input.externalId,
    p_tags: cleanTags(input.tags),
    p_media_seconds: input.postId ? seconds : null,
  });
  revalidatePath("/admin/marketing");
  refresh();
  return { ok: result.ok, error: result.error };
}
