import type { createServerClient } from "@/lib/supabase/server";
import { fetchSearchConsole, googleAccessToken } from "@/lib/admin/search-console";
import { loadInsights } from "@/lib/social/load";
import {
  coverage,
  followersGained,
  periodWindow,
  windowTotals,
} from "@/lib/social/insights";
import type { MarketingPlatform } from "@/lib/admin/marketing";
import { USAGE_EPOCH } from "@/lib/admin/period";

// The "Before signup" box on /admin/analytics/funnel: what happens before
// anyone has an account, from four places, over the page's signup window.
// Totals only: none of these sources says who anyone is, and nothing here
// can be joined to an account.
//
//   Google search      Search Console totals (GOOGLE_SERVICE_ACCOUNT_JSON,
//                      the same key /admin/search uses)
//   Social videos      views and followers gained, from our own snapshots
//                      (lib/social, the numbers Social > Stats > Totals shows)
//   Website            visitors and page views from Vercel Web Analytics'
//                      query API (VERCEL_ANALYTICS_TOKEN, _PROJECT, _TEAM)
//   Chrome Web Store   installs, uninstalls, listing views and impressions
//                      from the store's v2 API, with the same Google service
//                      account (CWS_PUBLISHER_ID, NEXT_PUBLIC_EXTENSION_ID)
//
// A source without its settings reports "off" with what to set, and one that
// fails reports its error; neither stops the rest of the page.

export type Outside<T> =
  | { state: "ok"; value: T; note?: string }
  | { state: "off"; setup: string }
  | { state: "error"; message: string };

export type BeforeSignup = {
  search: Outside<{ clicks: number; impressions: number }>;
  social: Outside<{ views: number; followers: number | null }>;
  website: Outside<{ visitors: number; pageviews: number }>;
  store: Outside<{
    installs: number;
    uninstalls: number;
    pageViews: number;
    impressions: number;
  }>;
};

type Client = Awaited<ReturnType<typeof createServerClient>>;

const DAY_MS = 86_400_000;
// Search Console keeps 16 months; "all time" asks for just under that.
const SEARCH_MAX_DAYS = 480;
const CWS_SCOPE = "https://www.googleapis.com/auth/chromewebstore.readonly";

async function settle<T>(
  setup: string | null,
  run: () => Promise<{ value: T; note?: string }>,
): Promise<Outside<T>> {
  if (setup) return { state: "off", setup };
  try {
    return { state: "ok", ...(await run()) };
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function loadBeforeSignup(
  supabase: Client,
  days: number | null,
  now = new Date(),
): Promise<BeforeSignup> {
  const env = process.env;
  const today = isoDay(now.getTime());
  const from = days === null ? USAGE_EPOCH : isoDay(now.getTime() - (days - 1) * DAY_MS);

  const [search, social, website, store] = await Promise.all([
    settle(env.GOOGLE_SERVICE_ACCOUNT_JSON ? null : "GOOGLE_SERVICE_ACCOUNT_JSON", async () => {
      const res = await fetchSearchConsole(days ?? SEARCH_MAX_DAYS, [], now);
      const row = res.rows[0];
      return {
        value: { clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0 },
        note: `${res.startDate} to ${res.endDate}`,
      };
    }),

    settle(null, async () => {
      const load = await loadInsights(supabase);
      if (load.error) throw new Error(load.error);
      const data = load.data;
      const w =
        days === null
          ? { from: data.days[0] ?? today, to: data.today }
          : periodWindow(data.today, days);
      const platforms = Object.keys(data.daily) as MarketingPlatform[];
      const gained = platforms
        .map((p) => followersGained(data, p, w))
        .filter((n): n is number => n !== null);
      const cover = coverage(data, w);
      return {
        value: {
          views: windowTotals(data, platforms, w).views,
          followers: gained.length ? gained.reduce((s, n) => s + n, 0) : null,
        },
        note:
          cover === "none"
            ? "no snapshots in this window"
            : cover === "partial" && data.measuredFrom
              ? `since ${data.measuredFrom}, when tracking began`
              : undefined,
      };
    }),

    settle(
      env.VERCEL_ANALYTICS_TOKEN && env.VERCEL_ANALYTICS_PROJECT
        ? null
        : "VERCEL_ANALYTICS_TOKEN and VERCEL_ANALYTICS_PROJECT",
      async () => {
        const url = new URL("https://api.vercel.com/v1/query/web-analytics/visits/count");
        url.searchParams.set("projectId", env.VERCEL_ANALYTICS_PROJECT!);
        if (env.VERCEL_ANALYTICS_TEAM) url.searchParams.set("teamId", env.VERCEL_ANALYTICS_TEAM);
        // No `since` for all time: the count then starts when Web Analytics did.
        if (days !== null) url.searchParams.set("since", from);
        url.searchParams.set("until", now.toISOString());
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${env.VERCEL_ANALYTICS_TOKEN}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Vercel Web Analytics (${res.status}): ${await res.text()}`);
        const json = (await res.json()) as { data?: { pageviews?: number; visitors?: number } };
        return {
          value: { visitors: json.data?.visitors ?? 0, pageviews: json.data?.pageviews ?? 0 },
        };
      },
    ),

    settle(
      env.GOOGLE_SERVICE_ACCOUNT_JSON && env.CWS_PUBLISHER_ID && env.NEXT_PUBLIC_EXTENSION_ID
        ? null
        : "CWS_PUBLISHER_ID (with GOOGLE_SERVICE_ACCOUNT_JSON added in the Chrome Web Store dashboard)",
      async () => ({
        value: await fetchStoreMetrics(from, today),
        note: `${from} to ${today}`,
      }),
    ),
  ]);

  return { search, social, website, store };
}

// Store metrics summed over the window. The API returns one row per day, with
// each metric's value as a string, a page at a time.
async function fetchStoreMetrics(from: string, to: string) {
  const name = `publishers/${process.env.CWS_PUBLISHER_ID}/items/${process.env.NEXT_PUBLIC_EXTENSION_ID}`;
  const token = await googleAccessToken(CWS_SCOPE);
  const totals: Record<string, number> = {};
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://chromewebstore.googleapis.com/v2/${name}:queryMetrics`);
    for (const [key, day] of [["firstDate", from], ["lastDate", to]] as const) {
      const [y, m, d] = day.split("-").map(Number);
      url.searchParams.set(`timeSpec.${key}.year`, String(y));
      url.searchParams.set(`timeSpec.${key}.month`, String(m));
      url.searchParams.set(`timeSpec.${key}.day`, String(d));
    }
    for (const metric of ["installs", "uninstalls", "page-views", "impressions"])
      url.searchParams.append("metrics", metric);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Chrome Web Store (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as {
      metricRows?: { metricValues?: { metric: string; value?: string }[] }[];
      nextPageToken?: string;
    };
    for (const row of json.metricRows ?? [])
      for (const v of row.metricValues ?? [])
        totals[v.metric] = (totals[v.metric] ?? 0) + Number(v.value ?? 0);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return {
    installs: totals.installs ?? 0,
    uninstalls: totals.uninstalls ?? 0,
    pageViews: totals["page-views"] ?? 0,
    impressions: totals.impressions ?? 0,
  };
}
