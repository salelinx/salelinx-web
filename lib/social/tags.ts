// What is in a video, so Stats can later say why one post beat another. Two
// kinds:
//
// - Picked when planning (or afterwards on Stats), or filled in by
//   scripts/social-tag.mjs and Trend Remix: the groups in tag-lists.json and
//   three yes/no flags. Stored as JSON on social_posts (a planner
//   post, shared by all its platforms) or marketing_videos (a video that never
//   went through the planner), written only through admin_set_social_tags()
//   (054_social_tags.sql). Values are the labels themselves, so a custom one
//   added with "New" reads the same everywhere.
// - Read automatically, never stored: length, posting slot and what the
//   caption does. Free and always right.
//
// Pure, so tests can run it (tests/social-overview.test.ts).

import { hashtagCount } from "./validate";
import lists from "./tag-lists.json";

export type SocialTags = {
  madeWith?: string;
  format?: string;
  opening?: string;
  style?: string;
  topics?: string[];
  sound?: string;
  face?: boolean;
  hookText?: boolean;
  collab?: boolean;
  // "auto" until a person changes them; scripts/social-tag.mjs only ever fills auto ones.
  by?: "auto" | "you";
};

export type TagGroupKey = "madeWith" | "format" | "opening" | "style" | "topics" | "sound";
export type TagFlagKey = "face" | "hookText" | "collab";

// Shared with scripts/social-tag.mjs, which can't import TypeScript.
export const TAG_GROUPS = lists.groups as {
  key: TagGroupKey;
  label: string;
  hint: string;
  multi: boolean;
  options: string[];
}[];

export const TAG_FLAGS = lists.flags as { key: TagFlagKey; label: string }[];

const SINGLE_KEYS = TAG_GROUPS.filter((g) => !g.multi).map((g) => g.key as Exclude<TagGroupKey, "topics">);

export const TAG_MAX_LENGTH = 40;
export const TAG_MAX_TOPICS = 5;

const cleanText = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().replace(/\s+/g, " ").slice(0, TAG_MAX_LENGTH);
  return t || undefined;
};

/** Whatever arrives (a form, a JSON column), as tags we are willing to store. */
export function cleanTags(input: unknown): SocialTags {
  const src = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const out: SocialTags = {};
  for (const key of SINGLE_KEYS) {
    const v = cleanText(src[key]);
    if (v) out[key] = v;
  }
  if (Array.isArray(src.topics)) {
    const topics = [...new Set(src.topics.map(cleanText).filter((t): t is string => !!t))].slice(0, TAG_MAX_TOPICS);
    if (topics.length) out.topics = topics;
  }
  for (const { key } of TAG_FLAGS) if (src[key] === true) out[key] = true;
  if (src.by === "auto" || src.by === "you") out.by = src.by;
  return out;
}

/** Has anyone said what is in it? The flags alone don't count. */
export function isTagged(tags: SocialTags): boolean {
  return SINGLE_KEYS.some((k) => !!tags[k]) || !!tags.topics?.length;
}

/** The picked tags as chips, in a fixed order. */
export function tagLabels(tags: SocialTags): string[] {
  return [
    tags.madeWith,
    tags.format,
    tags.opening,
    tags.style,
    tags.sound,
    ...(tags.topics ?? []),
    ...TAG_FLAGS.filter((f) => tags[f.key]).map((f) => f.label),
  ].filter((t): t is string => !!t);
}

/** Each group's options: the defaults, then any custom value already in use. */
export function tagOptions(all: SocialTags[]): Record<TagGroupKey, string[]> {
  const out = {} as Record<TagGroupKey, string[]>;
  for (const g of TAG_GROUPS) {
    const seen = new Set(g.options);
    for (const t of all) {
      const values = g.key === "topics" ? (t.topics ?? []) : [t[g.key]];
      for (const v of values) if (v) seen.add(v);
    }
    out[g.key] = [...seen];
  }
  return out;
}

// --- Read automatically -------------------------------------------------------

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export const PARTS = ["Morning", "Midday", "Afternoon", "Evening", "Late"] as const;
export type Part = (typeof PARTS)[number];

// UK time, since that is when we post; hours that start each part.
const PART_STARTS: [number, Part][] = [
  [6, "Morning"],
  [11, "Midday"],
  [15, "Afternoon"],
  [18, "Evening"],
  [22, "Late"],
];

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

/** The day and part of the day a post went out, in UK time. */
export function slotOf(iso: string | null): { day: Day; part: Part; hour: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = londonParts.formatToParts(d);
  const day = parts.find((p) => p.type === "weekday")?.value as Day | undefined;
  const hour = Number(parts.find((p) => p.type === "hour")?.value) % 24;
  if (!day || !DAYS.includes(day) || !Number.isFinite(hour)) return null;
  let part: Part = "Late";
  for (const [start, name] of PART_STARTS) if (hour >= start) part = name;
  return { day, part, hour };
}

export const LENGTH_BUCKETS = ["Under 15s", "15 to 30s", "30 to 45s", "45 to 60s", "Over 60s"] as const;

export function lengthBucket(seconds: number | null): (typeof LENGTH_BUCKETS)[number] | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 15) return "Under 15s";
  if (seconds < 30) return "15 to 30s";
  if (seconds < 45) return "30 to 45s";
  if (seconds <= 60) return "45 to 60s";
  return "Over 60s";
}

/** 18s, 1m 05s. */
export function formatLength(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

const CALL_TO_ACTION =
  /\b(link in (my |our |the )?bio|download|install|free trial|try (it|salelinx|it free)|sign up|follow (us |me )?for|comment (below|if)|salelinx\.com)\b/i;

export type CaptionFeatures = {
  size: "Short caption" | "Medium caption" | "Long caption";
  question: boolean;
  hashtags: number;
  callToAction: boolean;
};

export function captionFeatures(caption: string | null): CaptionFeatures | null {
  const text = caption?.trim();
  if (!text) return null;
  return {
    size: text.length < 80 ? "Short caption" : text.length <= 300 ? "Medium caption" : "Long caption",
    question: text.includes("?"),
    hashtags: hashtagCount(text),
    callToAction: CALL_TO_ACTION.test(text),
  };
}

/** The automatic tags as chips: length, slot, then what the caption does. */
export function autoTags(input: {
  publishedAt: string | null;
  seconds: number | null;
  caption: string | null;
}): string[] {
  const out: string[] = [];
  const length = formatLength(input.seconds);
  if (length) out.push(length);
  const slot = slotOf(input.publishedAt);
  if (slot) out.push(`${slot.day} ${slot.part.toLowerCase()}`);
  const c = captionFeatures(input.caption);
  if (c) {
    out.push(c.size);
    if (c.question) out.push("Asks a question");
    if (c.hashtags) out.push(c.hashtags === 1 ? "1 hashtag" : `${c.hashtags} hashtags`);
    if (c.callToAction) out.push("Call to action");
  }
  return out;
}
