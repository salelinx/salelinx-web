import { createServerClient } from "@/lib/supabase/server";
import { Planner } from "@/components/admin/social/Planner";
import type { Brief } from "@/lib/social/brief";
import {
  type PostThumb,
  type SocialAccount,
  type SocialPost,
} from "@/lib/social/types";

// /admin/marketing/planner - videos scheduled to YouTube, Instagram, TikTok
// and Facebook (052_social.sql). Reads the posts and their platforms under
// RLS; writes go through the server actions in ../actions.ts, and posting
// happens in the marketing-publish Edge Function. See docs/SOCIAL.md.

export const dynamic = "force-dynamic";

// Plenty for a planner; older posts stay in the database and on Stats.
const POST_LIMIT = 300;

// Signed links for the cards' video frames; the page is reloaded long before.
const THUMB_LINK_SECONDS = 6 * 60 * 60;

// The platform thumbnail to prefer when several copies are live: the
// vertical ones first, since YouTube's are 16:9 frames around the Short.
const THUMB_ORDER = ["instagram", "tiktok", "facebook", "youtube"] as const;

export default async function AdminPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    seen?: string;
    ig?: string;
    diag?: string;
  }>;
}) {
  const supabase = await createServerClient();
  const [postsRes, accountsRes, briefRes] = await Promise.all([
    supabase
      .from("social_posts")
      // Each post with its platforms, through the targets' foreign key.
      .select("*, targets:social_post_targets(*)")
      .order("updated_at", { ascending: false })
      .limit(POST_LIMIT),
    supabase.rpc("admin_marketing_accounts"),
    // Written by the Experiments page (061_social_auto.sql); missing is fine.
    supabase.from("social_brief").select("brief").maybeSingle(),
  ]);
  const bestHours = ((briefRes.data?.brief as Brief | undefined)?.bestHours ?? []).map((h) => h.hour);

  const posts = (postsRes.data as SocialPost[] | null) ?? [];
  const loadError = [postsRes, accountsRes].find(
    (r) => r.error,
  )?.error;

  return (
    <Planner
      posts={posts}
      accounts={(accountsRes.data as SocialAccount[] | null) ?? []}
      thumbs={await loadThumbs(supabase, posts)}
      bestHours={bestHours}
      loadError={loadError ? loadError.message : null}
      notice={await searchParams}
    />
  );
}

/**
 * Each post's picture: a live copy's platform thumbnail (from the stats
 * sync), else a signed link to the uploaded file. Pictures are a nicety, so a
 * failed lookup leaves the cards with a placeholder rather than failing the page.
 */
async function loadThumbs(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  posts: SocialPost[],
): Promise<Record<string, PostThumb>> {
  const out: Record<string, PostThumb> = {};
  const ids = [
    ...new Set(
      posts.flatMap((p) =>
        p.targets.map((t) => t.external_id).filter((id): id is string => !!id),
      ),
    ),
  ];

  if (ids.length) {
    const { data } = await supabase
      .from("marketing_videos")
      .select("platform, external_id, thumbnail_url")
      .in("external_id", ids);
    const found = new Map(
      (
        (data as
          | {
              platform: string;
              external_id: string;
              thumbnail_url: string | null;
            }[]
          | null) ?? []
      )
        .filter((v) => v.thumbnail_url)
        .map((v) => [`${v.platform}:${v.external_id}`, v.thumbnail_url!]),
    );
    for (const p of posts) {
      const byPlatform = new Map(
        p.targets.map((t) => [t.platform, t.external_id]),
      );
      const pick = THUMB_ORDER.map((pl) =>
        found.get(`${pl}:${byPlatform.get(pl)}`),
      ).find(Boolean);
      if (pick) out[p.id] = { kind: "image", url: pick };
    }
  }

  const files = [
    ...new Set(
      posts.filter((p) => !out[p.id] && p.media_path).map((p) => p.media_path!),
    ),
  ];
  if (files.length) {
    const { data } = await supabase.storage
      .from("social-media")
      .createSignedUrls(files, THUMB_LINK_SECONDS);
    const signed = new Map(
      (data ?? [])
        .filter((d) => d.signedUrl && d.path)
        .map((d) => [d.path!, d.signedUrl]),
    );
    for (const p of posts) {
      const url = p.media_path ? signed.get(p.media_path) : undefined;
      if (!out[p.id] && url) out[p.id] = { kind: "video", url };
    }
  }
  return out;
}
