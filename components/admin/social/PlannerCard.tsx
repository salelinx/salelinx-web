"use client";

// The planner's post in its three sizes: a card for the week, a line for the
// month and a row for the list, plus the bits they share (the picture, the
// state colours, the platform marks that light up as each copy goes live).

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import {
  clockTime,
  isEditable,
  planState,
  type PlanState,
} from "@/lib/social/calendar";
import {
  PLATFORM_NAMES,
  SOCIAL_PLATFORMS,
  type PostThumb,
  type SocialPost,
  type SocialTargetRow,
  type TargetStatus,
} from "@/lib/social/types";
import { IconAlert, IconCheck, IconClock, IconFilm, IconInbox } from "./icons";

export const DRAG_TYPE = "application/x-slx-post";

type Tone = { label: string; dot: string; chip: string; edge: string };

const STATE_TONE: Record<PlanState | "failed", Tone> = {
  draft: {
    label: "Draft",
    dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-600",
    edge: "before:bg-zinc-300",
  },
  scheduled: {
    label: "Scheduled",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700",
    edge: "before:bg-blue-500",
  },
  posting: {
    label: "Posting",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700",
    edge: "before:bg-sky-500",
  },
  attention: {
    label: "Needs you",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800",
    edge: "before:bg-amber-500",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-700",
    edge: "before:bg-red-500",
  },
  posted: {
    label: "Live",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    edge: "before:bg-emerald-500",
  },
};

/** The post's state with its colours; a failure outranks the TikTok inbox. */
export function toneOf(p: SocialPost): Tone & { state: PlanState } {
  const state = planState(p);
  const failed =
    state === "attention" && p.targets.some((t) => t.status === "failed");
  return { ...STATE_TONE[failed ? "failed" : state], state };
}

export const TARGET_TONE: Record<
  TargetStatus,
  { label: string; chip: string }
> = {
  pending: { label: "Scheduled", chip: "bg-zinc-100 text-zinc-600" },
  sending: { label: "Uploading", chip: "bg-sky-50 text-sky-700" },
  processing: { label: "Processing", chip: "bg-sky-50 text-sky-700" },
  inbox: { label: "In TikTok inbox", chip: "bg-amber-50 text-amber-800" },
  published: { label: "Live", chip: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", chip: "bg-red-50 text-red-700" },
};

/** A copy uploaded early (YouTube, private with a publish time) that is not public yet. */
export const goesLiveLater = (t: SocialTargetRow, nowMs: number | null) =>
  t.status === "published" &&
  !!t.job.publish_at &&
  (nowMs === null || Date.parse(t.job.publish_at) > nowMs);

export function targetLabel(
  post: SocialPost,
  t: SocialTargetRow,
  nowMs: number | null,
): string {
  if (post.status === "draft") return "Draft";
  if (goesLiveLater(t, nowMs)) return "Uploaded";
  return TARGET_TONE[t.status].label;
}

export const sortedTargets = (p: SocialPost) =>
  [...p.targets].sort(
    (a, b) =>
      SOCIAL_PLATFORMS.indexOf(a.platform) -
      SOCIAL_PLATFORMS.indexOf(b.platform),
  );

/** Each platform's mark, grey until that copy is live, ringed when it needs you. */
export function PlatformMarks({
  post,
  size = 14,
  nowMs,
}: {
  post: SocialPost;
  size?: number;
  nowMs: number | null;
}) {
  if (!post.targets.length)
    return <span className="text-[11px] text-zinc-400">No platforms</span>;
  return (
    <span className="flex items-center gap-1">
      {sortedTargets(post).map((t) => {
        const live = t.status === "published" && !goesLiveLater(t, nowMs);
        const ring =
          t.status === "failed"
            ? "ring-2 ring-red-500"
            : t.status === "inbox"
              ? "ring-2 ring-amber-500"
              : "";
        const dim =
          post.status === "draft" || t.status === "pending"
            ? "opacity-35 grayscale"
            : live || t.status === "failed" || t.status === "inbox"
              ? ""
              : "opacity-70";
        return (
          <span
            key={t.platform}
            title={`${PLATFORM_NAMES[t.platform]}: ${targetLabel(post, t, nowMs)}${t.job.note ? ` (${t.job.note})` : ""}`}
            className={`inline-flex rounded-full ring-offset-1 ring-offset-[var(--admin-surface)] ${ring}`}
          >
            <span className={`inline-flex ${dim}`}>
              <PlatformLogo platform={t.platform} size={size} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** The post's picture, loading only once it scrolls near the screen. */
export function PostPicture({
  thumb,
  className = "",
}: {
  thumb: PostThumb | undefined;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (thumb?.kind !== "video" || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [thumb]);

  if (!thumb || broken)
    return (
      <span
        className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${className}`}
      >
        <IconFilm size={14} />
      </span>
    );
  if (thumb.kind === "image")
    return (
      // Platform CDN thumbnails; next/image would proxy them through Vercel.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumb.url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={`object-cover ${className}`}
      />
    );
  return (
    <video
      ref={ref}
      src={near ? `${thumb.url}#t=1` : undefined}
      preload="metadata"
      muted
      playsInline
      tabIndex={-1}
      onError={() => setBroken(true)}
      className={`pointer-events-none bg-zinc-200 object-cover ${className}`}
    />
  );
}

/** Drafts and untouched scheduled posts can be dragged to another day. */
export const canMove = (p: SocialPost) => isEditable(p);

type Interactive = {
  post: SocialPost;
  onOpen: (p: SocialPost) => void;
  onDragState?: (id: string | null) => void;
};

function dragProps({ post, onDragState }: Interactive) {
  if (!canMove(post)) return { draggable: false };
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, post.id);
      e.dataTransfer.setData("text/plain", post.name);
      e.dataTransfer.effectAllowed = "move";
      onDragState?.(post.id);
    },
    onDragEnd: () => onDragState?.(null),
  };
}

const openOnKey =
  (post: SocialPost, onOpen: (p: SocialPost) => void) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(post);
    }
  };

function Shell({
  props,
  className,
  children,
  label,
}: {
  props: Interactive;
  className: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => props.onOpen(props.post)}
      onKeyDown={openOnKey(props.post, props.onOpen)}
      {...dragProps(props)}
      className={className}
    >
      {children}
    </div>
  );
}

const describe = (p: SocialPost, state: string) =>
  `${p.name}, ${state}${p.scheduled_at ? `, ${clockTime(new Date(p.scheduled_at))}` : ""}`;

/** A small mark for any state but plain scheduled, named for screen readers and on hover. */
function StateIcon({ post }: { post: SocialPost }) {
  const tone = toneOf(post);
  const failed = post.targets.some((t) => t.status === "failed");
  const icon =
    tone.state === "posted" ? (
      <IconCheck size={12} className="text-emerald-600" />
    ) : tone.state === "attention" ? (
      failed ? (
        <IconAlert size={12} className="text-red-600" />
      ) : (
        <IconInbox size={12} className="text-amber-600" />
      )
    ) : tone.state === "posting" ? (
      <IconClock size={12} className="text-sky-600" />
    ) : tone.state === "draft" ? (
      <span className="rounded bg-zinc-100 px-1 text-[10px] font-medium text-zinc-500">
        Draft
      </span>
    ) : null;
  if (!icon) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center" title={tone.label}>
      {icon}
      <span className="sr-only">{tone.label}</span>
    </span>
  );
}

/** The week view's card. */
export function WeekCard(
  props: Interactive & {
    thumb: PostThumb | undefined;
    nowMs: number | null;
    dragging: boolean;
  },
) {
  const { post, thumb, nowMs, dragging } = props;
  const tone = toneOf(post);
  return (
    <Shell
      props={props}
      label={describe(post, tone.label)}
      className={`group relative flex w-full cursor-pointer gap-2 overflow-hidden rounded-lg border bg-white p-1.5 text-left shadow-sm shadow-black/[0.03] transition duration-150 before:absolute before:inset-y-0 before:left-0 before:w-[3px] hover:-translate-y-px hover:border-zinc-300 hover:shadow-md hover:shadow-black/[0.06] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 ${tone.edge} ${
        post.status === "draft"
          ? "border-dashed border-zinc-300"
          : "border-[var(--admin-border)]"
      } ${dragging ? "opacity-40" : ""} ${canMove(post) ? "active:cursor-grabbing" : ""}`}
    >
      <PostPicture
        thumb={thumb}
        className="ml-0.5 h-[60px] w-[34px] shrink-0 rounded-md"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="flex items-center gap-1.5 text-[11px] leading-none">
          <span className="font-semibold tabular-nums text-zinc-900">
            {post.scheduled_at
              ? clockTime(new Date(post.scheduled_at))
              : "No time"}
          </span>
          <StateIcon post={post} />
        </div>
        <p className="line-clamp-2 text-xs font-medium leading-snug text-zinc-800 [overflow-wrap:anywhere]">
          {post.name}
        </p>
        <PlatformMarks post={post} size={12} nowMs={nowMs} />
      </div>
    </Shell>
  );
}

/** The month view's line. */
export function MonthLine(props: Interactive & { dragging: boolean }) {
  const { post, dragging } = props;
  const tone = toneOf(post);
  return (
    <Shell
      props={props}
      label={describe(post, tone.label)}
      className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-none transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-500 ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="shrink-0 font-semibold tabular-nums text-zinc-900">
        {post.scheduled_at ? clockTime(new Date(post.scheduled_at)) : ""}
      </span>
      <span className="truncate text-zinc-600">{post.name}</span>
    </Shell>
  );
}

/** A draft in the side tray. */
export function DraftCard(
  props: Interactive & {
    thumb: PostThumb | undefined;
    nowMs: number | null;
    dragging: boolean;
  },
) {
  const { post, thumb, nowMs, dragging } = props;
  return (
    <Shell
      props={props}
      label={`${post.name}, draft`}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-zinc-300 bg-white p-1.5 text-left transition hover:border-zinc-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500 ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <PostPicture thumb={thumb} className="h-12 w-7 shrink-0 rounded" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-xs font-medium text-zinc-800">
          {post.name}
        </p>
        <PlatformMarks post={post} size={12} nowMs={nowMs} />
      </div>
    </Shell>
  );
}
