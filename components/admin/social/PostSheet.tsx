"use client";

// A post that has started posting, from the side: where each platform's copy
// is, its caption, links out and to its stats, and what can still be done
// (retry a failure, copy TikTok's caption, copy the post, delete our plan).
// Editable posts skip this and open in the editor.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import {
  dayName,
  clockTime,
  duration,
  isEditable,
} from "@/lib/social/calendar";
import { cleanTags, tagLabels } from "@/lib/social/tags";
import {
  PLATFORM_NAMES,
  type PostThumb,
  type SocialPlatform,
  type SocialPost,
  type SocialTargetRow,
} from "@/lib/social/types";
import { megabytes } from "./client";
import {
  IconChart,
  IconCopy,
  IconExternal,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconX,
} from "./icons";
import {
  goesLiveLater,
  PostPicture,
  sortedTargets,
  targetLabel,
  TARGET_TONE,
  toneOf,
} from "./PlannerCard";
import { LocalTime } from "./LocalTime";
import { TagChips } from "./TagEditor";

const smallButton =
  "inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900";

function TargetBlock({
  post,
  target,
  nowMs,
  onRetry,
  onCopy,
}: {
  post: SocialPost;
  target: SocialTargetRow;
  nowMs: number;
  onRetry: () => void;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  const note = target.error ?? target.job.note ?? null;
  const later = goesLiveLater(target, nowMs);
  return (
    <li className="space-y-2 rounded-lg border border-[var(--admin-border)] p-3">
      <div className="flex items-center gap-2">
        <PlatformLogo platform={target.platform} size={18} />
        <span className="text-sm font-medium text-zinc-900">
          {PLATFORM_NAMES[target.platform]}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${TARGET_TONE[target.status].chip}`}
        >
          {targetLabel(post, target, nowMs)}
        </span>
      </div>
      {later && (
        <p className="text-xs text-zinc-500">
          Goes public <LocalTime iso={target.job.publish_at!} weekday />
        </p>
      )}
      {target.published_at && !later && target.status === "published" && (
        <p className="text-xs text-zinc-500">
          Live since <LocalTime iso={target.published_at} weekday />
        </p>
      )}
      {note && (
        <p
          className={`text-xs leading-relaxed ${target.status === "failed" ? "text-red-700" : "text-zinc-600"}`}
        >
          {note}
        </p>
      )}
      {(target.title || target.caption) && (
        <div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            {open
              ? "Hide caption"
              : target.platform === "youtube"
                ? "Show title and description"
                : "Show caption"}
          </button>
          {open && (
            <div className="mt-1.5 space-y-1 rounded-md bg-zinc-50 p-2.5 text-xs leading-relaxed text-zinc-700">
              {target.title && (
                <p className="font-medium text-zinc-900">{target.title}</p>
              )}
              {target.caption && (
                <p className="whitespace-pre-wrap break-words">
                  {target.caption}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {target.status === "failed" && (
          <button
            type="button"
            onClick={onRetry}
            className={`${smallButton} border-red-200 text-red-700 hover:border-red-300 hover:text-red-800`}
          >
            <IconRefresh size={13} /> Retry
          </button>
        )}
        {target.platform === "tiktok" &&
          target.caption &&
          target.status !== "published" && (
            <button type="button" onClick={onCopy} className={smallButton}>
              <IconCopy size={13} /> Copy caption
            </button>
          )}
        {target.url && (
          <a
            href={target.url}
            target="_blank"
            rel="noreferrer"
            className={smallButton}
          >
            <IconExternal size={13} /> Open on {PLATFORM_NAMES[target.platform]}
          </a>
        )}
        {target.external_id && target.status === "published" && (
          <Link
            href={`/admin/marketing/videos/${target.platform}/${encodeURIComponent(target.external_id)}`}
            className={smallButton}
          >
            <IconChart size={13} /> Stats
          </Link>
        )}
      </div>
    </li>
  );
}

export function PostSheet({
  post,
  thumb,
  nowMs,
  today,
  experimentName,
  onClose,
  onRetry,
  onCopyCaption,
  onDuplicate,
  onDelete,
  onEdit,
}: {
  post: SocialPost;
  thumb: PostThumb | undefined;
  nowMs: number;
  today: Date;
  experimentName: string | null;
  onClose: () => void;
  onRetry: (post: SocialPost, platform: SocialPlatform) => void;
  onCopyCaption: (caption: string) => void;
  onDuplicate: (post: SocialPost) => void;
  onDelete: (post: SocialPost) => void;
  onEdit: (post: SocialPost) => void;
}) {
  const tone = toneOf(post);
  const tags = tagLabels(cleanTags(post.tags));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="slx-fade absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={post.name}
        className="slx-slide relative flex h-full w-full max-w-md flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-[var(--admin-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-zinc-900">
              {post.name}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone.chip}`}
              >
                {tone.label}
              </span>
              {post.scheduled_at && (
                <span>
                  {dayName(new Date(post.scheduled_at), today)},{" "}
                  {clockTime(new Date(post.scheduled_at))}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          <div className="flex gap-3">
            {thumb?.kind === "video" ? (
              <video
                src={thumb.url}
                controls
                muted
                playsInline
                preload="metadata"
                className="h-44 w-[99px] shrink-0 rounded-lg bg-black object-cover"
              />
            ) : (
              <PostPicture
                thumb={thumb}
                className="h-44 w-[99px] shrink-0 rounded-lg"
              />
            )}
            <dl className="min-w-0 space-y-2 text-xs">
              {experimentName && (
                <div>
                  <dt className="text-zinc-400">Experiment</dt>
                  <dd className="text-violet-700">
                    {experimentName} · {post.variant}
                  </dd>
                </div>
              )}
              {(post.media_bytes || post.media_seconds) && (
                <div>
                  <dt className="text-zinc-400">Video</dt>
                  <dd className="text-zinc-700">
                    {[
                      duration(
                        post.media_seconds === null ||
                          post.media_seconds === undefined
                          ? null
                          : Number(post.media_seconds),
                      ),
                      megabytes(post.media_bytes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              )}
              {tags.length > 0 && (
                <div className="space-y-1">
                  <dt className="text-zinc-400">In this video</dt>
                  <dd>
                    <TagChips picked={tags} />
                  </dd>
                </div>
              )}
              {post.notes && (
                <div>
                  <dt className="text-zinc-400">Notes</dt>
                  <dd className="whitespace-pre-wrap text-zinc-700">
                    {post.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <ul className="space-y-2">
            {sortedTargets(post).map((t) => (
              <TargetBlock
                key={t.platform}
                post={post}
                target={t}
                nowMs={nowMs}
                onRetry={() => onRetry(post, t.platform)}
                onCopy={() => onCopyCaption(t.caption ?? "")}
              />
            ))}
          </ul>

          {!isEditable(post) && (
            <p className="text-xs leading-relaxed text-zinc-500">
              A platform has started on this post, so it can&apos;t be edited.
              Copy it to post the same video again with changes, or edit its
              tags from Stats.
            </p>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-[var(--admin-border)] px-4 py-3">
          <button
            type="button"
            onClick={() => onDelete(post)}
            className={`${smallButton} hover:border-red-200 hover:text-red-700`}
          >
            <IconTrash size={13} /> Delete
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(post)}
            className={`${smallButton} ml-auto`}
            title="A new post with the same video and captions"
          >
            <IconCopy size={13} /> Copy as new post
          </button>
          {isEditable(post) && (
            <button
              type="button"
              onClick={() => onEdit(post)}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700"
            >
              <IconPencil size={13} /> Edit
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
