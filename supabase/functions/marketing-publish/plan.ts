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
    return { kind: "failed", error: "Facebook was still processing the Reel after an hour." };
  return { kind: "wait", status: "processing", checkInSeconds: 60 };
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
