"use client";

// /admin/marketing, the Stats overview. Top to bottom it answers: are we doing
// better (every recent post against our typical one, and the period's health),
// where (each platform), and which posts (every video, with its tags). Totals
// that only ever go up, followers and lifetime views, sit at the bottom with
// the accounts. The arithmetic is lib/social/overview.ts; docs/SOCIAL.md
// "Stats" explains the index.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  callFunction,
  connectNotice,
  connectPlatform,
} from "@/components/admin/social/client";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";
import { changeClass, IndexBadge, indexDotClass } from "@/components/admin/social/IndexBadge";
import { LocalTime } from "@/components/admin/social/LocalTime";
import { TagDrawer } from "@/components/admin/social/TagDrawer";
import { TagChips } from "@/components/admin/social/TagEditor";
import { PlatformLogo } from "./PlatformLogo";
import type { MarketingPlatform, MarketingReport } from "@/lib/admin/marketing";
import { median } from "@/lib/social/experiments";
import {
  AGE_LABELS,
  bestIndex,
  formatIndex,
  health,
  postRows,
  strip,
  type HealthKey,
  type IndexAge,
  type OverviewRow,
  type OverviewVideo,
  type Typical,
} from "@/lib/social/overview";
import { formatLength, isTagged, tagLabels, tagOptions } from "@/lib/social/tags";

export type MarketingAccount = {
  platform: MarketingPlatform;
  handle: string | null;
  connected_at: string;
  synced_at: string | null;
  last_error: string | null;
  logged_in: boolean;
  scopes: string | null;
};

const PLATFORMS: MarketingPlatform[] = ["youtube", "instagram", "tiktok", "facebook"];

const NAMES: Record<MarketingPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

// Mirrors POSTING_SCOPE in supabase/functions/_shared/marketing-login.ts.
const POSTING_SCOPE: Record<MarketingPlatform, string> = {
  youtube: "youtube.upload",
  instagram: "instagram_content_publish",
  tiktok: "video.upload",
  facebook: "pages_manage_posts",
};

const DAY_MS = 86_400_000;
const PERIODS = [7, 30, 90] as const;
const PAGE_ROWS = 50;

const count = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : Math.round(n).toLocaleString("en-GB");

const oneDecimal = (n: number | null) => (n === null ? "-" : n.toFixed(1));

const HEALTH: Record<
  HealthKey,
  { name: string; hint: string; format: (x: number) => string; change: "ratio" | "points" }
> = {
  index: {
    name: "Typical post",
    hint: "The middle post's views against our usual on its platform",
    format: formatIndex,
    change: "ratio",
  },
  watched: {
    name: "Watched",
    hint: "Average share of each video watched, where the platform tells us",
    format: (x) => `${Math.round(x)}%`,
    change: "points",
  },
  shares: {
    name: "Shares per 1,000 views",
    hint: "People sending it on, the strongest sign it landed",
    format: (x) => x.toFixed(1),
    change: "ratio",
  },
  saves: {
    name: "Saves per 1,000 views",
    hint: "Instagram only for now",
    format: (x) => x.toFixed(1),
    change: "ratio",
  },
  follows: {
    name: "Subscribers per 1,000 views",
    hint: "YouTube only: the others don't report follows per video",
    format: (x) => x.toFixed(1),
    change: "ratio",
  },
};

function changeOf(key: HealthKey, now: number | null, before: number | null): { text: string; value: number | null } {
  if (now === null || before === null) return { text: "-", value: null };
  if (HEALTH[key].change === "points") {
    const d = Math.round(now - before);
    return { text: `${d > 0 ? "+" : ""}${d} pts`, value: d };
  }
  if (before <= 0) return { text: "-", value: null };
  const pct = Math.round((now / before - 1) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, value: pct };
}

/** Where an index sits on the strip: a log scale from 0.25x to 4x, typical in the middle. */
const stripLeft = (x: number) => `${Math.max(0, Math.min(100, ((Math.log2(x) + 2) / 4) * 100))}%`;

const videoHref = (v: Pick<OverviewVideo, "platform" | "external_id">) =>
  `/admin/marketing/videos/${v.platform}/${encodeURIComponent(v.external_id)}`;

/** The same, from a "platform:id" key. */
const keyHref = (key: string) => {
  const i = key.indexOf(":");
  return `/admin/marketing/videos/${key.slice(0, i)}/${encodeURIComponent(key.slice(i + 1))}`;
};

function chip(on: boolean) {
  return `flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
    on ? "border-zinc-900 bg-zinc-900 text-white" : "border-[var(--admin-border)] text-zinc-500 hover:text-zinc-900"
  }`;
}

export function MarketingDashboard({
  report,
  accounts,
  videos,
  typical,
  nowMs,
  notice,
  loadError,
  indexError,
}: {
  report: MarketingReport;
  accounts: MarketingAccount[];
  videos: OverviewVideo[];
  typical: Typical;
  nowMs: number;
  notice: { connected?: string; error?: string; platform?: string; seen?: string; ig?: string; diag?: string };
  loadError: string | null;
  indexError: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [age, setAge] = useState<IndexAge>(168);
  const [filter, setFilter] = useState<MarketingPlatform | "all">("all");
  const [sort, setSort] = useState<"new" | "best">("new");
  const [showAll, setShowAll] = useState(false);
  const [tagging, setTagging] = useState<OverviewRow[] | null>(null);

  const account = (p: MarketingPlatform) => accounts.find((a) => a.platform === p);
  const ago = (iso: string | null) => {
    if (!iso) return "never";
    const mins = Math.round((nowMs - Date.parse(iso)) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  async function syncNow() {
    setSyncing(true);
    setMessage(null);
    const res = await callFunction("marketing-sync").catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setSyncing(false);
    if (!res?.ok || !body?.results) {
      setMessage("Sync failed. Check the function is deployed and you're verified with MFA.");
      return;
    }
    const failed = Object.entries(body.results as Record<string, string>).filter(([, r]) => r.startsWith("error"));
    setMessage(failed.length ? `Synced, with errors: ${failed.map(([p, r]) => `${p} ${r}`).join("; ")}` : "Synced.");
    router.refresh();
  }

  async function connect(platform: MarketingPlatform) {
    setMessage(null);
    setMessage(await connectPlatform(platform));
  }

  const rows = useMemo(() => postRows(videos), [videos]);
  const options = useMemo(() => tagOptions(rows.map((r) => r.tags)), [rows]);
  const stripRows = useMemo(() => strip(videos, { nowMs, days, age }), [videos, nowMs, days, age]);
  const healthRows = useMemo(() => health(videos, { nowMs, days, age }), [videos, nowMs, days, age]);

  const since = nowMs - days * DAY_MS;
  const windowRows = rows.filter((r) => r.publishedAt && Date.parse(r.publishedAt) >= since);
  const scored = windowRows
    .map((r) =>
      median(
        Object.values(r.videos)
          .map((v) => v?.index[age] ?? null)
          .filter((x): x is number => x !== null),
      ),
    )
    .filter((x): x is number => x !== null);
  const best = videos
    .filter((v) => v.published_at && Date.parse(v.published_at) >= since && v.index[age] !== null)
    .sort((a, b) => b.index[age]! - a.index[age]!)[0];

  const headline =
    windowRows.length === 0
      ? `Nothing posted in the last ${days} days.`
      : scored.length === 0
        ? `${windowRows.length} post${windowRows.length === 1 ? "" : "s"} in the last ${days} days, none old enough to compare at ${AGE_LABELS[age]} yet.`
        : `${windowRows.length} post${windowRows.length === 1 ? "" : "s"} in the last ${days} days. ${scored.filter((x) => x > 1).length} of the ${scored.length} we can compare did better than usual.`;

  const listed = useMemo(() => {
    const mine = rows.filter((r) => filter === "all" || r.videos[filter]);
    if (sort === "new") return mine;
    return [...mine].sort((a, b) => (bestIndex(b, age) ?? -1) - (bestIndex(a, age) ?? -1));
  }, [rows, filter, sort, age]);
  const untagged = rows.filter((r) => !isTagged(r.tags));

  const top = connectNotice(notice);

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex -space-x-1">
            {PLATFORMS.map((p) => (
              <PlatformLogo key={p} platform={p} size={18} />
            ))}
          </span>
          Stats
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="Period">
          {PERIODS.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={chip(days === d)}>
              {d} days
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Compare at">
          {([24, 168] as IndexAge[]).map((a) => (
            <button key={a} type="button" aria-pressed={age === a} onClick={() => setAge(a)} className={chip(age === a)}>
              At {AGE_LABELS[a]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          className="rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-3 p-4">
          {(top || message || loadError) && (
            <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
              {loadError ? `Couldn't load: ${loadError}` : (message ?? top)}
            </p>
          )}
          {indexError && (
            <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
              The comparison with our typical post needs migration 054_social_tags.sql ({indexError}).
            </p>
          )}

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-5">
            <h2 className="max-w-3xl text-xl font-semibold leading-snug tracking-tight">{headline}</h2>
            {best && (
              <p className="mt-1 text-sm text-zinc-600">
                Best:{" "}
                <Link href={videoHref(best)} className="text-zinc-900 hover:underline">
                  {best.postName ?? best.title ?? "(untitled)"}
                </Link>{" "}
                on {NAMES[best.platform]}, {formatIndex(best.index[age])}.
              </p>
            )}
            <p className="mt-1 max-w-3xl text-xs text-zinc-500">
              Each dot is one post, placed by its views at {AGE_LABELS[age]} against our typical post on the same
              platform at the same age. Right of the line did better than usual.
            </p>

            <div className="mt-4 space-y-1">
              {stripRows.map((r) => (
                <div key={r.platform} className="flex items-center gap-3">
                  <span className="flex w-24 shrink-0 items-center gap-2 text-xs">
                    <PlatformLogo platform={r.platform} size={16} />
                    {NAMES[r.platform]}
                  </span>
                  <div className="relative h-9 flex-1 border-b border-[var(--admin-border)]">
                    <span className="absolute inset-y-1 left-1/2 w-px bg-zinc-300" aria-hidden />
                    {r.dots.map((d) => (
                      <Link
                        key={d.key}
                        href={keyHref(d.key)}
                        title={`${d.title}: ${formatIndex(d.index)}`}
                        aria-label={`${d.title}, ${formatIndex(d.index)}`}
                        className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--admin-surface)] hover:scale-125 ${indexDotClass(d.index)}`}
                        style={{ left: stripLeft(d.index) }}
                      />
                    ))}
                    {r.median !== null && (
                      <span
                        className="absolute inset-y-2 w-0.5 -translate-x-1/2 rounded bg-zinc-900"
                        style={{ left: stripLeft(r.median) }}
                        aria-hidden
                      />
                    )}
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs text-zinc-500">
                    {r.median !== null ? (
                      <>
                        middle <span className="font-semibold text-zinc-900">{formatIndex(r.median)}</span>
                      </>
                    ) : r.posts ? (
                      `${r.posts} too new`
                    ) : (
                      "no posts"
                    )}
                  </span>
                </div>
              ))}
              <div className="flex gap-3 text-[11px] text-zinc-500">
                <span className="w-24 shrink-0" />
                <div className="relative h-4 flex-1">
                  <span className="absolute left-0">0.25x</span>
                  <span className="absolute left-1/4 -translate-x-1/2">0.5x</span>
                  <span className="absolute left-1/2 -translate-x-1/2 text-zinc-700">typical</span>
                  <span className="absolute left-3/4 -translate-x-1/2">2x</span>
                  <span className="absolute right-0">4x</span>
                </div>
                <span className="w-28 shrink-0" />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-3">
              <div className="flex items-baseline justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
                <h2 className="text-sm font-semibold">Health</h2>
                <span className="text-xs text-zinc-400">Last {days} days against the {days} before</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Measure</th>
                      <th className="px-3 py-2 text-right font-medium">Now</th>
                      <th className="px-3 py-2 text-right font-medium">Before</th>
                      <th className="px-4 py-2 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthRows.map((h) => {
                      const meta = HEALTH[h.key];
                      const change = changeOf(h.key, h.now, h.before);
                      return (
                        <tr key={h.key} className="border-t border-[var(--admin-border)]">
                          <td className="px-4 py-2">
                            <div className="font-medium text-zinc-900">{meta.name}</div>
                            <div className="text-xs text-zinc-500">{meta.hint}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-base font-semibold tabular-nums">
                              {h.now === null ? "-" : meta.format(h.now)}
                            </span>
                            {h.nNow > 0 && (
                              <div className="text-[11px] text-zinc-400">
                                {h.nNow} video{h.nNow === 1 ? "" : "s"}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                            {h.before === null ? "-" : meta.format(h.before)}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium tabular-nums ${changeClass(change.value)}`}>
                            {change.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-2">
              <div className="flex items-baseline justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
                <h2 className="text-sm font-semibold">By platform</h2>
                <span className="text-xs text-zinc-400">At {AGE_LABELS[age]}</span>
              </div>
              <ul>
                {stripRows.map((r) => {
                  const typ = typical[r.platform][age];
                  const bestDot = r.dots.slice().sort((a, b) => b.index - a.index)[0];
                  return (
                    <li key={r.platform} className="space-y-1 border-t border-[var(--admin-border)] px-4 py-2.5 first:border-t-0">
                      <div className="flex items-center gap-2 text-sm">
                        <PlatformLogo platform={r.platform} size={16} />
                        <span className="font-medium">{NAMES[r.platform]}</span>
                        <span className="text-xs text-zinc-400">
                          {r.posts} post{r.posts === 1 ? "" : "s"}
                        </span>
                        <span className="ml-auto">
                          <IndexBadge value={r.median} title="The middle post in this period" />
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {typ.views !== null
                          ? `Usually ${count(typ.views)} views at ${AGE_LABELS[age]}, from our last ${typ.videos}.`
                          : "Not enough history yet to say what's usual."}
                        {bestDot && (
                          <>
                            {" "}
                            Best:{" "}
                            <Link href={keyHref(bestDot.key)} className="text-zinc-700 hover:underline">
                              {bestDot.title}
                            </Link>
                            , {formatIndex(bestDot.index)}.
                          </>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="mr-auto text-sm font-semibold">Posts</h2>
              {(["all", ...PLATFORMS] as const).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>
                  {f !== "all" && <PlatformLogo platform={f} size={14} />}
                  {f === "all" ? "All" : NAMES[f]}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--admin-border)]" aria-hidden />
              <button type="button" aria-pressed={sort === "new"} onClick={() => setSort("new")} className={chip(sort === "new")}>
                Newest
              </button>
              <button type="button" aria-pressed={sort === "best"} onClick={() => setSort("best")} className={chip(sort === "best")}>
                Best
              </button>
              {untagged.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTagging(untagged)}
                  className="rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-700 hover:text-zinc-900"
                >
                  Tag untagged videos ({untagged.length})
                </button>
              )}
            </div>
            {listed.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">No videos yet. Press Sync now once the platforms are set up.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Post</th>
                      <th className="px-3 py-2 text-left font-medium">Posted</th>
                      <th className="px-3 py-2 text-right font-medium">Length</th>
                      {PLATFORMS.map((p) => (
                        <th key={p} className="px-2 py-2 text-center font-medium" title={`${NAMES[p]}, against typical at ${AGE_LABELS[age]}`}>
                          <span className="inline-flex">
                            <PlatformLogo platform={p} size={16} />
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium" title="Average share of the video watched">
                        Watched
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Shares /1k</th>
                      <th className="px-3 py-2 text-right font-medium" title="YouTube subscribers gained per 1,000 views">
                        Subs /1k
                      </th>
                      <th className="px-4 py-2 text-right font-medium">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAll ? listed : listed.slice(0, PAGE_ROWS)).map((r) => (
                      <tr key={r.id} className="border-t border-[var(--admin-border)] align-top">
                        <td className="max-w-md px-4 py-2">
                          <div className="flex gap-3">
                            {r.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.thumbnail} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                            ) : (
                              <div className="h-12 w-9 shrink-0 rounded bg-zinc-100" />
                            )}
                            <div className="min-w-0 space-y-1">
                              <Link
                                href={videoHref({ platform: r.tagTarget.platform, external_id: r.tagTarget.externalId })}
                                className="line-clamp-2 text-zinc-900 hover:underline"
                              >
                                {r.title}
                              </Link>
                              <TagChips
                                picked={tagLabels(r.tags)}
                                auto={r.auto.filter((t) => t !== formatLength(r.seconds))}
                              />
                              <button
                                type="button"
                                onClick={() => setTagging([r])}
                                className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                              >
                                {isTagged(r.tags) ? "Edit tags" : "Add tags"}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                          {r.publishedAt ? <LocalTime iso={r.publishedAt} weekday /> : "-"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-zinc-500">{formatLength(r.seconds) ?? "-"}</td>
                        {PLATFORMS.map((p) => {
                          const v = r.videos[p];
                          return (
                            <td key={p} className="px-2 py-2 text-center">
                              {v && (
                                <IndexBadge
                                  value={v.index[age]}
                                  href={videoHref(v)}
                                  title={`${NAMES[p]}: ${count(v.at[age])} views at ${AGE_LABELS[age]}, ${count(v.views)} now`}
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.watched === null ? "-" : `${Math.round(r.watched)}%`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{oneDecimal(r.shares1k)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{oneDecimal(r.follows1k)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{count(r.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--admin-border)] px-4 py-2.5 text-xs text-zinc-500">
              <span>
                Badges are views at {AGE_LABELS[age]} against our typical post on that platform. Dashed tags are read
                automatically.
              </span>
              {!showAll && listed.length > PAGE_ROWS && (
                <button type="button" onClick={() => setShowAll(true)} className="ml-auto text-zinc-700 hover:text-zinc-900 hover:underline">
                  Show all {listed.length}
                </button>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-baseline justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">Accounts</h2>
              <span className="text-xs text-zinc-400">Totals only go up, so they live down here</span>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              {report.platforms.map((p) => {
                const acc = account(p.platform);
                const canPost = !!acc?.scopes?.includes(POSTING_SCOPE[p.platform]);
                return (
                  <div key={p.platform} className="space-y-1 rounded-lg border border-[var(--admin-border)] px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <PlatformLogo platform={p.platform} size={18} />
                      <span className="font-medium">{NAMES[p.platform]}</span>
                      {acc?.handle && <span className="truncate text-xs text-zinc-400">{acc.handle}</span>}
                      <button
                        type="button"
                        onClick={() => void connect(p.platform)}
                        className="ml-auto rounded-md border border-[var(--admin-border)] px-2 py-0.5 text-xs text-zinc-600 hover:text-zinc-900"
                      >
                        {acc?.logged_in && canPost ? "Reconnect" : acc?.logged_in ? "Reconnect to post" : "Connect"}
                      </button>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {count(p.followers)} <span className="text-xs font-normal text-zinc-500">followers</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {p.followersGained30 !== null && (
                        <>
                          {p.followersGained30 >= 0 ? "+" : ""}
                          {count(p.followersGained30)} in 30 days.{" "}
                        </>
                      )}
                      {p.videos} videos, {count(p.views)} views all time. Synced {ago(acc?.synced_at ?? null)}.
                    </p>
                    {acc?.last_error && <p className="text-xs text-red-600">Last sync failed: {acc.last_error}</p>}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[var(--admin-border)] px-4 py-3">
              <p className="mb-2 text-xs text-zinc-500">Views gained per day, all platforms, last 30 days</p>
              <ColumnChart
                name="Views gained per day"
                values={report.daily.map((d) => d.views)}
                labels={report.daily.map((d) => d.day.slice(8))}
                height={140}
              />
            </div>
          </section>
        </div>
      </div>

      {tagging && <TagDrawer queue={tagging} options={options} onClose={() => setTagging(null)} />}
    </div>
  );
}
