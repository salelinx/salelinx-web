"use client";

// The planner's editor: one video, a time, and per platform its caption and
// options, with a phone preview beside it. One caption is shared by every
// platform unless a platform is given its own (the Buffer/Later pattern), and
// the checklist under the preview shows live what still stops it being
// scheduled. The video uploads to the private bucket as soon as it is picked;
// an upload that never gets saved (cancelled, or replaced) is deleted again.

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import {
  discardSocialUpload,
  saveSocialPost,
  setSocialTags,
  type PostDraft,
} from "@/app/admin/marketing/actions";
import {
  atTime,
  clockTime,
  dayKey,
  dayName,
  duration,
  fromDayKey,
  nextFreeSlot,
  postsByDay,
  slotTaken,
  startOfDay,
  toLocalInput,
  ukHourOn,
  usualTimes,
  whenLabel,
} from "@/lib/social/calendar";
import {
  autoTags,
  cleanTags,
  tagLabels,
  type SocialTags,
  type TagGroupKey,
} from "@/lib/social/tags";
import {
  canPost,
  PLATFORM_NAMES,
  postingAccount,
  SOCIAL_PLATFORMS,
  tiktokDirect,
  type InstagramOptions,
  type SocialAccount,
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
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconSparkle,
  IconTrash,
  IconUpload,
  IconX,
} from "./icons";
import { PostPreview } from "./PostPreview";
import { TagChips, TagEditor } from "./TagEditor";

type TargetForm = {
  enabled: boolean;
  title: string;
  // Its own caption, used only when it is not linked to the shared one.
  caption: string;
  privacy: NonNullable<YouTubeOptions["privacy"]>;
  tags: string;
  madeForKids: boolean;
  notifySubscribers: boolean;
  trial: NonNullable<InstagramOptions["trial"]>;
  shareToFeed: boolean;
  // TikTok's labels, sent when it posts publicly (TikTok API for Business).
  brandOrganic: boolean;
  aiGenerated: boolean;
};

type FileRef = {
  path: string;
  bytes: number | null;
  type: string | null;
  label?: string;
};

export type EditorState = {
  id: string | null;
  name: string;
  media: FileRef | null;
  cover: FileRef | null;
  // A datetime-local value, in the viewer's time zone.
  when: string;
  notes: string;
  targets: Record<SocialPlatform, TargetForm>;
  // The caption every linked platform uses.
  shared: string;
  linked: Record<SocialPlatform, boolean>;
  // What is in the video (054_social_tags.sql), saved after the post itself.
  tags: SocialTags;
  // The file's length, read from the preview once it loads.
  mediaSeconds: number | null;
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
  brandOrganic: false,
  aiGenerated: false,
});

const allLinked = (): Record<SocialPlatform, boolean> => ({
  youtube: true,
  instagram: true,
  tiktok: true,
  facebook: true,
});

const fromLocalInput = (v: string) =>
  v && v.length >= 16 ? new Date(v).toISOString() : null;

/** A blank post, with the platforms that can post already ticked. */
export function newEditor(accounts: SocialAccount[], when = ""): EditorState {
  const ready = (p: SocialPlatform) => canPost(postingAccount(accounts, p));
  return {
    id: null,
    name: "",
    media: null,
    cover: null,
    when,
    notes: "",
    targets: {
      youtube: blankTarget(ready("youtube")),
      instagram: blankTarget(ready("instagram")),
      tiktok: blankTarget(ready("tiktok")),
      facebook: blankTarget(ready("facebook")),
    },
    shared: "",
    linked: allLinked(),
    tags: {},
    mediaSeconds: null,
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
      brandOrganic: t.options.brandOrganic ?? false,
      aiGenerated: t.options.aiGenerated ?? false,
    };
  }
  // The shared caption is the one most platforms use; the rest keep their own.
  const counts = new Map<string, number>();
  for (const pl of SOCIAL_PLATFORMS)
    if (targets[pl].enabled)
      counts.set(
        targets[pl].caption,
        (counts.get(targets[pl].caption) ?? 0) + 1,
      );
  let shared = "";
  let best = 0;
  for (const [c, n] of counts) if (n > best) [shared, best] = [c, n];
  const linked = allLinked();
  for (const pl of SOCIAL_PLATFORMS)
    if (targets[pl].enabled) linked[pl] = targets[pl].caption === shared;
  return {
    id: p.id,
    name: p.name,
    media: p.media_path
      ? { path: p.media_path, bytes: p.media_bytes, type: p.media_type }
      : null,
    cover: p.cover_path
      ? { path: p.cover_path, bytes: null, type: null }
      : null,
    when: p.scheduled_at ? toLocalInput(new Date(p.scheduled_at)) : "",
    notes: p.notes ?? "",
    targets,
    shared,
    linked,
    tags: cleanTags(p.tags),
    mediaSeconds:
      p.media_seconds === null || p.media_seconds === undefined
        ? null
        : Number(p.media_seconds),
  };
}

const sameTags = (a: SocialTags, b: SocialTags) =>
  JSON.stringify(cleanTags(a)) === JSON.stringify(cleanTags(b));

const tagList = (tags: string) =>
  tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** A stored file's own name, without the random prefix uploadPath() gives it. */
const fileName = (path: string) =>
  (path.split("/").pop() ?? path).replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-?/,
    "",
  );

const captionOf = (s: EditorState, p: SocialPlatform) =>
  s.linked[p] ? s.shared : s.targets[p].caption;

const captionMax = (p: SocialPlatform) =>
  p === "youtube"
    ? LIMITS.youtubeDescription
    : p === "facebook"
      ? LIMITS.facebookCaption
      : LIMITS.caption;

/** Everything that would make marketing-publish fail, checked before saving. */
function problemsBeforePosting(
  s: EditorState,
  enabled: SocialPlatform[],
  accounts: SocialAccount[],
  scheduledAt: string | null,
  now: boolean,
  nowMs: number,
): string[] {
  return [
    ...scheduleProblems({
      hasMedia: !!s.media,
      platforms: enabled,
      scheduledAt,
      now,
      nowMs,
    }),
    ...enabled.flatMap((p) =>
      targetProblems(
        { platform: p, title: s.targets[p].title, caption: captionOf(s, p) },
        tagList(s.targets[p].tags),
      ),
    ),
    ...enabled
      .filter((p) => !canPost(postingAccount(accounts, p)))
      .map(
        (p) =>
          `${PLATFORM_NAMES[p]} can't post yet: Connect or Reconnect it in the planner header.`,
      ),
  ];
}

const field =
  "w-full rounded-lg border border-[var(--admin-border)] bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm shadow-black/[0.02] transition placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-3 focus:ring-blue-500/15";

const ghostButton =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50";

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {children}
      </span>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span
      className={`tabular-nums ${n > max ? "font-medium text-red-600" : n > max * 0.9 ? "text-amber-700" : "text-zinc-400"}`}
    >
      {n.toLocaleString("en-GB")}/{max.toLocaleString("en-GB")}
    </span>
  );
}

/** A section that folds away, with a one-line summary while folded. */
function Fold({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--admin-border)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-zinc-900">{title}</span>
        {summary && (
          <span className="truncate text-xs text-zinc-400">{summary}</span>
        )}
        <IconChevronDown
          size={14}
          className={`ml-auto text-zinc-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--admin-border)] px-3.5 py-3">
          {children}
        </div>
      )}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-blue-600"
      />
      {children}
    </label>
  );
}

export function PostEditor({
  initial,
  accounts,
  posts,
  bestHours,
  tagOptions,
  onClose,
  onSaved,
  onDuplicate,
  onDelete,
}: {
  initial: EditorState;
  accounts: SocialAccount[];
  // Every planned post, for the time shortcuts and "also that day".
  posts: SocialPost[];
  bestHours: number[];
  tagOptions: Record<TagGroupKey, string[]>;
  onClose: () => void;
  onSaved: (message: string, postNow: boolean) => void | Promise<void>;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [s, setS] = useState<EditorState>(initial);
  const now = useClientNow();
  const [upload, setUpload] = useState<{
    kind: "video" | "cover";
    progress: number;
    name: string;
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [failures, setFailures] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmNow, setConfirmNow] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [tab, setTab] = useState<"all" | SocialPlatform>("all");
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform | null>(
    null,
  );
  const [open, setOpen] = useState({
    tags: !initial.id,
    notes: !!initial.notes,
  });
  // Files uploaded in this editor and not yet saved, deleted if they never are.
  const fresh = useRef<string[]>([]);
  const pickedFile = useRef<File | null>(null);
  const [volume, setVolume] = useState(1);

  const enabled = SOCIAL_PLATFORMS.filter((p) => s.targets[p].enabled);
  const dirty = volume !== 1 || JSON.stringify(s) !== JSON.stringify(initial);
  // The editor only opens after hydration, so the clock is always there.
  const nowMs = now ?? 0;
  const scheduledAt = fromLocalInput(s.when);
  const issues = problemsBeforePosting(
    s,
    enabled,
    accounts,
    scheduledAt,
    false,
    nowMs,
  );
  const warnings =
    now === null
      ? []
      : postWarnings({
          platforms: enabled,
          mediaBytes: s.media?.bytes ?? null,
          scheduledAt,
          now,
          seconds: s.mediaSeconds,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          tiktokDirect: tiktokDirect(accounts),
        });

  // A saved video plays from a signed link; a fresh pick sets its own blob URL.
  useEffect(() => {
    let live = true;
    if (s.media && !preview?.startsWith("blob:"))
      void signedUrl(s.media.path).then((url) => live && setPreview(url));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.media?.path]);

  // A saved cover, fetched into a blob URL: Storage is not in the CSP's img-src.
  useEffect(() => {
    let live = true;
    if (s.cover && !fresh.current.includes(s.cover.path))
      void signedUrl(s.cover.path)
        .then((url) => (url ? fetch(url) : null))
        .then((res) => (res?.ok ? res.blob() : null))
        .then(
          (blob) => live && blob && setCoverPreview(URL.createObjectURL(blob)),
        )
        .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.cover?.path]);

  const discard = (paths: (string | undefined)[]) =>
    Promise.all(
      paths.filter((p): p is string => !!p).map((p) => discardSocialUpload(p)),
    );

  /** Leave, asking first if anything would be lost, and clean up unsaved uploads. */
  async function leave(then: () => void = onClose) {
    if (busy || upload) return;
    if (
      dirty &&
      !window.confirm(
        "Close without saving? Your changes to this post will be lost.",
      )
    )
      return;
    await discard(fresh.current);
    fresh.current = [];
    then();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setTarget = (p: SocialPlatform, patch: Partial<TargetForm>) =>
    setS((prev) => ({
      ...prev,
      targets: { ...prev.targets, [p]: { ...prev.targets[p], ...patch } },
    }));

  async function pick(kind: "video" | "cover", file: File | undefined) {
    if (!file) return;
    const ok =
      kind === "video"
        ? /^video\/(mp4|quicktime)$/.test(file.type) ||
          /\.(mp4|mov)$/i.test(file.name)
        : /^image\/(jpeg|png)$/.test(file.type);
    if (!ok) {
      setFailures([
        kind === "video"
          ? "That isn't an MP4 or MOV video."
          : "Covers must be a JPEG or PNG.",
      ]);
      return;
    }
    const path = uploadPath(kind === "video" ? "videos" : "covers", file.name);
    setUpload({ kind, progress: 0, name: file.name });
    setFailures([]);
    try {
      await uploadToBucket(file, path, (progress) =>
        setUpload({ kind, progress, name: file.name }),
      );
    } catch (err) {
      setUpload(null);
      setFailures([`Upload failed: ${(err as Error).message}`]);
      return;
    }
    setUpload(null);
    fresh.current.push(path);
    const ref: FileRef = {
      path,
      bytes: file.size,
      type: file.type || null,
      label: file.name,
    };
    if (kind === "video") {
      pickedFile.current = file;
      setPreview(URL.createObjectURL(file));
      setDims(null);
      // The preview's metadata fills in the new file's length.
      setS((prev) => ({
        ...prev,
        media: ref,
        mediaSeconds: null,
        name: prev.name || file.name.replace(/\.[^.]+$/, ""),
      }));
    } else {
      setCoverPreview(URL.createObjectURL(file));
      setS((prev) => ({ ...prev, cover: ref }));
    }
  }

  function onVideoMeta(v: HTMLVideoElement) {
    const d = v.duration;
    if (v.videoWidth && v.videoHeight)
      setDims({ width: v.videoWidth, height: v.videoHeight });
    if (Number.isFinite(d) && d > 0)
      setS((prev) =>
        prev.mediaSeconds !== null && Math.abs(prev.mediaSeconds - d) < 0.5
          ? prev
          : { ...prev, mediaSeconds: Math.round(d * 10) / 10 },
      );
  }

  async function bakeVolume(media: FileRef): Promise<FileRef | null> {
    const name = media.label ?? fileName(media.path);
    const show = (progress: number) =>
      setUpload({ kind: "video", progress, name });
    show(0);
    setFailures([]);
    try {
      let source: Blob | null = pickedFile.current;
      if (!source) {
        const url = await signedUrl(media.path);
        const res = url ? await fetch(url) : null;
        if (!res?.ok) throw new Error("couldn't read the saved video");
        source = await res.blob();
      }
      const { withVolume } = await import("./volume");
      const blob = await withVolume(source, volume, (p) => show(p / 2));
      const file = new File([blob], `${name.replace(/\.[^.]+$/, "")}.mp4`, {
        type: "video/mp4",
      });
      const path = uploadPath("videos", file.name);
      await uploadToBucket(file, path, (p) => show(0.5 + p / 2));
      fresh.current.push(path);
      pickedFile.current = file;
      const ref: FileRef = {
        path,
        bytes: file.size,
        type: file.type,
        label: media.label,
      };
      setPreview(URL.createObjectURL(file));
      setVolume(1);
      setS((prev) => ({ ...prev, media: ref }));
      return ref;
    } catch (err) {
      setFailures([`Changing the volume failed: ${(err as Error).message}`]);
      return null;
    } finally {
      setUpload(null);
    }
  }

  function dropFile(e: DragEvent) {
    e.preventDefault();
    setDropping(false);
    void pick("video", e.dataTransfer.files?.[0]);
  }

  async function save(mode: "draft" | "schedule" | "now") {
    const at = mode === "now" ? new Date().toISOString() : scheduledAt;
    if (mode !== "draft") {
      const found = problemsBeforePosting(
        s,
        enabled,
        accounts,
        at,
        mode === "now",
        new Date().getTime(),
      );
      setAttempted(true);
      setFailures([]);
      if (found.length) return;
      if (mode === "now" && !confirmNow) {
        setConfirmNow(true);
        setTimeout(() => setConfirmNow(false), 5000);
        return;
      }
    }

    let media = s.media;
    if (media && volume !== 1) {
      media = await bakeVolume(media);
      if (!media) return;
    }

    const draft: PostDraft = {
      id: s.id,
      name: s.name,
      media_path: media?.path ?? null,
      media_bytes: media?.bytes ?? null,
      media_type: media?.type ?? null,
      cover_path: s.cover?.path ?? null,
      schedule: mode !== "draft",
      scheduled_at: at,
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
              : p === "tiktok"
                ? { brandOrganic: t.brandOrganic, aiGenerated: t.aiGenerated }
                : {};
        return {
          platform: p,
          title: p === "youtube" ? t.title : "",
          caption: captionOf(s, p),
          options,
        };
      }),
    };

    setBusy(true);
    const res = await saveSocialPost(draft);
    if (!res.ok) {
      setBusy(false);
      setFailures([res.error ?? "Saving failed."]);
      return;
    }
    // Tags and length go through their own call, which works at any stage.
    let tagNote = "";
    if (
      res.id &&
      (!sameTags(s.tags, initial.tags) ||
        (s.mediaSeconds !== null && s.mediaSeconds !== initial.mediaSeconds))
    ) {
      const tagged = await setSocialTags({
        postId: res.id,
        platform: null,
        externalId: null,
        tags: s.tags,
        mediaSeconds: s.mediaSeconds,
      });
      if (!tagged.ok)
        tagNote = ` The tags didn't save (${tagged.error ?? "unknown error"}).`;
    }
    setBusy(false);
    // Uploads replaced before saving, and the saved post's old files if they
    // were swapped out; discardSocialUpload keeps anything a post still uses.
    await discard([
      ...fresh.current.filter(
        (p) => p !== media?.path && p !== s.cover?.path,
      ),
      initial.media?.path !== media?.path ? initial.media?.path : undefined,
      initial.cover?.path !== s.cover?.path ? initial.cover?.path : undefined,
    ]);
    fresh.current = [];
    const when = at ? whenLabel(new Date(at), new Date()) : "";
    await onSaved(
      (mode === "draft"
        ? `Saved "${s.name || "Untitled post"}" as a draft.`
        : mode === "now"
          ? "Saved."
          : `Scheduled for ${when}.`) + tagNote,
      mode === "now",
    );
  }

  // ---- When ----
  const others = posts.filter((p) => p.id !== s.id);
  const times = usualTimes(posts);
  const day = s.when ? fromDayKey(s.when.slice(0, 10)) : null;
  const sameDay = day ? (postsByDay(others).get(dayKey(day)) ?? []) : [];
  const free = now === null ? null : nextFreeSlot(others, times, now);
  const setWhen = (d: Date) =>
    setS((prev) => ({ ...prev, when: toLocalInput(d) }));
  // A date picked with no time yet gets that day's first free usual time.
  const firstFreeOn = (v: string) =>
    times.find((t) => {
      const at = atTime(fromDayKey(v), t);
      return at.getTime() > nowMs + 15 * 60_000 && !slotTaken(others, at);
    }) ?? times[0];
  const setDate = (v: string) =>
    setS((prev) =>
      v
        ? { ...prev, when: `${v}T${prev.when.slice(11, 16) || firstFreeOn(v)}` }
        : { ...prev, when: "" },
    );
  const setTime = (v: string) =>
    setS((prev) => {
      if (!v) return prev;
      const date = prev.when.slice(0, 10) || dayKey(new Date(nowMs));
      return { ...prev, when: `${date}T${v}` };
    });

  // ---- Caption ----
  const linkedOn = enabled.filter((p) => s.linked[p]);
  const ownOn = enabled.filter((p) => !s.linked[p]);
  const tabProblem = (p: SocialPlatform) =>
    targetProblems(
      { platform: p, title: s.targets[p].title, caption: captionOf(s, p) },
      tagList(s.targets[p].tags),
    ).length > 0;
  const activeTab = tab !== "all" && !enabled.includes(tab) ? "all" : tab;
  const sharedMax = Math.min(
    ...(linkedOn.length
      ? linkedOn
      : enabled.length
        ? enabled
        : (["instagram"] as SocialPlatform[])
    ).map(captionMax),
  );
  const firstCaption =
    enabled.map((p) => captionOf(s, p)).find((c) => c.trim()) ?? null;
  const shownPlatform =
    previewPlatform ?? (activeTab !== "all" ? activeTab : null);
  const shownCaption =
    shownPlatform && enabled.includes(shownPlatform)
      ? captionOf(s, shownPlatform)
      : s.shared || (firstCaption ?? "");
  const handleFor = (p: SocialPlatform | null) =>
    accounts.find((a) => a.platform === (p ?? enabled[0]))?.handle ?? null;

  const picked = tagLabels(cleanTags(s.tags));
  const autos = autoTags({
    publishedAt: scheduledAt,
    seconds: s.mediaSeconds,
    caption: firstCaption,
  });

  const checklist: { ok: boolean; text: string }[] = [
    { ok: !!s.media, text: s.media ? "Video added" : "Add a video" },
    {
      ok: enabled.length > 0,
      text: enabled.length
        ? `${enabled.length} ${enabled.length === 1 ? "platform" : "platforms"}`
        : "Pick a platform",
    },
    {
      ok: !!scheduledAt && Date.parse(scheduledAt) > nowMs - 60_000,
      text: scheduledAt
        ? Date.parse(scheduledAt) > nowMs - 60_000
          ? whenLabel(new Date(scheduledAt), new Date(nowMs))
          : "That time has passed"
        : "Pick a time",
    },
  ];
  const otherIssues = issues.filter(
    (m) =>
      ![
        "Add a video first.",
        "Pick at least one platform.",
        "Pick a time.",
        "That time has passed. Pick a later one, or use Post now.",
      ].includes(m),
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-center sm:items-center sm:p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div
        className="slx-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => void leave()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.id ? "Edit post" : "New post"}
        className="slx-pop relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-[var(--admin-surface)] shadow-2xl sm:h-[min(92vh,940px)] sm:rounded-2xl sm:border sm:border-[var(--admin-border)]"
      >
        <header className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5 sm:px-5">
          <span className="hidden shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 sm:inline">
            {s.id ? "Edit post" : "New post"}
          </span>
          <input
            value={s.name}
            maxLength={200}
            onChange={(e) => setS({ ...s, name: e.target.value })}
            placeholder="Name this post (only shown here)"
            aria-label="Post name"
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-zinc-900 placeholder:font-normal placeholder:text-zinc-400 hover:border-[var(--admin-border)] focus:border-blue-400 focus:outline-none"
          />
          {onDuplicate && (
            <button
              type="button"
              onClick={() => void leave(onDuplicate)}
              className={ghostButton}
              title="A new post with the same video and captions"
            >
              <IconCopy size={13} />{" "}
              <span className="hidden sm:inline">Copy</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={`${ghostButton} hover:border-red-200 hover:text-red-700`}
              title="Delete this post"
            >
              <IconTrash size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void leave()}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* The form. */}
          <div className="min-h-0 flex-1 space-y-6 overflow-auto px-4 py-5 sm:px-6">
            <section>
              <Label>Post to</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SOCIAL_PLATFORMS.map((p) => {
                  const on = s.targets[p].enabled;
                  const acc = postingAccount(accounts, p);
                  const ready = canPost(acc);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTarget(p, { enabled: !on })}
                      className={`relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                        on
                          ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                          : "border-[var(--admin-border)] hover:border-zinc-300"
                      }`}
                    >
                      <span className={on ? "" : "opacity-50 grayscale"}>
                        <PlatformLogo platform={p} size={20} />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-medium ${on ? "text-zinc-900" : "text-zinc-600"}`}
                        >
                          {PLATFORM_NAMES[p]}
                        </span>
                        <span
                          className={`block truncate text-[11px] ${ready ? "text-zinc-400" : "text-amber-700"}`}
                        >
                          {ready
                            ? acc?.handle
                              ? `@${acc.handle.replace(/^@/, "")}`
                              : "Ready"
                            : acc?.logged_in
                              ? "Reconnect to post"
                              : "Not connected"}
                        </span>
                      </span>
                      {on && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                          <IconCheck size={11} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <Label hint="MP4 or MOV, vertical (9:16) works everywhere">
                Video
              </Label>
              {s.media && !upload ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] p-2.5">
                  {preview ? (
                    <video
                      src={preview}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => onVideoMeta(e.currentTarget)}
                      className="h-20 w-[45px] shrink-0 rounded-md bg-black object-cover"
                    />
                  ) : (
                    <span className="h-20 w-[45px] shrink-0 rounded-md bg-zinc-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {s.media.label ?? fileName(s.media.path)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {[
                        duration(s.mediaSeconds),
                        dims ? `${dims.width}x${dims.height}` : "",
                        megabytes(s.media.bytes),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <label className={`${ghostButton} cursor-pointer`}>
                    Replace
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime"
                      className="hidden"
                      onChange={(e) => void pick("video", e.target.files?.[0])}
                    />
                  </label>
                </div>
              ) : (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropping(true);
                  }}
                  onDragLeave={() => setDropping(false)}
                  onDrop={dropFile}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                    dropping
                      ? "border-blue-400 bg-blue-50"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {upload?.kind === "video" ? (
                    <div className="w-full max-w-xs space-y-2">
                      <p className="truncate text-sm text-zinc-700">
                        Uploading {upload.name}
                      </p>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
                        role="progressbar"
                        aria-valuenow={Math.round(upload.progress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                          style={{
                            width: `${Math.round(upload.progress * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs tabular-nums text-zinc-400">
                        {Math.round(upload.progress * 100)}%
                      </p>
                    </div>
                  ) : (
                    <>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <IconUpload size={18} />
                      </span>
                      <span className="text-sm font-medium text-zinc-800">
                        Drop a video here, or choose one
                      </span>
                      <span className="text-xs text-zinc-400">
                        It uploads straight away, so it is ready when you
                        schedule
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime"
                    className="hidden"
                    disabled={!!upload}
                    onChange={(e) => void pick("video", e.target.files?.[0])}
                  />
                </label>
              )}
              <div className="mt-2 flex items-center gap-2.5">
                {coverPreview && s.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt=""
                    className="h-10 w-[23px] rounded object-cover"
                  />
                ) : null}
                <label
                  className={`${ghostButton} cursor-pointer`}
                  title="YouTube thumbnail and Instagram cover. Optional."
                >
                  {upload?.kind === "cover"
                    ? `Uploading ${Math.round(upload.progress * 100)}%`
                    : s.cover
                      ? "Replace cover"
                      : "Add a cover image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    disabled={!!upload}
                    onChange={(e) => void pick("cover", e.target.files?.[0])}
                  />
                </label>
                {s.cover && (
                  <button
                    type="button"
                    onClick={() => setS({ ...s, cover: null })}
                    className="text-xs text-zinc-500 hover:text-red-700"
                  >
                    Remove cover
                  </button>
                )}
                <span className="hidden text-xs text-zinc-400 sm:inline">
                  YouTube thumbnail and Instagram cover
                </span>
              </div>
            </section>

            {s.targets.youtube.enabled && (
              <section>
                <Label
                  hint={
                    <Counter
                      n={s.targets.youtube.title.length}
                      max={LIMITS.youtubeTitle}
                    />
                  }
                >
                  YouTube title
                </Label>
                <input
                  className={`${field} ${attempted && !s.targets.youtube.title.trim() ? "border-red-300" : ""}`}
                  value={s.targets.youtube.title}
                  onChange={(e) =>
                    setTarget("youtube", { title: e.target.value })
                  }
                  placeholder="What viewers see under the Short"
                />
              </section>
            )}

            <section>
              <Label
                hint={
                  activeTab === "all" ? (
                    <span className="flex items-center gap-2">
                      {linkedOn.includes("instagram") && (
                        <span>
                          {hashtagCount(s.shared)}/{LIMITS.hashtags} hashtags
                        </span>
                      )}
                      <Counter n={s.shared.length} max={sharedMax} />
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {activeTab === "instagram" && (
                        <span>
                          {hashtagCount(captionOf(s, activeTab))}/
                          {LIMITS.hashtags} hashtags
                        </span>
                      )}
                      <Counter
                        n={captionOf(s, activeTab).length}
                        max={captionMax(activeTab)}
                      />
                    </span>
                  )
                }
              >
                Caption
              </Label>
              {enabled.length > 1 && (
                <div
                  className="mb-2 flex flex-wrap gap-1"
                  role="tablist"
                  aria-label="Caption for"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "all"}
                    onClick={() => setTab("all")}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${activeTab === "all" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                  >
                    Everywhere
                  </button>
                  {enabled.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === p}
                      onClick={() => {
                        setTab(p);
                        setPreviewPlatform(p);
                      }}
                      className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${
                        activeTab === p
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <PlatformLogo platform={p} size={12} />
                      {PLATFORM_NAMES[p]}
                      {!s.linked[p] && (
                        <span className="text-[10px] opacity-60">own</span>
                      )}
                      {tabProblem(p) && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-red-500"
                          aria-label="has a problem"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "all" || s.linked[activeTab] ? (
                <>
                  <textarea
                    className={`${field} min-h-36 resize-y leading-relaxed`}
                    value={s.shared}
                    onChange={(e) => setS({ ...s, shared: e.target.value })}
                    placeholder="Write the caption. Hashtags and @mentions work as usual."
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {activeTab === "all" ? (
                      <>
                        {linkedOn.length > 0 && (
                          <span className="flex items-center gap-1">
                            Used on{" "}
                            {linkedOn.map((p) => (
                              <PlatformLogo key={p} platform={p} size={12} />
                            ))}
                          </span>
                        )}
                        {ownOn.length > 0 && (
                          <span className="flex items-center gap-1">
                            Own caption on{" "}
                            {ownOn.map((p) => (
                              <PlatformLogo key={p} platform={p} size={12} />
                            ))}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>
                          {PLATFORM_NAMES[activeTab]} uses the shared caption.
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setS((prev) => ({
                              ...prev,
                              linked: { ...prev.linked, [activeTab]: false },
                              targets: {
                                ...prev.targets,
                                [activeTab]: {
                                  ...prev.targets[activeTab],
                                  caption: prev.shared,
                                },
                              },
                            }))
                          }
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          Write one just for {PLATFORM_NAMES[activeTab]}
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    className={`${field} min-h-36 resize-y leading-relaxed`}
                    value={s.targets[activeTab].caption}
                    onChange={(e) =>
                      setTarget(activeTab, { caption: e.target.value })
                    }
                    placeholder={`The ${PLATFORM_NAMES[activeTab]} caption`}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>Only on {PLATFORM_NAMES[activeTab]}.</span>
                    <button
                      type="button"
                      onClick={() =>
                        setS((prev) => ({
                          ...prev,
                          linked: { ...prev.linked, [activeTab]: true },
                        }))
                      }
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      Use the shared caption
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setS((prev) => ({
                          ...prev,
                          shared: prev.targets[activeTab].caption,
                          linked: allLinked(),
                        }))
                      }
                      className="text-zinc-500 hover:text-zinc-900"
                    >
                      Use this one everywhere
                    </button>
                  </div>
                </>
              )}
              {enabled.includes("tiktok") &&
                (activeTab === "tiktok" || activeTab === "all") && (
                  <p className="mt-2 text-xs text-zinc-400">
                    {tiktokDirect(accounts)
                      ? "TikTok posts this caption publicly by itself. Hashtags show as plain text there."
                      : "TikTok's copy goes to the app's inbox, so you paste its caption there."}
                  </p>
                )}
            </section>

            {(s.targets.youtube.enabled ||
              s.targets.instagram.enabled ||
              (s.targets.tiktok.enabled && tiktokDirect(accounts))) && (
              <section className="space-y-3">
                <Label>Platform settings</Label>
                {s.targets.youtube.enabled && (
                  <div className="space-y-3 rounded-xl border border-[var(--admin-border)] p-3.5">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <PlatformLogo platform="youtube" size={16} /> YouTube
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs text-zinc-600">
                          Visibility
                        </span>
                        <select
                          className={field}
                          value={s.targets.youtube.privacy}
                          onChange={(e) =>
                            setTarget("youtube", {
                              privacy: e.target.value as TargetForm["privacy"],
                            })
                          }
                        >
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="private">Private</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-zinc-600">
                          Tags, comma separated
                        </span>
                        <input
                          className={field}
                          value={s.targets.youtube.tags}
                          onChange={(e) =>
                            setTarget("youtube", { tags: e.target.value })
                          }
                          placeholder="vinted, reselling"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <Toggle
                        checked={s.targets.youtube.notifySubscribers}
                        onChange={(v) =>
                          setTarget("youtube", { notifySubscribers: v })
                        }
                      >
                        Notify subscribers
                      </Toggle>
                      <Toggle
                        checked={s.targets.youtube.madeForKids}
                        onChange={(v) =>
                          setTarget("youtube", { madeForKids: v })
                        }
                      >
                        Made for kids
                      </Toggle>
                    </div>
                  </div>
                )}
                {s.targets.instagram.enabled && (
                  <div className="space-y-3 rounded-xl border border-[var(--admin-border)] p-3.5">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <PlatformLogo platform="instagram" size={16} /> Instagram
                    </p>
                    <label className="block space-y-1">
                      <span
                        className="text-xs text-zinc-600"
                        title="Trial Reels are shown to non-followers first, so a test does not reach your followers until it has earned it."
                      >
                        Trial Reel{" "}
                        <span className="text-zinc-400">
                          (shown to non-followers first)
                        </span>
                      </span>
                      <select
                        className={field}
                        value={s.targets.instagram.trial}
                        onChange={(e) =>
                          setTarget("instagram", {
                            trial: e.target.value as TargetForm["trial"],
                          })
                        }
                      >
                        <option value="off">Off, a normal Reel</option>
                        <option value="manual">
                          Trial, I share it to followers
                        </option>
                        <option value="auto">
                          Trial, Instagram shares it if it does well
                        </option>
                      </select>
                    </label>
                    {s.targets.instagram.trial === "off" && (
                      <Toggle
                        checked={s.targets.instagram.shareToFeed}
                        onChange={(v) =>
                          setTarget("instagram", { shareToFeed: v })
                        }
                      >
                        Also show in the feed grid
                      </Toggle>
                    )}
                  </div>
                )}
                {s.targets.tiktok.enabled && tiktokDirect(accounts) && (
                  <div className="space-y-3 rounded-xl border border-[var(--admin-border)] p-3.5">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <PlatformLogo platform="tiktok" size={16} /> TikTok
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <Toggle
                        checked={s.targets.tiktok.brandOrganic}
                        onChange={(v) =>
                          setTarget("tiktok", { brandOrganic: v })
                        }
                      >
                        Label as promotional content
                      </Toggle>
                      <Toggle
                        checked={s.targets.tiktok.aiGenerated}
                        onChange={(v) =>
                          setTarget("tiktok", { aiGenerated: v })
                        }
                      >
                        Label as AI-generated
                      </Toggle>
                    </div>
                    <p className="text-xs text-zinc-400">
                      TikTok shows these labels on the post. The AI label
                      can&apos;t be taken off once it&apos;s posted.
                    </p>
                  </div>
                )}
              </section>
            )}

            <section>
              <Label hint={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                When
              </Label>
              <div className="flex items-center gap-2">
                <div className="grid w-full max-w-sm grid-cols-[1.3fr_1fr] gap-2">
                  <input
                    type="date"
                    className={field}
                    value={s.when.slice(0, 10)}
                    min={now === null ? undefined : dayKey(new Date(now))}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Date"
                  />
                  <input
                    type="time"
                    step={300}
                    className={field}
                    value={s.when.slice(11, 16)}
                    onChange={(e) => setTime(e.target.value)}
                    aria-label="Time"
                  />
                </div>
                {s.when && (
                  <button
                    type="button"
                    onClick={() => setS({ ...s, when: "" })}
                    className="px-1 text-xs text-zinc-500 hover:text-zinc-900"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {free && (
                  <button
                    type="button"
                    onClick={() => setWhen(free)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:border-blue-300"
                    title="The first of your usual posting times with nothing in it"
                  >
                    <IconSparkle size={12} /> Next free slot:{" "}
                    {whenLabel(free, new Date(nowMs))}
                  </button>
                )}
                {times.map((t) => {
                  const base = day ?? startOfDay(new Date(nowMs));
                  const at = atTime(base, t);
                  const taken = slotTaken(others, at);
                  const past = at.getTime() < nowMs;
                  const on = s.when.slice(11, 16) === t && !!day;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={past}
                      onClick={() => setWhen(at)}
                      title={
                        taken
                          ? `Taken by "${taken.name}"`
                          : `${dayName(base, new Date(nowMs))} at ${t}`
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs tabular-nums transition disabled:opacity-40 ${
                        on
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : taken
                            ? "border-dashed border-zinc-300 text-zinc-400 line-through"
                            : "border-[var(--admin-border)] text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
                <span className="text-xs text-zinc-400">
                  your usual times
                  {day ? ` on ${dayName(day, new Date(nowMs))}` : " today"}
                </span>
                {bestHours.map((h) => {
                  const at = ukHourOn(day ?? startOfDay(new Date(nowMs)), h);
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={at.getTime() < nowMs}
                      onClick={() => setWhen(at)}
                      title="Our posts at this hour have done best at 24 hours over the last 90 days"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs tabular-nums text-emerald-700 transition hover:border-emerald-300 disabled:opacity-40"
                    >
                      <IconSparkle size={12} /> {clockTime(at)}
                    </button>
                  );
                })}
                {bestHours.length > 0 && <span className="text-xs text-zinc-400">best for views</span>}
              </div>
              {sameDay.length > 0 && (
                <ul className="mt-2.5 space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  <li className="text-zinc-400">
                    Also on {dayName(day!, new Date(nowMs))}
                  </li>
                  {sameDay.map((p) => (
                    <li key={p.id} className="flex gap-2">
                      <span className="w-10 tabular-nums font-medium text-zinc-800">
                        {clockTime(new Date(p.scheduled_at!))}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-2">
              <Fold
                title="What's in this video"
                summary={
                  picked.length
                    ? picked.join(", ")
                    : "Helps Stats work out why one post beats another"
                }
                open={open.tags}
                onToggle={() => setOpen({ ...open, tags: !open.tags })}
              >
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    These cover every platform, and you can change them after
                    it&apos;s posted. Dashed ones are read automatically.
                  </p>
                  <TagChips picked={[]} auto={autos} />
                  <TagEditor
                    value={s.tags}
                    onChange={(tags) => setS((prev) => ({ ...prev, tags }))}
                    options={tagOptions}
                  />
                </div>
              </Fold>
              <Fold
                title="Notes"
                summary={s.notes ? s.notes.slice(0, 60) : "Only shown here"}
                open={open.notes}
                onToggle={() => setOpen({ ...open, notes: !open.notes })}
              >
                <textarea
                  className={`${field} min-h-20`}
                  value={s.notes}
                  onChange={(e) => setS({ ...s, notes: e.target.value })}
                  placeholder="Anything to remember about this one"
                />
              </Fold>
            </div>

            {/* Phones and narrow windows have no side column, so the checks sit here. */}
            <div className="lg:hidden">
              <Checks
                checklist={checklist}
                issues={otherIssues}
                warnings={warnings}
                failures={failures}
                attempted={attempted}
              />
            </div>
          </div>

          {/* Preview and checks. */}
          <aside className="hidden w-[330px] shrink-0 space-y-5 overflow-auto border-l border-[var(--admin-border)] bg-zinc-50 px-5 py-5 lg:block">
            <PostPreview
              platforms={enabled}
              platform={shownPlatform}
              onPlatform={setPreviewPlatform}
              videoUrl={preview}
              handle={handleFor(shownPlatform)}
              title={s.targets.youtube.title}
              caption={shownCaption}
              onMeta={onVideoMeta}
              volume={volume}
              onVolume={setVolume}
            />
            <Checks
              checklist={checklist}
              issues={otherIssues}
              warnings={warnings}
              failures={failures}
              attempted={attempted}
            />
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 sm:px-5">
          <p className="mr-auto hidden items-center gap-1.5 text-xs sm:flex">
            {busy ? (
              <span className="text-zinc-500">Saving...</span>
            ) : upload ? (
              <span className="text-zinc-500">
                Uploading, {Math.round(upload.progress * 100)}%
              </span>
            ) : issues.length ? (
              <span
                className={`flex items-center gap-1.5 ${attempted ? "text-red-700" : "text-zinc-500"}`}
              >
                <IconAlert size={14} />{" "}
                {issues.length === 1 ? "1 thing" : `${issues.length} things`} to
                sort before scheduling
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <IconCheck size={14} /> Ready to schedule
              </span>
            )}
          </p>
          <button
            type="button"
            disabled={busy || !!upload}
            onClick={() => void save("draft")}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={busy || !!upload}
            onClick={() => void save("now")}
            className={`rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
              confirmNow
                ? "border-red-300 bg-red-50 font-medium text-red-700"
                : "border-[var(--admin-border)] text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            {confirmNow ? `Post to ${enabled.length} now?` : "Post now"}
          </button>
          <button
            type="button"
            disabled={busy || !!upload}
            onClick={() => void save("schedule")}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? (
              "Saving..."
            ) : (
              <>
                Schedule
                {scheduledAt && (
                  <span className="hidden sm:inline">
                    {" "}
                    for {whenLabel(new Date(scheduledAt), new Date(nowMs))}
                  </span>
                )}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Checks({
  checklist,
  issues,
  warnings,
  failures,
  attempted,
}: {
  checklist: { ok: boolean; text: string }[];
  issues: string[];
  warnings: string[];
  failures: string[];
  attempted: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Before it goes
        </p>
        <ul className="space-y-1.5 text-xs">
          {checklist.map((c) => (
            <li key={c.text} className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  c.ok
                    ? "bg-emerald-500 text-white"
                    : attempted
                      ? "bg-red-100 text-red-700"
                      : "border border-zinc-300"
                }`}
              >
                {c.ok && <IconCheck size={10} />}
              </span>
              <span
                className={
                  c.ok
                    ? "text-zinc-700"
                    : attempted
                      ? "text-red-700"
                      : "text-zinc-500"
                }
              >
                {c.text}
              </span>
            </li>
          ))}
          {issues.map((m) => (
            <li
              key={m}
              className={`flex items-start gap-2 ${attempted ? "text-red-700" : "text-zinc-600"}`}
            >
              <span
                className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${attempted ? "bg-red-100" : "bg-amber-100 text-amber-800"}`}
              >
                <IconAlert size={10} />
              </span>
              {m}
            </li>
          ))}
        </ul>
      </div>
      {failures.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {failures.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Good to know
          </p>
          <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-500">
            {warnings.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
