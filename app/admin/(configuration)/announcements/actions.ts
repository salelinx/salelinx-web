"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  ANNOUNCEMENT_FREQUENCIES,
  ANNOUNCEMENT_IMAGE_BUCKET,
  ANNOUNCEMENT_EDITOR_PLACEMENTS,
  ANNOUNCEMENT_PRESETS,
  announcementRpcData,
  imagePathOk,
  type AnnouncementDraft,
} from "@/lib/announcements/types";
import { buildTestDraft, type TestOptions } from "@/lib/announcements/test-messages";

// Server actions behind /admin/announcements.
//
// All of them go through the is_admin()-gated RPCs from 064_announcements.sql,
// which are the real boundary (the web app never holds the service-role key)
// and which write their own audit entries. These wrappers exist to marshal
// arguments, tidy the image bucket and revalidate, not to enforce anything.
// Only the console's own path needs revalidating: the extension hears about a
// change from the announcement_signal counter that every write bumps.
//
// Images: the editor uploads straight into the announcement-images bucket as
// the admin, so a file can exist before any row points at it. A file is only
// ever removed here, and only once no announcement row (ended ones included)
// still uses its path. That removal is best effort: a file left behind only
// costs storage, so it never fails the save or delete that triggered it.

export type AnnouncementResult = {
  ok: boolean;
  error?: string;
  id?: string;
  // For unknown_recipients: the emails that match no account.
  emails?: string[];
};

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

type RpcAnswer = {
  ok?: boolean;
  error?: string;
  id?: string;
  emails?: unknown;
  image_path?: string | null;
};

async function call(
  supabase: Supabase,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcAnswer> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  const answer = (data ?? null) as RpcAnswer | null;
  if (!answer?.ok) return { ...answer, ok: false, error: answer?.error ?? "failed" };
  return answer;
}

const refresh = () => revalidatePath("/admin/announcements");

// Removes an image from the bucket unless an announcement still uses it.
async function removeUnusedImage(supabase: Supabase, path: string | null | undefined) {
  if (!path || !imagePathOk(path)) return;
  try {
    const { count, error } = await supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("image_path", path);
    if (error) {
      console.error("[announcements] image check failed:", error.message);
      return;
    }
    if (count === null || count > 0) return;
    const { error: removeError } = await supabase.storage
      .from(ANNOUNCEMENT_IMAGE_BUCKET)
      .remove([path]);
    if (removeError) {
      console.error("[announcements] image cleanup failed:", removeError.message);
    }
  } catch (err) {
    console.error("[announcements] image cleanup failed:", (err as Error).message);
  }
}

/**
 * Creates or edits one announcement. previousImagePath is the image the row
 * had when the editor opened (null for a new one): once the save has gone
 * through with a different image, the old file goes if nothing else uses it.
 */
export async function saveAnnouncement(
  draft: AnnouncementDraft,
  isNew: boolean,
  showAgain: boolean,
  previousImagePath: string | null,
): Promise<AnnouncementResult> {
  const supabase = await createServerClient();
  const answer = await call(supabase, "admin_save_announcement", {
    p_id: draft.id,
    p_is_new: isNew,
    p_data: announcementRpcData(draft),
    p_recipient_emails: draft.recipients,
    p_show_again: !isNew && showAgain,
  });
  if (!answer.ok) {
    const emails = Array.isArray(answer.emails)
      ? answer.emails.filter((e): e is string => typeof e === "string")
      : undefined;
    return { ok: false, error: answer.error, ...(emails ? { emails } : {}) };
  }

  if (previousImagePath && previousImagePath !== draft.image_path) {
    await removeUnusedImage(supabase, previousImagePath);
  }
  refresh();
  return { ok: true, id: answer.id };
}

// A quick test: a real announcement for the signed-in admin only, with sample
// copy, ending in an hour (lib/announcements/test-messages.ts). It saves
// through the same RPC as the editor, so it tests the whole path.
export async function sendTestAnnouncement(options: TestOptions): Promise<AnnouncementResult> {
  if (
    !ANNOUNCEMENT_PRESETS.some((p) => p.key === options.preset) ||
    !Array.isArray(options.places) ||
    options.places.length === 0 ||
    !options.places.every((p) => (ANNOUNCEMENT_EDITOR_PLACEMENTS as readonly string[]).includes(p)) ||
    !(ANNOUNCEMENT_FREQUENCIES as readonly string[]).includes(options.frequency)
  ) {
    return { ok: false, error: "invalid_test" };
  }
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "no_email" };

  const draft = buildTestDraft(options, user.email, Date.now());
  const answer = await call(supabase, "admin_save_announcement", {
    p_id: null,
    p_is_new: true,
    p_data: announcementRpcData(draft),
    p_recipient_emails: draft.recipients,
    p_show_again: false,
  });
  if (!answer.ok) return { ok: false, error: answer.error };
  refresh();
  return { ok: true, id: answer.id };
}

export async function endAnnouncement(id: string): Promise<AnnouncementResult> {
  const supabase = await createServerClient();
  const answer = await call(supabase, "admin_end_announcement", { p_id: id });
  if (!answer.ok) return { ok: false, error: answer.error };
  refresh();
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<AnnouncementResult> {
  const supabase = await createServerClient();
  const answer = await call(supabase, "admin_delete_announcement", { p_id: id });
  if (!answer.ok) return { ok: false, error: answer.error };
  await removeUnusedImage(supabase, answer.image_path);
  refresh();
  return { ok: true };
}

/**
 * Removes an image the editor uploaded but never saved (replaced, removed or
 * left behind by Cancel). Keeps it when a row uses the path after all.
 */
export async function discardUploadedImage(path: string): Promise<AnnouncementResult> {
  if (typeof path !== "string" || !imagePathOk(path)) return { ok: false, error: "bad_path" };
  const supabase = await createServerClient();
  await removeUnusedImage(supabase, path);
  return { ok: true };
}
