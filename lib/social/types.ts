// Shapes for the planner and experiments (052_social.sql). The admin pages
// read these tables under RLS; writes go through the admin_* RPCs.
//
// The option types mirror supabase/functions/marketing-publish/plan.ts, which
// is what reads them; that folder is outside this repo's tsconfig, so keep the
// two in step by hand.

import type { MarketingPlatform } from "@/lib/admin/marketing";

export type SocialPlatform = MarketingPlatform;

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok", "facebook"];

export const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export type TargetStatus =
  | "pending"
  | "sending"
  | "processing"
  | "inbox"
  | "published"
  | "failed";

export type YouTubeOptions = {
  privacy?: "public" | "unlisted" | "private";
  tags?: string[];
  madeForKids?: boolean;
  categoryId?: string;
  notifySubscribers?: boolean;
};

export type InstagramOptions = {
  shareToFeed?: boolean;
  trial?: "off" | "manual" | "auto";
};

export type SocialTargetRow = {
  post_id: string;
  platform: SocialPlatform;
  title: string | null;
  caption: string | null;
  options: YouTubeOptions & InstagramOptions;
  status: TargetStatus;
  attempts: number;
  next_attempt_at: string | null;
  locked_until: string | null;
  job: { note?: string | null; publish_at?: string | null; [k: string]: unknown };
  external_id: string | null;
  url: string | null;
  error: string | null;
  published_at: string | null;
  updated_at: string;
};

export type SocialPostRow = {
  id: string;
  name: string;
  media_path: string | null;
  media_bytes: number | null;
  media_type: string | null;
  cover_path: string | null;
  status: "draft" | "scheduled";
  scheduled_at: string | null;
  experiment_id: string | null;
  variant: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPost = SocialPostRow & { targets: SocialTargetRow[] };

export type ExperimentMetric =
  | "views_1h"
  | "views_6h"
  | "views_24h"
  | "views_72h"
  | "views_7d"
  | "engagement_7d";

export const METRIC_LABELS: Record<ExperimentMetric, string> = {
  views_1h: "Views at 1 hour",
  views_6h: "Views at 6 hours",
  views_24h: "Views at 24 hours",
  views_72h: "Views at 3 days",
  views_7d: "Views at 7 days",
  engagement_7d: "Engagement at 7 days",
};

export type ExperimentVariant = { key: string; label: string };

export type SocialExperimentRow = {
  id: string;
  name: string;
  hypothesis: string | null;
  metric: ExperimentMetric;
  variants: ExperimentVariant[];
  status: "running" | "concluded";
  winner: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
};

export type ExperimentVideoRow = {
  experiment_id: string;
  platform: SocialPlatform;
  external_id: string;
  variant: string;
  added_at: string;
};

export type HourlyRow = {
  platform: SocialPlatform;
  external_id: string;
  captured_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

/** The accounts as admin_marketing_accounts() returns them. */
export type SocialAccount = {
  platform: SocialPlatform;
  handle: string | null;
  connected_at: string;
  synced_at: string | null;
  last_error: string | null;
  logged_in: boolean;
  scopes: string | null;
};

/** Mirrors POSTING_SCOPE in supabase/functions/_shared/marketing-login.ts. */
const POSTING_SCOPE: Record<SocialPlatform, string> = {
  youtube: "youtube.upload",
  instagram: "instagram_content_publish",
  tiktok: "video.upload",
  facebook: "pages_manage_posts",
};

export function canPost(account: SocialAccount | undefined): boolean {
  return !!account?.logged_in && !!account.scopes?.includes(POSTING_SCOPE[account.platform]);
}
