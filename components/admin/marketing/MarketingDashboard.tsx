"use client";

// /admin/marketing: a card per platform, views gained per day, and every video
// with its numbers. Sync now and Connect call the marketing-sync and
// marketing-oauth Edge Functions with the admin's session.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";
import { PLATFORM_THEME, PlatformLogo } from "./PlatformLogo";
import type {
  MarketingPlatform,
  MarketingReport,
  MarketingVideo,
} from "@/lib/admin/marketing";

export type MarketingAccount = {
  platform: MarketingPlatform;
  handle: string | null;
  connected_at: string;
  synced_at: string | null;
  last_error: string | null;
  logged_in: boolean;
};

const NAMES: Record<MarketingPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

const NOTICES: Record<string, string> = {
  expired: "That connect link expired or wasn't ours. Try Connect again.",
  declined: "The login was cancelled, so nothing was connected.",
  exchange:
    "The platform refused the login. Check the app's ID, secret and redirect address.",
};

type SortKey = "published_at" | "views" | "gained7" | "likes" | "comments";

const count = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : n.toLocaleString("en-GB");

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

async function callFunction(name: string, body?: unknown): Promise<Response> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function MarketingDashboard({
  report,
  accounts,
  notice,
  loadError,
}: {
  report: MarketingReport;
  accounts: MarketingAccount[];
  notice: { connected?: string; error?: string; platform?: string };
  loadError: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<MarketingPlatform | "all">("all");
  const [sort, setSort] = useState<SortKey>("published_at");

  const account = (p: MarketingPlatform) =>
    accounts.find((a) => a.platform === p);

  async function syncNow() {
    setSyncing(true);
    setMessage(null);
    const res = await callFunction("marketing-sync").catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setSyncing(false);
    if (!res?.ok || !body?.results) {
      setMessage(
        "Sync failed. Check the function is deployed and you're verified with MFA.",
      );
      return;
    }
    const failed = Object.entries(
      body.results as Record<string, string>,
    ).filter(([, r]) => r.startsWith("error"));
    setMessage(
      failed.length
        ? `Synced, with errors: ${failed.map(([p, r]) => `${p} ${r}`).join("; ")}`
        : "Synced.",
    );
    router.refresh();
  }

  async function connect(platform: "instagram" | "tiktok") {
    setMessage(null);
    const res = await callFunction("marketing-oauth", { platform }).catch(
      () => null,
    );
    const body = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !body?.url) {
      setMessage(`Couldn't start the ${NAMES[platform]} login.`);
      return;
    }
    window.location.assign(body.url);
  }

  const videos = useMemo(() => {
    const list = report.videos.filter(
      (v) => filter === "all" || v.platform === filter,
    );
    const value = (v: MarketingVideo) =>
      sort === "published_at" ? (v.published_at ?? "") : (v[sort] ?? -1);
    return [...list].sort((a, b) =>
      value(a) < value(b) ? 1 : value(a) > value(b) ? -1 : 0,
    );
  }, [report.videos, filter, sort]);

  const top = notice.connected
    ? `${NAMES[notice.connected as MarketingPlatform] ?? notice.connected} connected. Press Sync now to read its videos.`
    : notice.error
      ? (NOTICES[notice.error] ?? "Something went wrong connecting.")
      : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex -space-x-1">
            {(["youtube", "instagram", "tiktok"] as const).map((p) => (
              <PlatformLogo key={p} platform={p} size={18} />
            ))}
          </span>
          Marketing
          {report.firstDay && (
            <span className="ml-2 font-normal text-zinc-400">
              tracked since {report.firstDay}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          className="ml-auto rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {report.platforms.map((p) => {
              const acc = account(p.platform);
              const connectable = p.platform !== "youtube";
              return (
                <section
                  key={p.platform}
                  className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]"
                  style={{
                    backgroundImage: `linear-gradient(${PLATFORM_THEME[p.platform].tint}, transparent 70%)`,
                  }}
                >
                  <div
                    className="h-1"
                    style={{ background: PLATFORM_THEME[p.platform].bar }}
                  />
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <PlatformLogo platform={p.platform} size={22} />
                        {NAMES[p.platform]}
                        {acc?.handle && (
                          <span className="font-normal text-zinc-400">
                            {acc.handle}
                          </span>
                        )}
                      </h2>
                      {connectable && (
                        <button
                          type="button"
                          onClick={() =>
                            void connect(p.platform as "instagram" | "tiktok")
                          }
                          className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white hover:opacity-90"
                          style={{
                            background: PLATFORM_THEME[p.platform].accent,
                          }}
                        >
                          {acc?.logged_in ? "Reconnect" : "Connect"}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div title="Followers now, and the change over 30 days">
                        <p className="text-xs text-zinc-500">Followers</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {count(p.followers)}
                        </p>
                        {p.followersGained30 !== null && (
                          <p className="text-xs text-zinc-400">
                            {p.followersGained30 >= 0 ? "+" : ""}
                            {count(p.followersGained30)} in 30d
                          </p>
                        )}
                      </div>
                      <div title="Views gained in the last 7 days. A + means some videos were not tracked a week ago, so it is at least this.">
                        <p className="text-xs text-zinc-500">Views 7d</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {count(p.gained7)}
                          {p.partial7 && "+"}
                        </p>
                      </div>
                      <div title="Views gained in the last 30 days, and all-time views across tracked videos">
                        <p className="text-xs text-zinc-500">Views 30d</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {count(p.gained30)}
                          {p.partial30 && "+"}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {count(p.views)} all time
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      {p.videos} videos, synced {ago(acc?.synced_at ?? null)}
                      {acc?.last_error && (
                        <span className="text-red-600">
                          {" "}
                          - last sync failed: {acc.last_error}
                        </span>
                      )}
                      {connectable && !acc?.logged_in && " - not connected"}
                    </p>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-baseline justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">Views gained per day</h2>
              <span className="text-xs text-zinc-400">
                All platforms, last 30 days
              </span>
            </div>
            <div className="px-4 py-3">
              {report.firstDay ===
                report.daily[report.daily.length - 1]?.day && (
                <p className="mb-2 text-xs text-zinc-400">
                  A day&apos;s gain needs the day before it too, so this fills
                  in from the second day of tracking.
                </p>
              )}
              <ColumnChart
                name="Views gained per day"
                values={report.daily.map((d) => d.views)}
                labels={report.daily.map((d) => d.day.slice(8))}
                height={160}
              />
            </div>
          </section>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="mr-auto text-sm font-semibold">Videos</h2>
              {(["all", "youtube", "instagram", "tiktok"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                    filter === f
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-[var(--admin-border)] text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {f !== "all" && <PlatformLogo platform={f} size={14} />}
                  {f === "all" ? "All" : NAMES[f]}
                </button>
              ))}
            </div>
            {videos.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">
                No videos yet. Press Sync now once the platforms are set up.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Video</th>
                    {(
                      [
                        ["published_at", "Posted"],
                        ["views", "Views"],
                        ["gained7", "7d"],
                        ["likes", "Likes"],
                        ["comments", "Comments"],
                      ] as [SortKey, string][]
                    ).map(([k, label]) => (
                      <th key={k} className="px-3 py-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => setSort(k)}
                          className={
                            sort === k ? "text-zinc-900" : "hover:text-zinc-900"
                          }
                        >
                          {label}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v) => (
                    <tr
                      key={`${v.platform}:${v.external_id}`}
                      className="border-t border-[var(--admin-border)]"
                    >
                      <td className="max-w-md px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-16 shrink-0">
                            {v.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.thumbnail_url}
                                alt=""
                                className="h-10 w-16 rounded object-cover"
                              />
                            ) : (
                              <div
                                className="h-10 w-16 rounded"
                                style={{
                                  background: PLATFORM_THEME[v.platform].tint,
                                }}
                              />
                            )}
                            <span className="absolute -bottom-1 -right-1 rounded bg-white p-px shadow-sm">
                              <PlatformLogo platform={v.platform} size={14} />
                            </span>
                          </div>
                          <div className="min-w-0">
                            <a
                              href={v.url ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-zinc-900 hover:underline"
                            >
                              {v.title ?? "(untitled)"}
                            </a>
                            <span className="text-xs text-zinc-400">
                              {NAMES[v.platform]}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-500">
                        {v.published_at?.slice(0, 10) ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {count(v.views)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600">
                        {v.gained7 === null ? "-" : `+${count(v.gained7)}`}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {count(v.likes)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {count(v.comments)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {v.platform === "youtube" ? (
                          <span
                            title="YouTube's public API doesn't report shares"
                            className="text-zinc-400"
                          >
                            n/a
                          </span>
                        ) : (
                          count(v.shares)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
