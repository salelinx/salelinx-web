import { createServerClient } from "@/lib/supabase/server";
import { Planner } from "@/components/admin/social/Planner";
import type {
  SocialAccount,
  SocialExperimentRow,
  SocialPost,
} from "@/lib/social/types";

// /admin/marketing/planner - videos scheduled to YouTube, Instagram and
// TikTok (052_social.sql). Reads the posts and their platforms under RLS;
// writes go through the server actions in ../actions.ts, and posting happens
// in the marketing-publish Edge Function. See docs/SOCIAL.md.

export const dynamic = "force-dynamic";

// Plenty for a planner; older posts stay in the database and on Stats.
const POST_LIMIT = 300;

export default async function AdminPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; seen?: string; ig?: string; diag?: string }>;
}) {
  const supabase = await createServerClient();
  const [postsRes, experimentsRes, accountsRes] = await Promise.all([
    supabase
      .from("social_posts")
      // Each post with its platforms, through the targets' foreign key.
      .select("*, targets:social_post_targets(*)")
      .order("updated_at", { ascending: false })
      .limit(POST_LIMIT),
    supabase
      .from("social_experiments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.rpc("admin_marketing_accounts"),
  ]);

  const posts = (postsRes.data as SocialPost[] | null) ?? [];
  const loadError = [postsRes, experimentsRes, accountsRes].find(
    (r) => r.error,
  )?.error;

  return (
    <Planner
      posts={posts}
      experiments={(experimentsRes.data as SocialExperimentRow[] | null) ?? []}
      accounts={(accountsRes.data as SocialAccount[] | null) ?? []}
      loadError={loadError ? loadError.message : null}
      notice={await searchParams}
    />
  );
}
