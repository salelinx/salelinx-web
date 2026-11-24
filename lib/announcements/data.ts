import { createServerClient } from '@/lib/supabase/server';
import { ANNOUNCEMENTS_ENDED_SHOWN, type Announcement, type AnnouncementRow } from './types';

// Loader for /admin/announcements (migration 064_announcements.sql). Reads the
// table with the admin's own session: its only policy is the is_admin() one,
// so nobody else gets a row. Recipients come from
// admin_announcement_recipients(), which is admin-only too. Uncached, so an
// edit shows straight away.

/**
 * Everything not yet ended, plus the most recently ended ones, each with the
 * emails of the specific users it is for (empty when it is for everyone).
 * `now` is the server's clock at read time, which the console groups by until
 * its own clock takes over (so the server and the first client render agree).
 * An error from any of the reads is returned rather than swallowed, so a
 * missing migration reads as an error, not as an empty list.
 */
export async function getAnnouncementsForAdmin(): Promise<{
  announcements: AnnouncementRow[];
  now: string;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const now = new Date().toISOString();
  const [current, ended, recipients] = await Promise.all([
    supabase
      .from('announcements')
      .select('*')
      .or(`ends_at.is.null,ends_at.gt."${now}"`)
      .order('starts_at'),
    supabase
      .from('announcements')
      .select('*')
      .lte('ends_at', now)
      .order('ends_at', { ascending: false })
      .limit(ANNOUNCEMENTS_ENDED_SHOWN),
    supabase.rpc('admin_announcement_recipients'),
  ]);
  const error = current.error ?? ended.error ?? recipients.error;
  if (error || !current.data || !ended.data) {
    return { announcements: [], now, error: error?.message ?? 'read failed' };
  }

  // Rows come ordered by announcement, then email.
  const emails = new Map<string, string[]>();
  const pairs = (recipients.data ?? []) as { announcement_id: string; email: string | null }[];
  for (const { announcement_id: id, email } of pairs) {
    if (!email) continue;
    const list = emails.get(id);
    if (list) list.push(email);
    else emails.set(id, [email]);
  }

  const rows = [...current.data, ...ended.data] as Announcement[];
  return {
    announcements: rows.map((a) => ({ ...a, recipients: emails.get(a.id) ?? [] })),
    now,
    error: null,
  };
}
