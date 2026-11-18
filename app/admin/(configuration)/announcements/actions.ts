"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import type { AnnouncementDraft } from "@/lib/announcements/types";

// Server actions behind /admin/announcements.
//
// All of them go through the is_admin()-gated RPCs from 060_announcements.sql,
// which are the real boundary (the web app never holds the service-role key)
// and which write their own audit entries. These wrappers exist to marshal
// arguments and revalidate, not to enforce anything. Only the console's own
// path needs revalidating: the extension hears about a change from the
// announcement_signal counter that every write to the table bumps.

export type AnnouncementResult = { ok: boolean; error?: string; id?: string };

async function run(
  fn: string,
  args: Record<string, unknown>,
): Promise<AnnouncementResult> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc(fn, args);

  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string; id?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? "failed" };

  revalidatePath("/admin/announcements");
  return { ok: true, id: result.id };
}

export async function saveAnnouncement(
  draft: AnnouncementDraft,
  isNew: boolean,
  showAgain: boolean,
): Promise<AnnouncementResult> {
  return run("admin_save_announcement", {
    p_id: draft.id,
    p_is_new: isNew,
    p_severity: draft.severity,
    p_title: draft.title,
    p_body: draft.body,
    p_cta_label: draft.cta_label,
    p_cta_url: draft.cta_url,
    p_dismissible: draft.dismissible,
    p_audience_tiers: draft.audience_tiers,
    p_audience_platforms: draft.audience_platforms,
    p_min_version: draft.min_version,
    p_max_version: draft.max_version,
    p_signed_in_only: draft.signed_in_only,
    p_starts_at: draft.starts_at,
    p_ends_at: draft.ends_at,
    p_show_again: !isNew && showAgain,
  });
}

export async function endAnnouncement(id: string): Promise<AnnouncementResult> {
  return run("admin_end_announcement", { p_id: id });
}

export async function deleteAnnouncement(id: string): Promise<AnnouncementResult> {
  return run("admin_delete_announcement", { p_id: id });
}
