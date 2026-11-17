// What the planner checks before it lets a post be scheduled: each platform's
// own limits, so a post fails here rather than at 3am in marketing-publish.
// Problems block scheduling; warnings are shown but do not.

import type { SocialPlatform } from "./types";

export type TargetDraft = {
  platform: SocialPlatform;
  title: string;
  caption: string;
};

export const LIMITS = {
  youtubeTitle: 100,
  youtubeDescription: 5000,
  youtubeTags: 500,
  caption: 2200,
  facebookCaption: 5000,
  hashtags: 30,
  mentions: 20,
  // Instagram Reels through the API.
  instagramBytes: 300 * 1024 * 1024,
} as const;

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

export function hashtagCount(text: string): number {
  return count(text, /(^|\s)#[^\s#]+/g);
}

export function targetProblems(
  t: TargetDraft,
  tags: string[] = [],
): string[] {
  const out: string[] = [];
  if (t.platform === "youtube") {
    if (!t.title.trim()) out.push("YouTube needs a title.");
    if (t.title.length > LIMITS.youtubeTitle)
      out.push(`YouTube titles are at most ${LIMITS.youtubeTitle} characters.`);
    if (/[<>]/.test(t.title) || /[<>]/.test(t.caption))
      out.push("YouTube does not allow < or > in the title or description.");
    if (new TextEncoder().encode(t.caption).length > LIMITS.youtubeDescription)
      out.push(`YouTube descriptions are at most ${LIMITS.youtubeDescription} bytes.`);
    if (tags.join(",").length > LIMITS.youtubeTags)
      out.push(`YouTube tags are at most ${LIMITS.youtubeTags} characters in all.`);
    return out;
  }
  const max = t.platform === "facebook" ? LIMITS.facebookCaption : LIMITS.caption;
  if (t.caption.length > max) out.push(`Captions are at most ${max} characters.`);
  if (t.platform === "instagram") {
    if (hashtagCount(t.caption) > LIMITS.hashtags)
      out.push(`Instagram allows at most ${LIMITS.hashtags} hashtags.`);
    if (count(t.caption, /(^|\s)@[\w.]+/g) > LIMITS.mentions)
      out.push(`Instagram allows at most ${LIMITS.mentions} @mentions.`);
  }
  return out;
}

export function postWarnings(input: {
  platforms: SocialPlatform[];
  mediaBytes: number | null;
  scheduledAt: string | null;
  now: number;
  // The file's length and frame, once the browser has read them.
  seconds?: number | null;
  width?: number | null;
  height?: number | null;
}): string[] {
  const out: string[] = [];
  const seconds = input.seconds ?? null;
  const shape = input.width && input.height ? input.height / input.width : null;
  if (
    input.platforms.includes("instagram") &&
    input.mediaBytes !== null &&
    input.mediaBytes > LIMITS.instagramBytes
  )
    out.push("Instagram may refuse Reels over 300 MB.");
  if (input.platforms.includes("facebook")) {
    if (seconds === null && shape === null)
      out.push("Facebook Reels must be vertical (9:16) and 3 to 90 seconds long.");
    if (seconds !== null && (seconds < 3 || seconds > 90))
      out.push(`Facebook Reels must be 3 to 90 seconds long; this video is ${Math.round(seconds)} seconds.`);
    if (shape !== null && shape < 1.7)
      out.push("This video isn't vertical, and Facebook Reels must be 9:16.");
  }
  if (input.platforms.includes("youtube") && seconds !== null && seconds > 180)
    out.push("Over 3 minutes, so YouTube treats it as a normal video rather than a Short.");
  if (input.platforms.includes("tiktok"))
    out.push(
      "TikTok arrives in the app's inbox at this time. Open TikTok, tap the notification, paste the caption and post.",
    );
  if (
    input.platforms.includes("youtube") &&
    input.scheduledAt &&
    Date.parse(input.scheduledAt) - input.now < 70 * 60 * 1000 &&
    Date.parse(input.scheduledAt) > input.now
  )
    out.push(
      "YouTube uploads an hour ahead so it is processed in time; this is sooner, so it may go live a few minutes late.",
    );
  return out;
}

export function scheduleProblems(input: {
  hasMedia: boolean;
  platforms: SocialPlatform[];
  scheduledAt: string | null;
  now: boolean;
  nowMs: number;
}): string[] {
  const out: string[] = [];
  if (!input.hasMedia) out.push("Add a video first.");
  if (!input.platforms.length) out.push("Pick at least one platform.");
  if (!input.now) {
    if (!input.scheduledAt) out.push("Pick a time.");
    else if (Date.parse(input.scheduledAt) < input.nowMs - 60_000)
      out.push("That time has passed. Pick a later one, or use Post now.");
  }
  return out;
}
