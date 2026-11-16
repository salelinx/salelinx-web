"use client";

// The planner's editor: one video, a time, and per platform its caption and
// options. The video uploads to the private bucket as soon as it is picked;
// an upload that never gets saved (cancelled, or replaced) is deleted again.

import { useEffect, useRef, useState } from "react";
import { PlatformLogo, PLATFORM_THEME } from "@/components/admin/marketing/PlatformLogo";
import {
  discardSocialUpload,
  saveSocialPost,
  type PostDraft,
} from "@/app/admin/marketing/actions";
import {
  canPost,
  PLATFORM_NAMES,
  SOCIAL_PLATFORMS,
  type InstagramOptions,
  type SocialAccount,
  type SocialExperimentRow,
  type SocialPlatform,
  type SocialPost,
  type YouTubeOptions,
} from "@/lib/social/types";
import {
  hashtagCount,
  LIMITS,
  postWarnings,
  scheduleProblems,
  targetProblems,
} from "@/lib/social/validate";
import { useClientNow } from "@/lib/admin/use-client-now";
import { megabytes, signedUrl, uploadPath, uploadToBucket } from "./client";

type TargetForm = {
  enabled: boolean;
  title: string;
  caption: string;
  privacy: NonNullable<YouTubeOptions["privacy"]>;
  tags: string;
  madeForKids: boolean;
  notifySubscribers: boolean;
  trial: NonNullable<InstagramOptions["trial"]>;
  shareToFeed: boolean;
};

type FileRef = { path: string; bytes: number | null; type: string | null; label?: string };

export type EditorState = {
  id: string | null;
  name: string;
  media: FileRef | null;
  cover: FileRef | null;
  // A datetime-local value, in the viewer's time zone.
  when: string;
  experimentId: string | null;
  variant: string | null;
  notes: string;
  targets: Record<SocialPlatform, TargetForm>;
};

const blankTarget = (enabled = false): TargetForm => ({
  enabled,
  title: "",
  caption: "",
  privacy: "public",
  tags: "",
  madeForKids: false,
  notifySubscribers: true,
  trial: "off",
  shareToFeed: true,
});

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** A blank post, with the platforms that can post already ticked. */
export function newEditor(accounts: SocialAccount[]): EditorState {
  const ready = (p: SocialPlatform) => canPost(accounts.find((a) => a.platform === p));
  return {
    id: null,
    name: "",
    media: null,
    cover: null,
    when: "",
    experimentId: null,
    variant: null,
    notes: "",
    targets: {
      youtube: blankTarget(ready("youtube")),
      instagram: blankTarget(ready("instagram")),
      tiktok: blankTarget(ready("tiktok")),
      facebook: blankTarget(ready("facebook")),
    },
  };
}

export function editorFromPost(p: SocialPost): EditorState {
  const targets = {
    youtube: blankTarget(),
    instagram: blankTarget(),
    tiktok: blankTarget(),
    facebook: blankTarget(),
  };
  for (const t of p.targets) {
    targets[t.platform] = {
      ...blankTarget(true),
      title: t.title ?? "",
      caption: t.caption ?? "",
      privacy: t.options.privacy ?? "public",
      tags: (t.options.tags ?? []).join(", "),
      madeForKids: t.options.madeForKids ?? false,
      notifySubscribers: t.options.notifySubscribers ?? true,
      trial: t.options.trial ?? "off",
      shareToFeed: t.options.shareToFeed ?? true,
    };
  }
  return {
    id: p.id,
    name: p.name,
    media: p.media_path ? { path: p.media_path, bytes: p.media_bytes, type: p.media_type } : null,
    cover: p.cover_path ? { path: p.cover_path, bytes: null, type: null } : null,
    when: toLocalInput(p.scheduled_at),
    experimentId: p.experiment_id,
    variant: p.variant,
    notes: p.notes ?? "",
    targets,
  };
}

const tagList = (tags: string) =>
  tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** Everything that would make marketing-publish fail, checked before saving. */
function problemsBeforePosting(
  s: EditorState,
  enabled: SocialPlatform[],
  accounts: SocialAccount[],
  scheduledAt: string | null,
  now: boolean,
): string[] {
  return [
    ...scheduleProblems({
      hasMedia: !!s.media,
      platforms: enabled,
      scheduledAt,
      now,
      nowMs: Date.now(),
    }),
    ...enabled.flatMap((p) =>
      targetProblems(
        { platform: p, title: s.targets[p].title, caption: s.targets[p].caption },
        tagList(s.targets[p].tags),
      ),
    ),
    ...enabled
      .filter((p) => !canPost(accounts.find((a) => a.platform === p)))
      .map((p) => `${PLATFORM_NAMES[p]} can't post yet: Connect or Reconnect it on the Stats tab.`),
    ...(s.experimentId && !s.variant ? ["Pick which variant this post is."] : []),
  ];
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={n > max ? "text-red-600" : "text-zinc-400"}>{n}/{max}</span>;
}

const field =
  "w-full rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

export function PostEditor({
  initial,
  experiments,
  accounts,
  onClose,
  onSaved,
}: {
  initial: EditorState;
  experiments: SocialExperimentRow[];
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: (message: string, postNow: boolean) => void | Promise<void>;
}) {
  const [s, setS] = useState<EditorState>(initial);
  const now = useClientNow();
  const [upload, setUpload] = useState<{ kind: "video" | "cover"; progress: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Files uploaded in this editor and not yet saved, deleted if they never are.
  const fresh = useRef<string[]>([]);

  const enabled = SOCIAL_PLATFORMS.filter((p) => s.targets[p].enabled);
  const experiment = experiments.find((e) => e.id === s.experimentId) ?? null;

  useEffect(() => {
    let live = true;
    if (s.media && !preview?.startsWith("blob:")) {
      void signedUrl(s.media.path).then((url) => live && setPreview(url));
    }
    return () => {
      live = false;
    };
    // Only when the saved video changes; a fresh pick sets its own blob URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.media?.path]);

  const setTarget = (p: SocialPlatform, patch: Partial<TargetForm>) =>
    setS((prev) => ({ ...prev, targets: { ...prev.targets, [p]: { ...prev.targets[p], ...patch } } }));

  async function pick(kind: "video" | "cover", file: File | undefined) {
    if (!file) return;
    const path = uploadPath(kind === "video" ? "videos" : "covers", file.name);
    setUpload({ kind, progress: 0 });
    setProblems([]);
    try {
      await uploadToBucket(file, path, (progress) => setUpload({ kind, progress }));
    } catch (err) {
      setUpload(null);
      setProblems([`Upload failed: ${(err as Error).message}`]);
      return;
    }
    setUpload(null);
    fresh.current.push(path);
    const ref: FileRef = { path, bytes: file.size, type: file.type || null, label: file.name };
    if (kind === "video") {
      setPreview(URL.createObjectURL(file));
      setS((prev) => ({ ...prev, media: ref, name: prev.name || file.name.replace(/\.[^.]+$/, "") }));
    } else {
      setS((prev) => ({ ...prev, cover: ref }));
    }
  }

  const discard = (paths: (string | undefined)[]) =>
    Promise.all(paths.filter((p): p is string => !!p).map((p) => discardSocialUpload(p)));

  async function cancel() {
    await discard(fresh.current);
    onClose();
  }

  const warnings =
    now === null
      ? []
      : postWarnings({
          platforms: enabled,
          mediaBytes: s.media?.bytes ?? null,
          scheduledAt: fromLocalInput(s.when),
          now,
        });

  async function save(mode: "draft" | "schedule" | "now") {
    const scheduledAt = mode === "now" ? new Date().toISOString() : fromLocalInput(s.when);
    if (mode !== "draft") {
      const found = problemsBeforePosting(s, enabled, accounts, scheduledAt, mode === "now");
      setProblems(found);
      if (found.length) return;
      if (
        mode === "now" &&
        !window.confirm(`Post "${s.name || "this video"}" to ${enabled.map((p) => PLATFORM_NAMES[p]).join(", ")} now?`)
      )
        return;
    }

    const draft: PostDraft = {
      id: s.id,
      name: s.name,
      media_path: s.media?.path ?? null,
      media_bytes: s.media?.bytes ?? null,
      media_type: s.media?.type ?? null,
      cover_path: s.cover?.path ?? null,
      schedule: mode !== "draft",
      scheduled_at: scheduledAt,
      experiment_id: s.experimentId,
      variant: s.variant,
      notes: s.notes,
      targets: enabled.map((p) => {
        const t = s.targets[p];
        const options =
          p === "youtube"
            ? {
                privacy: t.privacy,
                tags: tagList(t.tags),
                madeForKids: t.madeForKids,
                notifySubscribers: t.notifySubscribers,
              }
            : p === "instagram"
              ? { trial: t.trial, shareToFeed: t.shareToFeed }
              : {};
        return { platform: p, title: p === "youtube" ? t.title : "", caption: t.caption, options };
      }),
    };

    setBusy(true);
    const res = await saveSocialPost(draft);
    setBusy(false);
    if (!res.ok) {
      setProblems([res.error ?? "Saving failed."]);
      return;
    }
    // Uploads replaced before saving, and the saved post's old files if they
    // were swapped out; discardSocialUpload keeps anything a post still uses.
    await discard([
      ...fresh.current.filter((p) => p !== s.media?.path && p !== s.cover?.path),
      initial.media?.path !== s.media?.path ? initial.media?.path : undefined,
      initial.cover?.path !== s.cover?.path ? initial.cover?.path : undefined,
    ]);
    fresh.current = [];
    await onSaved(
      mode === "draft" ? "Saved as a draft." : mode === "now" ? "Saved." : "Scheduled.",
      mode === "now",
    );
  }

  const copyCaptionEverywhere = (from: SocialPlatform) =>
    setS((prev) => {
      const targets = { ...prev.targets };
      for (const p of SOCIAL_PLATFORMS)
        if (p !== from) targets[p] = { ...targets[p], caption: prev.targets[from].caption };
      return { ...prev, targets };
    });

  return (
    // No close on a backdrop click: a stray click would throw away captions.
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
      <div className="flex h-full w-full max-w-xl flex-col bg-[var(--admin-surface)] shadow-xl">
        <div className="flex min-h-12 items-center gap-2 border-b border-[var(--admin-border)] px-4">
          <h2 className="mr-auto text-sm font-semibold">{s.id ? "Edit post" : "New post"}</h2>
          <button type="button" onClick={() => void cancel()} className="p-2 text-zinc-500 hover:text-zinc-900" aria-label="Close">
            x
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">Name (only shown here)</span>
            <input className={field} value={s.name} maxLength={200} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Vinted relist tip, hook B" />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-600">Video</span>
            {preview && (
              <video src={preview} controls muted playsInline className="max-h-72 rounded-md bg-black" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-700 hover:text-zinc-900">
                {s.media ? "Replace video" : "Choose video"}
                <input type="file" accept="video/mp4,video/quicktime" className="hidden" disabled={!!upload} onChange={(e) => void pick("video", e.target.files?.[0])} />
              </label>
              {s.media && (
                <span className="text-xs text-zinc-500">
                  {s.media.label ?? s.media.path.split("/").pop()} {megabytes(s.media.bytes)}
                </span>
              )}
            </div>
            {upload && (
              <div className="h-1.5 overflow-hidden rounded bg-zinc-100" role="progressbar" aria-valuenow={Math.round(upload.progress * 100)}>
                <div className="h-full bg-zinc-900 transition-[width]" style={{ width: `${upload.progress * 100}%` }} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-700 hover:text-zinc-900" title="YouTube thumbnail and Instagram cover. Optional.">
                {s.cover ? "Replace cover image" : "Cover image (optional)"}
                <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={!!upload} onChange={(e) => void pick("cover", e.target.files?.[0])} />
              </label>
              {s.cover && (
                <button type="button" onClick={() => setS({ ...s, cover: null })} className="text-xs text-zinc-500 hover:text-red-700">
                  remove cover
                </button>
              )}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">
              When <span className="font-normal text-zinc-400">({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
            </span>
            <input type="datetime-local" className={field} value={s.when} onChange={(e) => setS({ ...s, when: e.target.value })} />
          </label>

          {SOCIAL_PLATFORMS.map((p) => {
            const t = s.targets[p];
            const acc = accounts.find((a) => a.platform === p);
            return (
              <section key={p} className="rounded-lg border border-[var(--admin-border)]" style={t.enabled ? { borderColor: PLATFORM_THEME[p].accent } : undefined}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
                  <input type="checkbox" checked={t.enabled} onChange={(e) => setTarget(p, { enabled: e.target.checked })} />
                  <PlatformLogo platform={p} size={18} />
                  <span className="font-medium">{PLATFORM_NAMES[p]}</span>
                  {!canPost(acc) && (
                    <span className="ml-auto text-xs text-amber-700">
                      {acc?.logged_in ? "Reconnect on Stats to post" : "Connect on Stats to post"}
                    </span>
                  )}
                </label>
                {t.enabled && (
                  <div className="space-y-2 border-t border-[var(--admin-border)] px-3 py-3">
                    {p === "youtube" && (
                      <label className="block space-y-1">
                        <span className="flex justify-between text-xs text-zinc-600">
                          Title <Counter n={t.title.length} max={LIMITS.youtubeTitle} />
                        </span>
                        <input className={field} value={t.title} onChange={(e) => setTarget(p, { title: e.target.value })} />
                      </label>
                    )}
                    <label className="block space-y-1">
                      <span className="flex justify-between gap-2 text-xs text-zinc-600">
                        <span>
                          {p === "youtube" ? "Description" : "Caption"}
                          {p === "tiktok" && <span className="text-zinc-400"> (you paste this in the app)</span>}
                          {p === "instagram" && <span className="text-zinc-400"> {hashtagCount(t.caption)}/{LIMITS.hashtags} hashtags</span>}
                        </span>
                        <Counter
                          n={t.caption.length}
                          max={
                            p === "youtube"
                              ? LIMITS.youtubeDescription
                              : p === "facebook"
                                ? LIMITS.facebookCaption
                                : LIMITS.caption
                          }
                        />
                      </span>
                      <textarea className={`${field} min-h-24`} value={t.caption} onChange={(e) => setTarget(p, { caption: e.target.value })} />
                    </label>
                    {t.caption && (
                      <button type="button" onClick={() => copyCaptionEverywhere(p)} className="text-xs text-zinc-500 hover:text-zinc-900">
                        Use this text on the other platforms
                      </button>
                    )}
                    {p === "youtube" && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-xs text-zinc-600">Visibility</span>
                          <select className={field} value={t.privacy} onChange={(e) => setTarget(p, { privacy: e.target.value as TargetForm["privacy"] })}>
                            <option value="public">Public</option>
                            <option value="unlisted">Unlisted</option>
                            <option value="private">Private</option>
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-zinc-600">Tags (comma separated)</span>
                          <input className={field} value={t.tags} onChange={(e) => setTarget(p, { tags: e.target.value })} />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-600">
                          <input type="checkbox" checked={t.madeForKids} onChange={(e) => setTarget(p, { madeForKids: e.target.checked })} />
                          Made for kids
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-600">
                          <input type="checkbox" checked={t.notifySubscribers} onChange={(e) => setTarget(p, { notifySubscribers: e.target.checked })} />
                          Notify subscribers
                        </label>
                      </div>
                    )}
                    {p === "instagram" && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-xs text-zinc-600" title="Trial Reels are shown to non-followers first, so a test does not reach your followers until it has earned it.">
                            Trial Reel
                          </span>
                          <select className={field} value={t.trial} onChange={(e) => setTarget(p, { trial: e.target.value as TargetForm["trial"] })}>
                            <option value="off">Off (normal Reel)</option>
                            <option value="manual">Trial, I share it to followers</option>
                            <option value="auto">Trial, Instagram shares it if it does well</option>
                          </select>
                        </label>
                        {t.trial === "off" && (
                          <label className="flex items-center gap-2 self-end pb-2 text-xs text-zinc-600">
                            <input type="checkbox" checked={t.shareToFeed} onChange={(e) => setTarget(p, { shareToFeed: e.target.checked })} />
                            Also show in the feed grid
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Experiment</span>
              <select
                className={field}
                value={s.experimentId ?? ""}
                onChange={(e) =>
                  setS({ ...s, experimentId: e.target.value || null, variant: e.target.value ? (s.variant ?? "A") : null })
                }
              >
                <option value="">None</option>
                {experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            {experiment && (
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Variant</span>
                <select className={field} value={s.variant ?? ""} onChange={(e) => setS({ ...s, variant: e.target.value || null })}>
                  {experiment.variants.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.key}
                      {v.label ? `: ${v.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">Notes</span>
            <textarea className={`${field} min-h-16`} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
          </label>

          {(problems.length > 0 || warnings.length > 0) && (
            <ul className="space-y-1 text-xs">
              {problems.map((m) => (
                <li key={m} className="text-red-700">{m}</li>
              ))}
              {warnings.map((m) => (
                <li key={m} className="text-zinc-500">{m}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] px-4 py-3">
          <button type="button" disabled={busy || !!upload} onClick={() => void save("draft")} className="rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 disabled:opacity-50">
            Save draft
          </button>
          <button type="button" disabled={busy || !!upload} onClick={() => void save("now")} className="rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 disabled:opacity-50">
            Post now
          </button>
          <button type="button" disabled={busy || !!upload} onClick={() => void save("schedule")} className="ml-auto rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
            {busy ? "Saving..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
