// The publisher's decisions, kept free of fetch and Deno so vitest can run
// them: how to cut a file into upload chunks, how a YouTube upload is timed,
// and what each platform's progress answer means for the target.

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
  // Trial Reels go to non-followers first. "manual" graduates from the app,
  // "auto" lets Instagram graduate it if it does well.
  trial?: "off" | "manual" | "auto";
};

/** TikTok posted through TikTok API for Business: the labels TikTok shows. */
export type TikTokOptions = {
  // "Promotional content": we are promoting our own business.
  brandOrganic?: boolean;
  // "Creator labeled as AI-generated"; cannot be removed once posted.
  aiGenerated?: boolean;
};

const MiB = 1024 * 1024;

/** A byte range to send, both ends inclusive, as HTTP ranges are. */
export type Chunk = { start: number; end: number };

/**
 * YouTube resumable upload: every chunk but the last must be a multiple of
 * 256 KiB. 8 MiB keeps memory low and the request count small.
 */
export function youtubeChunks(size: number, chunk = 8 * MiB): Chunk[] {
  if (size <= 0) return [];
  const out: Chunk[] = [];
  for (let start = 0; start < size; start += chunk) {
    out.push({ start, end: Math.min(start + chunk, size) - 1 });
  }
  return out;
}

/**
 * TikTok FILE_UPLOAD: chunks of 5 to 64 MB, total_chunk_count is
 * floor(size / chunk_size), and the last chunk takes the remainder (it may
 * be up to 128 MB). 10 MiB chunks, so the last is 10 to 20 MiB; anything
 * under 20 MiB goes in one piece, which TikTok requires below 5 MB anyway.
 * Small chunks because each is held in memory on its way through.
 */
export function tiktokChunks(size: number, chunkSize = 10 * MiB): {
  chunkSize: number;
  count: number;
  chunks: Chunk[];
} {
  if (size < 2 * chunkSize) {
    return { chunkSize: size, count: 1, chunks: [{ start: 0, end: size - 1 }] };
  }
  const count = Math.floor(size / chunkSize);
  const chunks: Chunk[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    chunks.push({ start, end });
  }
  return { chunkSize, count, chunks };
}

/**
 * YouTube is claimed an hour early and uploaded private with publishAt set,
 * so YouTube itself flips it public on time with processing done. That only
 * applies to public posts still at least 10 minutes off; anything else goes
 * up with the privacy it asked for, straight away.
 */
export function youtubeStatus(
  options: YouTubeOptions,
  scheduledAt: string,
  now: number,
): { privacyStatus: "public" | "unlisted" | "private"; publishAt?: string } {
  const privacy = options.privacy ?? "public";
  if (privacy === "public" && Date.parse(scheduledAt) - now > 10 * 60 * 1000) {
    return {
      privacyStatus: "private",
      publishAt: new Date(scheduledAt).toISOString(),
    };
  }
  return { privacyStatus: privacy };
}

/** Instagram's trial_params for a Trial Reel, or null for an ordinary one. */
export function instagramTrialParams(
  options: InstagramOptions,
): { graduation_strategy: "MANUAL" | "SS_PERFORMANCE" } | null {
  if (options.trial === "manual") return { graduation_strategy: "MANUAL" };
  if (options.trial === "auto") return { graduation_strategy: "SS_PERFORMANCE" };
  return null;
}

export type Next =
  | { kind: "wait"; status: "processing" | "inbox"; checkInSeconds: number; note?: string }
  | { kind: "published"; externalId: string | null; note?: string }
  | { kind: "failed"; error: string }
  | { kind: "publish" };

const HOUR = 3600;
// How long a TikTok video may sit in the inbox before we stop checking.
export const TIKTOK_INBOX_DAYS = 7;

/**
 * TikTok's publish/status/fetch answer, given when the upload finished
 * (job.uploaded_at). Inbox uploads end in PUBLISH_COMPLETE once someone posts
 * from the app; the public id follows once TikTok has reviewed it.
 */
export function tiktokNext(
  data: {
    status?: string;
    fail_reason?: string;
    publicaly_available_post_id?: (string | number)[];
  },
  uploadedAt: string | undefined,
  now: number,
): Next {
  const ageS = uploadedAt ? (now - Date.parse(uploadedAt)) / 1000 : 0;
  const expired = ageS > TIKTOK_INBOX_DAYS * 24 * HOUR;
  switch (data.status) {
    case "PROCESSING_UPLOAD":
    case "PROCESSING_DOWNLOAD":
      if (ageS > 2 * HOUR)
        return { kind: "failed", error: "TikTok was still processing the upload after 2 hours." };
      return { kind: "wait", status: "processing", checkInSeconds: 60 };
    case "SEND_TO_USER_INBOX":
      if (expired)
        return {
          kind: "failed",
          error: `Not posted from the TikTok inbox within ${TIKTOK_INBOX_DAYS} days.`,
        };
      return { kind: "wait", status: "inbox", checkInSeconds: 15 * 60 };
    case "PUBLISH_COMPLETE": {
      const id = data.publicaly_available_post_id?.[0];
      if (id !== undefined) return { kind: "published", externalId: String(id) };
      if (expired)
        return {
          kind: "published",
          externalId: null,
          note: "Posted, but TikTok never gave the public id (it may be private). Add it to experiments by hand.",
        };
      return {
        kind: "wait",
        status: "inbox",
        checkInSeconds: 30 * 60,
        note: "Posted from the app; waiting for TikTok to make it public.",
      };
    }
    case "FAILED":
      return { kind: "failed", error: `TikTok: ${data.fail_reason ?? "failed"}` };
    default:
      return { kind: "wait", status: "processing", checkInSeconds: 120 };
  }
}

/**
 * TikTok API for Business's /business/publish/status/ answer for a public
 * post, given when it was sent (job.sent_at). TikTok downloads the video
 * (PROCESSING_DOWNLOAD), then PUBLISH_COMPLETE; the post id can follow up to
 * 3 minutes later, and only for a post that is public.
 */
export function tiktokBusinessNext(
  data: { status?: string; reason?: string; post_ids?: (string | number)[] },
  sentAt: string | undefined,
  now: number,
): Next {
  const ageS = sentAt ? (now - Date.parse(sentAt)) / 1000 : 0;
  switch (data.status) {
    case "PUBLISH_COMPLETE": {
      const id = data.post_ids?.[0];
      if (id !== undefined && id !== null && String(id) !== "")
        return { kind: "published", externalId: String(id) };
      if (ageS > HOUR / 2)
        return {
          kind: "published",
          externalId: null,
          note: "Posted, but TikTok never gave the post's id (it may not be public). Add it to experiments by hand.",
        };
      return { kind: "wait", status: "processing", checkInSeconds: 60 };
    }
    case "FAILED":
      return { kind: "failed", error: `TikTok: ${data.reason ?? "failed"}` };
    case "SEND_TO_USER_INBOX":
      // Only drafts go here, and we never send one.
      return {
        kind: "failed",
        error: "TikTok sent this to the app's inbox as a draft instead of posting it. Post it from the app.",
      };
    default:
      if (ageS > 2 * HOUR)
        return { kind: "failed", error: "TikTok was still fetching the video after 2 hours." };
      return { kind: "wait", status: "processing", checkInSeconds: 60 };
  }
}

/** TikTok's post_info for a public post. */
export function tiktokPostInfo(caption: string | null, options: TikTokOptions) {
  return {
    caption: caption ?? "",
    is_brand_organic: options.brandOrganic ?? false,
    // Required by TikTok (40002 without it). True only for a paid
    // partnership promoting someone else's brand, which ours never are.
    is_branded_content: false,
    is_ai_generated: options.aiGenerated ?? false,
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
  };
}

/**
 * Where the public copy of a post's video goes (060's social-public bucket):
 * the post's id, so a retry replaces it rather than leaving another behind.
 */
export function publicCopyPath(postId: string, mediaPath: string): string {
  const name = mediaPath.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return `tiktok/${postId}.${ext || "mp4"}`;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** The id of the Studio-scheduled post among the account's recent videos, matched on its caption. */
export function studioMatch(
  videos: { id?: string | number; video_description?: string; create_time?: number }[],
  caption: string,
  scheduledInStudioAt: string,
): string | null {
  const from = Date.parse(scheduledInStudioAt) / 1000 - HOUR;
  const want = norm(caption).slice(0, 60);
  const v = videos.find(
    (v) => (v.create_time ?? 0) >= from && want !== "" && norm(v.video_description ?? "").startsWith(want),
  );
  return v?.id != null ? String(v.id) : null;
}

/** An Instagram container's status_code, given when it was made. */
export function instagramNext(
  statusCode: string | undefined,
  status: string | undefined,
  createdAt: string | undefined,
  now: number,
): Next {
  switch (statusCode) {
    case "FINISHED":
      return { kind: "publish" };
    case "PUBLISHED":
      // Published by an earlier run whose answer was lost; the caller looks
      // the media up rather than publishing twice.
      return { kind: "published", externalId: null };
    case "ERROR":
      return { kind: "failed", error: `Instagram couldn't process the video: ${status ?? "error"}` };
    case "EXPIRED":
      return { kind: "failed", error: "Instagram's upload expired before it was published." };
    default: {
      const ageS = createdAt ? (now - Date.parse(createdAt)) / 1000 : 0;
      if (ageS > HOUR)
        return { kind: "failed", error: "Instagram was still processing the video after an hour." };
      return { kind: "wait", status: "processing", checkInSeconds: 60 };
    }
  }
}

/**
 * A Facebook Reel's `status` after the finish call, given when that was.
 * publishing_phase goes complete once it is live; any phase can report error.
 */
export function facebookNext(
  status:
    | {
        video_status?: string;
        processing_phase?: { status?: string; errors?: { message?: string }[] };
        publishing_phase?: { status?: string; publish_status?: string };
      }
    | undefined,
  finishedAt: string | undefined,
  now: number,
): Next {
  const phaseError =
    status?.processing_phase?.status === "error" ||
    status?.publishing_phase?.status === "error" ||
    status?.video_status === "error";
  if (phaseError)
    return {
      kind: "failed",
      error: `Facebook couldn't process the Reel: ${status?.processing_phase?.errors?.[0]?.message ?? "error"}`,
    };
  if (
    status?.publishing_phase?.status === "complete" ||
    status?.publishing_phase?.publish_status === "published"
  )
    return { kind: "published", externalId: null };
  const ageS = finishedAt ? (now - Date.parse(finishedAt)) / 1000 : 0;
  if (ageS > HOUR)
    return {
      kind: "failed",
      error:
        "Facebook was still processing the Reel after an hour. Check the Page before retrying: it may have posted.",
    };
  return { kind: "wait", status: "processing", checkInSeconds: 60 };
}

/**
 * When Facebook won't show a published Reel to the Page token, whether it is
 * in the Page's Reels list decides instead. Not there yet: keep checking for
 * an hour, then fail with a warning, since Retry would publish it again.
 */
export function facebookListedNext(listed: boolean, finishedAt: string | undefined, now: number): Next {
  if (listed) return { kind: "published", externalId: null };
  const ageS = finishedAt ? (now - Date.parse(finishedAt)) / 1000 : 0;
  if (ageS > HOUR)
    return {
      kind: "failed",
      error:
        "Facebook took the Reel, but it still isn't on the Page after an hour. Check the Page before retrying: it may have posted.",
    };
  return { kind: "wait", status: "processing", checkInSeconds: 60 };
}

/** Graph writes offsets as +0000, which Date.parse does not take everywhere. NaN if unreadable. */
export function parseGraphTime(s: string | null | undefined): number {
  return s ? Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, "$1:$2")) : NaN;
}

/** A Reel from the Page's /video_reels list. */
export type PageReel = {
  id: string;
  description?: string | null;
  created_time?: string | null;
  permalink_url?: string | null;
};

// A failed Facebook post whose Reel may be live after all: the publish call's
// answer was lost ("may have posted"), or the read after it was refused
// (quoting the Reel's id).
const MAY_BE_LIVE = /may have posted|Object with ID '\d+'/;

/** Whether a failed Facebook post is worth looking for on the Page. */
export function facebookMayBeLive(error: string | null | undefined): boolean {
  return !!error && MAY_BE_LIVE.test(error);
}

/**
 * Finds a failed Facebook post's Reel on the Page, if it went live after all.
 * First by id: the one saved in job, or the one a refused read quoted (unless
 * that is the Page's own id, from a call that failed before anything posted).
 * Otherwise, when publishing may have gone through, by caption: exactly one
 * Reel with the same caption, posted within three hours of the failure.
 * Reels already credited to another post are never matched.
 */
export function findFailedReel(
  target: {
    error: string | null;
    job: Record<string, unknown> | null;
    caption: string | null;
    failedAt: string;
  },
  reels: PageReel[],
  taken: Set<string>,
  pageId: string,
): PageReel | null {
  if (!facebookMayBeLive(target.error)) return null;
  const free = reels.filter((r) => !taken.has(String(r.id)));
  const quoted = target.error?.match(/Object with ID '(\d+)'/)?.[1];
  const refusedRead = !!quoted && quoted !== pageId;
  const ids = new Set<string>();
  if (target.job?.video_id) ids.add(String(target.job.video_id));
  if (refusedRead) ids.add(quoted);
  const byId = free.find((r) => ids.has(String(r.id)));
  if (byId) return byId;

  if (!refusedRead && !target.error?.includes("may have posted")) return null;
  const caption = sameText(target.caption);
  const failed = Date.parse(target.failedAt);
  if (!caption || Number.isNaN(failed)) return null;
  const near = free.filter((r) => {
    const at = parseGraphTime(r.created_time);
    return !Number.isNaN(at) && Math.abs(at - failed) <= 3 * HOUR * 1000 && sameText(r.description) === caption;
  });
  // Two Reels with the same caption that close together: leave it to a person.
  return near.length === 1 ? near[0] : null;
}

function sameText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Back-off for a transient failure, or null once it has had its tries. */
export function retryIn(attempts: number): number | null {
  if (attempts >= 3) return null;
  return 120 * 2 ** attempts;
}

/** The first line of a caption, for the stats table's title. */
export function titleFrom(caption: string | null, fallback: string): string {
  const line = (caption ?? "").split("\n")[0].trim();
  return (line || fallback).slice(0, 200);
}
