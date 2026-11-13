"use client";

// /admin/marketing/experiments: a list of A/B tests and, for the one picked,
// its setup, the result per platform, the views curves and every member
// video. Results are worked out here from the curves the page loaded, so
// changing the metric shows its effect before saving.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import {
  deleteSocialExperiment,
  saveSocialExperiment,
  setExperimentVideo,
  type ExperimentDraft,
} from "@/app/admin/marketing/actions";
import type { MarketingVideoRow } from "@/lib/admin/marketing";
import {
  AGES_H,
  comparePlatform,
  METRIC_HOURS,
  metricValue,
  type ExperimentMember,
  type PlatformResult,
  type VideoCurve,
} from "@/lib/social/experiments";
import {
  METRIC_LABELS,
  PLATFORM_NAMES,
  SOCIAL_PLATFORMS,
  type ExperimentMetric,
  type ExperimentVideoRow,
  type SocialExperimentRow,
} from "@/lib/social/types";
import { VARIANT_COLORS, ViewsCurveChart } from "./ViewsCurveChart";

const KEYS = ["A", "B", "C", "D", "E"];

const blank = (): ExperimentDraft => ({
  id: null,
  name: "",
  hypothesis: "",
  metric: "views_24h",
  variants: [
    { key: "A", label: "" },
    { key: "B", label: "" },
  ],
  status: "running",
  winner: null,
  conclusion: "",
});

const toDraft = (e: SocialExperimentRow): ExperimentDraft => ({
  id: e.id,
  name: e.name,
  hypothesis: e.hypothesis ?? "",
  metric: e.metric,
  variants: e.variants,
  status: e.status,
  winner: e.winner,
  conclusion: e.conclusion ?? "",
});

const count = (n: number | null) => (n === null ? "-" : Math.round(n).toLocaleString("en-GB"));
const pct = (n: number | null) => (n === null ? "-" : `${(n * 100).toFixed(1)}%`);
const metricText = (n: number | null, metric: ExperimentMetric) =>
  metric === "engagement_7d" ? pct(n) : count(n);
const ageLabel = (h: number) => (h < 24 ? `${h}h` : `${h / 24}d`);

function Verdict({ r, metric, label }: { r: PlatformResult; metric: ExperimentMetric; label: (k: string) => string }) {
  const lift = r.lift === null ? "" : ` by ${Math.round(r.lift * 100)}%`;
  const age = METRIC_LABELS[metric].toLowerCase();
  if (r.verdict === "waiting")
    return <p className="text-zinc-500">Waiting for at least two variants to have {age}.</p>;
  if (r.verdict === "hint")
    return (
      <p>
        <strong>{label(r.leader!)}</strong> is ahead{lift}. With one video on a side this is a hint, not a
        result; post the test again (4 or more each) to know.
      </p>
    );
  if (r.verdict === "inconclusive")
    return (
      <p>
        <strong>{label(r.leader!)}</strong> is ahead{lift}, but a gap this size turns up by chance{" "}
        {Math.round(r.p! * 100)}% of the time with these videos. Keep testing.
      </p>
    );
  return (
    <p>
      <strong>{label(r.leader!)}</strong> wins{lift}. A gap this size turns up by chance only{" "}
      {Math.max(1, Math.round(r.p! * 100))}% of the time.
    </p>
  );
}

const field =
  "w-full rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

export function Experiments({
  experiments,
  members,
  videos,
  curves,
  selectedId,
  loadError,
}: {
  experiments: SocialExperimentRow[];
  members: ExperimentVideoRow[];
  videos: MarketingVideoRow[];
  curves: Record<string, VideoCurve>;
  selectedId: string | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(selectedId ?? experiments[0]?.id ?? null);
  const current = experiments.find((e) => e.id === selected) ?? null;
  const [draft, setDraft] = useState<ExperimentDraft>(current ? toDraft(current) : blank());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxHours, setMaxHours] = useState(72);
  const [search, setSearch] = useState("");
  const [addAs, setAddAs] = useState("A");

  // A different experiment picked, or fresh rows after a save: reset the form
  // during render (React's pattern for state that follows a prop).
  const formKey = `${selected}:${current?.updated_at ?? ""}`;
  const [shownKey, setShownKey] = useState(formKey);
  if (formKey !== shownKey) {
    setShownKey(formKey);
    setDraft(current ? toDraft(current) : blank());
  }

  const label = (key: string) => {
    const v = draft.variants.find((x) => x.key === key);
    return v?.label ? `${key}: ${v.label}` : key;
  };

  const mine: ExperimentMember[] = useMemo(() => {
    if (!draft.id) return [];
    return members
      .filter((m) => m.experiment_id === draft.id)
      .map((m) => {
        const v = videos.find((x) => x.platform === m.platform && x.external_id === m.external_id);
        const curve = curves[`${m.platform}:${m.external_id}`] ?? {
          ages: { 1: null, 6: null, 24: null, 72: null, 168: null },
          engagement7d: null,
          curve: [],
        };
        return {
          platform: m.platform,
          external_id: m.external_id,
          variant: m.variant,
          title: v?.title ?? null,
          url: v?.url ?? null,
          thumbnail_url: v?.thumbnail_url ?? null,
          published_at: v?.published_at ?? null,
          ...curve,
          value: metricValue(curve, draft.metric),
        };
      });
  }, [draft.id, draft.metric, members, videos, curves]);

  const platforms = SOCIAL_PLATFORMS.filter((p) => mine.some((m) => m.platform === p));
  const results = platforms.map((p) => comparePlatform(p, mine, draft.variants, draft.metric));

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return videos
      .filter((v) => !mine.some((m) => m.platform === v.platform && m.external_id === v.external_id))
      .filter((v) => (v.title ?? "").toLowerCase().includes(q) || v.external_id === q)
      .slice(0, 12);
  }, [search, videos, mine]);

  async function save() {
    setBusy(true);
    const res = await saveSocialExperiment(draft);
    setBusy(false);
    if (!res.ok) return setMessage(res.error ?? "Saving failed.");
    setMessage("Saved.");
    if (!draft.id && res.id) setSelected(res.id);
    router.refresh();
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete "${draft.name}"? The videos and their stats stay.`)) return;
    const res = await deleteSocialExperiment(draft.id);
    setMessage(res.ok ? "Deleted." : (res.error ?? "Delete failed."));
    setSelected(experiments.find((e) => e.id !== draft.id)?.id ?? null);
    router.refresh();
  }

  async function place(platform: ExperimentMember["platform"], id: string, variant: string | null) {
    if (!draft.id) return;
    const res = await setExperimentVideo(draft.id, platform, id, variant);
    if (!res.ok) setMessage(res.error ?? "Couldn't change that video.");
    router.refresh();
  }

  const setVariantLabel = (key: string, value: string) =>
    setDraft({ ...draft, variants: draft.variants.map((v) => (v.key === key ? { ...v, label: value } : v)) });

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">Experiments</h1>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setDraft(blank());
          }}
          className="ml-auto rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700"
        >
          New experiment
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row md:overflow-hidden">
        <nav className="shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] md:w-64 md:overflow-auto md:border-b-0 md:border-r">
          {experiments.length === 0 && !loadError && (
            <p className="px-4 py-4 text-xs text-zinc-500">
              No experiments yet. Make one, then tag planner posts or existing videos as A or B.
            </p>
          )}
          <ul>
            {experiments.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelected(e.id)}
                  className={`block w-full border-b border-[var(--admin-border)] px-4 py-2.5 text-left text-sm ${
                    e.id === selected ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {e.name}
                  <span className="block text-xs font-normal text-zinc-500">
                    {e.status === "concluded" ? `Concluded${e.winner ? `, ${e.winner} won` : ""}` : "Running"} ·{" "}
                    {members.filter((m) => m.experiment_id === e.id).length} videos
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-h-0 flex-1 md:overflow-auto">
          <div className="mx-auto max-w-5xl space-y-3 p-4">
            {(message || loadError) && (
              <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
                {loadError ? `Couldn't load: ${loadError}` : message}
              </p>
            )}

            <section className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Name</span>
                  <input className={field} value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Hook: question vs result first" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Decided by</span>
                  <select className={field} value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value as ExperimentMetric })}>
                    {(Object.keys(METRIC_LABELS) as ExperimentMetric[]).map((m) => (
                      <option key={m} value={m}>
                        {METRIC_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-600">What we think will happen</span>
                <textarea className={`${field} min-h-14`} value={draft.hypothesis ?? ""} onChange={(e) => setDraft({ ...draft, hypothesis: e.target.value })} />
              </label>
              <div className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Variants</span>
                {draft.variants.map((v) => (
                  <div key={v.key} className="flex items-center gap-2">
                    <span className="w-6 text-center font-semibold" style={{ color: VARIANT_COLORS[v.key] }}>
                      {v.key}
                    </span>
                    <input className={field} value={v.label} onChange={(e) => setVariantLabel(v.key, e.target.value)} placeholder="What is different about it" />
                  </div>
                ))}
                <div className="flex gap-3 text-xs">
                  {draft.variants.length < 5 && (
                    <button type="button" onClick={() => setDraft({ ...draft, variants: [...draft.variants, { key: KEYS[draft.variants.length], label: "" }] })} className="text-zinc-600 hover:text-zinc-900">
                      Add variant
                    </button>
                  )}
                  {draft.variants.length > 2 && (
                    <button type="button" onClick={() => setDraft({ ...draft, variants: draft.variants.slice(0, -1) })} className="text-zinc-500 hover:text-red-700">
                      Remove {draft.variants[draft.variants.length - 1].key}
                    </button>
                  )}
                </div>
              </div>
              {draft.id && (
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-zinc-600">Status</span>
                    <select className={field} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ExperimentDraft["status"] })}>
                      <option value="running">Running</option>
                      <option value="concluded">Concluded</option>
                    </select>
                  </label>
                  {draft.status === "concluded" && (
                    <>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-zinc-600">Winner</span>
                        <select className={field} value={draft.winner ?? ""} onChange={(e) => setDraft({ ...draft, winner: e.target.value || null })}>
                          <option value="">No clear winner</option>
                          {draft.variants.map((v) => (
                            <option key={v.key} value={v.key}>
                              {label(v.key)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1 md:col-span-3">
                        <span className="text-xs font-medium text-zinc-600">What we learned</span>
                        <textarea className={`${field} min-h-14`} value={draft.conclusion ?? ""} onChange={(e) => setDraft({ ...draft, conclusion: e.target.value })} />
                      </label>
                    </>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => void save()} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                  {busy ? "Saving..." : draft.id ? "Save" : "Create"}
                </button>
                {draft.id && (
                  <button type="button" onClick={() => void remove()} className="rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-xs text-zinc-500 hover:text-red-700">
                    Delete
                  </button>
                )}
              </div>
            </section>

            {draft.id && (
              <>
                {results.map((r) => {
                  const lines = mine
                    .filter((m) => m.platform === r.platform)
                    .map((m) => ({
                      id: `${m.platform}:${m.external_id}`,
                      label: `${m.variant} ${m.title ?? m.external_id}`,
                      series: m.variant,
                      curve: m.curve,
                    }));
                  return (
                    <section key={r.platform} className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="mr-auto flex items-center gap-2 font-semibold">
                          <PlatformLogo platform={r.platform} size={18} />
                          {PLATFORM_NAMES[r.platform]}
                        </h2>
                        {[72, 168].map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setMaxHours(h)}
                            className={`rounded-full border px-2.5 py-0.5 text-xs ${
                              maxHours === h ? "border-zinc-900 bg-zinc-900 text-white" : "border-[var(--admin-border)] text-zinc-500 hover:text-zinc-900"
                            }`}
                          >
                            First {h === 72 ? "3 days" : "7 days"}
                          </button>
                        ))}
                      </div>
                      <Verdict r={r} metric={draft.metric} label={label} />
                      <div className="flex flex-wrap gap-2">
                        {r.variants.map((v) => (
                          <div key={v.key} className="min-w-28 rounded-md border border-[var(--admin-border)] px-3 py-2" style={{ borderTopColor: VARIANT_COLORS[v.key], borderTopWidth: 3 }}>
                            <p className="text-xs text-zinc-500">{label(v.key)}</p>
                            <p className="text-lg font-semibold tabular-nums">{metricText(v.typical, draft.metric)}</p>
                            <p className="text-xs text-zinc-400">
                              {v.measured} of {v.videos} measured
                            </p>
                          </div>
                        ))}
                      </div>
                      <ViewsCurveChart
                        lines={lines}
                        maxHours={maxHours}
                        legend={draft.variants
                          .filter((v) => lines.some((l) => l.series === v.key))
                          .map((v) => ({ series: v.key, label: label(v.key) }))}
                      />
                    </section>
                  );
                })}

                <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
                    <h2 className="mr-auto text-sm font-semibold">Videos in this test</h2>
                    <span className="text-xs text-zinc-500">
                      {METRIC_LABELS[draft.metric]} decides; the typical value is a geometric mean, so one viral video does not swamp the rest.
                    </span>
                  </div>
                  {mine.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-zinc-500">
                      No videos yet. Tag a planner post with this experiment, or add a video below.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-zinc-500">
                          <tr>
                            <th className="px-4 py-2 font-medium">Video</th>
                            <th className="px-3 py-2 font-medium">Variant</th>
                            {AGES_H.map((h) => (
                              <th key={h} className={`px-3 py-2 text-right font-medium ${METRIC_HOURS[draft.metric] === h && draft.metric !== "engagement_7d" ? "text-zinc-900" : ""}`}>
                                {ageLabel(h)}
                              </th>
                            ))}
                            <th className={`px-3 py-2 text-right font-medium ${draft.metric === "engagement_7d" ? "text-zinc-900" : ""}`}>Eng. 7d</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {mine.map((m) => (
                            <tr key={`${m.platform}:${m.external_id}`} className="border-t border-[var(--admin-border)]">
                              <td className="max-w-xs px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <PlatformLogo platform={m.platform} size={14} />
                                  <Link href={`/admin/marketing/videos/${m.platform}/${encodeURIComponent(m.external_id)}`} className="truncate text-zinc-900 hover:underline">
                                    {m.title ?? m.external_id}
                                  </Link>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={m.variant}
                                  onChange={(e) => void place(m.platform, m.external_id, e.target.value)}
                                  className="rounded border border-[var(--admin-border)] bg-white px-1.5 py-0.5 text-xs"
                                  style={{ color: VARIANT_COLORS[m.variant] }}
                                >
                                  {draft.variants.map((v) => (
                                    <option key={v.key} value={v.key}>
                                      {v.key}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              {AGES_H.map((h) => (
                                <td key={h} className="px-3 py-2 text-right font-mono text-xs">
                                  {count(m.ages[h])}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right font-mono text-xs">{pct(m.engagement7d)}</td>
                              <td className="px-3 py-2 text-right">
                                <button type="button" onClick={() => void place(m.platform, m.external_id, null)} className="text-xs text-zinc-400 hover:text-red-700">
                                  remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="space-y-2 border-t border-[var(--admin-border)] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className={`${field} min-w-40 flex-1 sm:w-72 sm:flex-none`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a video to add by title" />
                      <span className="text-xs text-zinc-500">as</span>
                      <select value={addAs} onChange={(e) => setAddAs(e.target.value)} className="rounded border border-[var(--admin-border)] bg-white px-1.5 py-1 text-xs">
                        {draft.variants.map((v) => (
                          <option key={v.key} value={v.key}>
                            {v.key}
                          </option>
                        ))}
                      </select>
                    </div>
                    {candidates.map((v) => (
                      <button
                        key={`${v.platform}:${v.external_id}`}
                        type="button"
                        onClick={() => {
                          void place(v.platform, v.external_id, addAs);
                          setSearch("");
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-zinc-50"
                      >
                        <PlatformLogo platform={v.platform} size={14} />
                        <span className="truncate">{v.title ?? v.external_id}</span>
                        <span className="ml-auto shrink-0 text-xs text-zinc-400">{v.published_at?.slice(0, 10)}</span>
                      </button>
                    ))}
                    <p className="text-xs text-zinc-400">
                      Early numbers (1h to 7d) exist only for videos tracked hourly from when they went up, which is
                      every video since this feature shipped. Older videos show dashes there.
                    </p>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
