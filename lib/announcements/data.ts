import { createServerClient } from '@/lib/supabase/server';
import { ANNOUNCEMENTS_ENDED_SHOWN, type Announcement } from './types';

// Loader for /admin/announcements (migration 060_announcements.sql). Reads the
// table with the admin's own session: its only policy is the is_admin() one,
// so nobody else gets a row. Uncached, so an edit shows straight away.

/**
 * Everything not yet ended, plus the most recently ended ones. `now` is the
 * server's clock at read time, which the console groups by until its own
 * clock takes over (so the server and the first client render agree). The
 * error is returned rather than swallowed so a missing migration reads as an
 * error, not as an empty list.
 */
export async function getAnnouncementsForAdmin(): Promise<{
  announcements: Announcement[];
  now: string;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const now = new Date().toISOString();
  const [current, ended] = await Promise.all([
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
  ]);
  const error = current.error ?? ended.error;
  if (error || !current.data || !ended.data) {
    return { announcements: [], now, error: error?.message ?? 'read failed' };
  }
  return {
    announcements: [...current.data, ...ended.data] as Announcement[],
    now,
    error: null,
  };
}
