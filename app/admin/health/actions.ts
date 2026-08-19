"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

// Server actions behind the manual status controls on /admin/health.
//
// Both go through the is_admin()-gated RPCs from migration 033, which are the
// real boundary (the web app never holds the service-role key) and which write
// their own audit entries. These wrappers exist to marshal the form data and
// revalidate, not to enforce anything.

export type OverrideResult = { ok: boolean; error?: string };

export async function setStatusOverride(
  target: string,
  state: string,
  note: string,
): Promise<OverrideResult> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("admin_set_status_override", {
    p_target: target,
    p_state: state,
    p_note: note.trim() === "" ? null : note.trim(),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? "failed" };

  // Both surfaces the override affects. The public page is additionally cached
  // for 60s (unstable_cache in lib/docs/feature-status.ts), so an incident
  // notice can take up to a minute to appear there - acceptable, and noted in
  // the UI rather than worked around, since dropping the cache would expose an
  // uncached public read.
  revalidatePath("/admin/health");
  revalidatePath("/docs/status");
  return { ok: true };
}

export async function clearStatusOverride(
  target: string,
): Promise<OverrideResult> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("admin_clear_status_override", {
    p_target: target,
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean } | null;
  if (!result?.ok) return { ok: false, error: "failed" };

  revalidatePath("/admin/health");
  revalidatePath("/docs/status");
  return { ok: true };
}
