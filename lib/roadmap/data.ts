import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import type { RoadmapItem } from './types';

// Loaders for roadmap_items (migration 032_roadmap_items.sql). Same split as
// lib/supabase/tier-config.ts: a cached anon read for the public site, a fresh
// cookie-scoped read for the console.

export const ROADMAP_CACHE_TAG = 'roadmap-items';

// Cookie-less anon client, so RLS returns published cards only, even when the
// visitor is an admin. Throws on error so unstable_cache does not hold on to a
// failed read for the whole TTL.
const loadPublished = unstable_cache(
  async (): Promise<RoadmapItem[]> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from('roadmap_items')
      .select('*')
      .order('sort_order');
    if (error || !data) throw new Error(error?.message ?? 'roadmap read failed');
    return data as RoadmapItem[];
  },
  ['roadmap-items'],
  // Admin edits also revalidate this tag directly (app/admin/roadmap/actions.ts),
  // so the TTL is only the backstop for edits made in the SQL editor.
  { revalidate: 60, tags: [ROADMAP_CACHE_TAG] },
);

/** Published cards for /roadmap and the homepage, or null if the read failed. */
export async function getCachedRoadmapItems(): Promise<RoadmapItem[] | null> {
  try {
    return await loadPublished();
  } catch {
    return null;
  }
}

/**
 * Every card including hidden drafts, uncached. Admin console only. The error
 * is returned rather than swallowed so a missing migration reads as an error
 * in the console, not as an empty roadmap.
 */
export async function getRoadmapItemsForAdmin(): Promise<{
  items: RoadmapItem[];
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('*')
    .order('sort_order');
  if (error || !data) return { items: [], error: error?.message ?? 'read failed' };
  return { items: data as RoadmapItem[], error: null };
}
