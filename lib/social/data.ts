// Server-side loaders shared by the Experiments page and a video's detail
// page. Everything is read with the admin's own session, under the
// is_admin() policies from 042_marketing.sql and 052_social.sql.

import type { createServerClient } from "@/lib/supabase/server";
import type { MarketingVideoRow } from "@/lib/admin/marketing";
import { videoCurve, type VideoCurve } from "./experiments";
import { SOCIAL_PLATFORMS, type HourlyRow, type SocialPlatform } from "./types";

type Client = Awaited<ReturnType<typeof createServerClient>>;

// PostgREST returns at most 1,000 rows per request.
const PAGE = 1000;
// Ids per .in() filter, to keep the request URL short.
const ID_BATCH = 100;

export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: string | null }> {
  const data: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await page(from, from + PAGE - 1);
    if (res.error) return { data, error: res.error.message };
    data.push(...((res.data ?? []) as T[]));
    if ((res.data?.length ?? 0) < PAGE) return { data, error: null };
  }
}

export const videoKey = (platform: string, id: string) => `${platform}:${id}`;

/** Every hourly snapshot of the given videos, oldest first. */
export async function loadHourly(
  supabase: Client,
  videos: { platform: SocialPlatform; external_id: string }[],
): Promise<{ rows: HourlyRow[]; error: string | null }> {
  const rows: HourlyRow[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    const ids = [...new Set(videos.filter((v) => v.platform === platform).map((v) => v.external_id))];
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const batch = ids.slice(i, i + ID_BATCH);
      const res = await selectAll<HourlyRow>((from, to) =>
        supabase
          .from("marketing_video_hourly")
          .select("*")
          .eq("platform", platform)
          .in("external_id", batch)
          .order("external_id")
          .order("captured_at")
          .range(from, to),
      );
      if (res.error) return { rows, error: res.error };
      rows.push(...res.data);
    }
  }
  return { rows, error: null };
}

/** Each video's curve, keyed by videoKey. */
export function curvesFor(
  videos: Pick<MarketingVideoRow, "platform" | "external_id" | "published_at">[],
  hourly: HourlyRow[],
): Record<string, VideoCurve> {
  const byVideo = new Map<string, HourlyRow[]>();
  for (const r of hourly) {
    const k = videoKey(r.platform, r.external_id);
    const list = byVideo.get(k);
    if (list) list.push(r);
    else byVideo.set(k, [r]);
  }
  const out: Record<string, VideoCurve> = {};
  for (const v of videos) {
    const k = videoKey(v.platform, v.external_id);
    out[k] = videoCurve(byVideo.get(k) ?? [], v.published_at);
  }
  return out;
}
