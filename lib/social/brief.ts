// A rule experiment (061_social_auto.sql) has no member list: every video
// posted from its start whose value on its Compare dimension matches exactly
// one variant is in.

import { DIMENSIONS, findings, MEASURES, oftenWith } from "./compare";
import { median, METRIC_HOURS } from "./experiments";
import type { InsightVideo } from "./insights";
import {
  type ExperimentMetric,
  type ExperimentVideoRow,
  type SocialExperimentRow,
  type SocialPlatform,
} from "./types";

type Rule = Pick<SocialExperimentRow, "id" | "dimension" | "starts_at" | "variants">;

function ruleVariant(e: Rule, v: InsightVideo): string | null {
  if (!e.dimension || !e.starts_at || !v.publishedAt) return null;
  if (Date.parse(v.publishedAt) < Date.parse(e.starts_at)) return null;
  const dim = DIMENSIONS.find((d) => d.key === e.dimension);
  if (!dim) return null;
  const values = dim.values(v);
  const hits = e.variants.filter((x) => x.value && values.includes(x.value));
  return hits.length === 1 ? hits[0].key : null;
}

export function ruleMembers(e: Rule, videos: InsightVideo[]): ExperimentVideoRow[] {
  return videos.flatMap((v) => {
    const variant = ruleVariant(e, v);
    return variant
      ? [{ experiment_id: e.id, platform: v.platform, external_id: v.external_id, variant, added_at: v.publishedAt! }]
      : [];
  });
}

// Something most of one variant shares and the others don't, which the test may be measuring instead.
export function ruleWarnings(e: Rule, videos: InsightVideo[]): string[] {
  if (!e.dimension) return [];
  const byKey = new Map<string, InsightVideo[]>();
  for (const v of videos) {
    const k = ruleVariant(e, v);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), v]);
  }
  const out: string[] = [];
  for (const [key, mine] of byKey) {
    const rest = [...byKey].filter(([k]) => k !== key).flatMap(([, vs]) => vs);
    const often = oftenWith(mine, rest, e.dimension);
    if (often)
      out.push(
        `${e.variants.find((x) => x.key === key)?.label || key}: ${Math.round(often.share * 100)}% are ${often.label}, against ${Math.round(often.restShare * 100)}% of the others.`,
      );
  }
  return out.sort();
}

const atMetric = (v: InsightVideo, metric: ExperimentMetric) =>
  v.at[METRIC_HOURS[metric] as keyof InsightVideo["at"]];

export type RuleProgress = {
  // Per variant, the fewest posted and measured on any platform it is on.
  variants: { key: string; label: string; posted: number; measured: number }[];
  target: number;
  ready: boolean;
};

export function ruleProgress(
  e: Rule & Pick<SocialExperimentRow, "metric" | "target_per_variant">,
  videos: InsightVideo[],
): RuleProgress {
  const target = e.target_per_variant ?? 8;
  const members = videos.filter((v) => ruleVariant(e, v));
  const platforms = [...new Set(members.map((v) => v.platform))] as SocialPlatform[];
  const variants = e.variants.map((x) => {
    const mine = members.filter((v) => ruleVariant(e, v) === x.key);
    const per = (f: (v: InsightVideo) => boolean) =>
      platforms.length ? Math.min(...platforms.map((p) => mine.filter((v) => v.platform === p && f(v)).length)) : 0;
    return {
      key: x.key,
      label: x.label || x.value || x.key,
      posted: per(() => true),
      measured: per((v) => atMetric(v, e.metric) !== null),
    };
  });
  return { variants, target, ready: platforms.length > 0 && variants.every((x) => x.measured >= target) };
}

type BriefPost = { title: string; platform: SocialPlatform; url: string | null; index: number };

export type Brief = {
  generatedAt: string;
  week: { uploads: number; typical: number | null; best: BriefPost | null; worst: BriefPost | null };
  experiments: { id: string; name: string; ready: boolean; needs: string[] }[];
  working: { dimension: string; value: string; lift: number; often: string | null }[];
  // UK hours.
  bestHours: { hour: number; index: number; posts: number }[];
};

const DAY_MS = 86_400_000;
const MIN_SLOT_POSTS = 3;
const index24 = MEASURES.find((m) => m.key === "index24")!;

export function weeklyBrief(
  videos: InsightVideo[],
  experiments: (Rule & Pick<SocialExperimentRow, "name" | "metric" | "status" | "target_per_variant">)[],
  nowMs: number,
): Brief {
  const since = (days: number) =>
    videos.filter((v) => v.publishedAt && Date.parse(v.publishedAt) >= nowMs - days * DAY_MS);

  const week = since(7);
  const scored = week
    .filter((v) => v.index[24] !== null)
    .map((v) => ({ title: v.title, platform: v.platform, url: v.url, index: v.index[24]! }))
    .sort((a, b) => b.index - a.index);

  const recent = since(90);
  const working = findings(recent, index24)
    .filter((f) => f.row.verdict === "real")
    .slice(0, 3)
    .map((f) => ({
      dimension: f.dimension.label,
      value: f.row.value,
      lift: f.row.lift ?? 0,
      often: f.row.often?.label ?? null,
    }));

  const hours = new Map<number, number[]>();
  for (const v of recent) {
    if (!v.slot || v.index[24] === null) continue;
    hours.set(v.slot.hour, [...(hours.get(v.slot.hour) ?? []), v.index[24]]);
  }
  const bestHours = [...hours]
    .filter(([, xs]) => xs.length >= MIN_SLOT_POSTS)
    .map(([hour, xs]) => ({ hour, index: median(xs)!, posts: xs.length }))
    .sort((a, b) => b.index - a.index)
    .slice(0, 3);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    week: {
      uploads: week.length,
      typical: median(scored.map((s) => s.index)),
      best: scored[0] ?? null,
      worst: scored.length > 1 ? scored[scored.length - 1] : null,
    },
    experiments: experiments
      .filter((e) => e.status === "running" && e.dimension)
      .map((e) => {
        const progress = ruleProgress(e, videos);
        return {
          id: e.id,
          name: e.name,
          ready: progress.ready,
          needs: progress.ready
            ? []
            : progress.variants
                .filter((x) => x.posted < progress.target)
                .map((x) => `${progress.target - x.posted} more "${x.label}"`),
        };
      }),
    working,
    bestHours,
  };
}
