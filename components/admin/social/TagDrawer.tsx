"use client";

// Tags one video, or steps through a queue of untagged ones ("Tag older
// videos" on Stats). Saving goes through setSocialTags: a planner post's tags
// are shared by all its platforms, a lone video's are its own.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSocialTags } from "@/app/admin/marketing/actions";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import type { OverviewRow } from "@/lib/social/overview";
import type { SocialTags, TagGroupKey } from "@/lib/social/tags";
import { SOCIAL_PLATFORMS } from "@/lib/social/types";
import { LocalTime } from "./LocalTime";
import { TagChips, TagEditor } from "./TagEditor";

export function TagDrawer({
  queue,
  options,
  onClose,
}: {
  queue: OverviewRow[];
  options: Record<TagGroupKey, string[]>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [at, setAt] = useState(0);
  const [tags, setTags] = useState<SocialTags>(queue[0]?.tags ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const row = queue[at];
  if (!row) return null;
  const last = at >= queue.length - 1;

  function go(next: number) {
    if (next >= queue.length) {
      onClose();
      return;
    }
    setAt(next);
    setTags(queue[next].tags);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await setSocialTags({
      postId: row.tagTarget.postId,
      platform: row.tagTarget.platform,
      externalId: row.tagTarget.externalId,
      tags,
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error?.includes("admin_set_social_tags")
          ? "Tags need migration 054_social_tags.sql, which hasn't run yet."
          : `Couldn't save: ${res.error ?? "unknown error"}`,
      );
      return;
    }
    router.refresh();
    go(at + 1);
  }

  const first = SOCIAL_PLATFORMS.map((p) => row.videos[p]).find(Boolean);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
      <div className="flex h-full w-full max-w-lg flex-col bg-[var(--admin-surface)] shadow-xl">
        <div className="flex min-h-12 items-center gap-2 border-b border-[var(--admin-border)] px-4">
          <h2 className="mr-auto text-sm font-semibold">
            {queue.length > 1 ? `Tag videos, ${at + 1} of ${queue.length}` : "Tags"}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-900" aria-label="Close">
            x
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-sm">
          <div className="flex gap-3">
            {row.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.thumbnail} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-24 w-16 shrink-0 rounded bg-zinc-100" />
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-zinc-900">{row.title}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                {SOCIAL_PLATFORMS.filter((p) => row.videos[p]).map((p) => (
                  <PlatformLogo key={p} platform={p} size={14} />
                ))}
                {row.publishedAt && <LocalTime iso={row.publishedAt} weekday />}
              </p>
              <TagChips picked={[]} auto={row.auto} />
              {first && (
                <Link
                  href={`/admin/marketing/videos/${first.platform}/${encodeURIComponent(first.external_id)}`}
                  className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                >
                  Open its page
                </Link>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            {row.postId
              ? "Posted from the planner, so these tags cover every platform it went to."
              : "Tags for this one video. Dashed tags above are read automatically."}
            {tags.by === "auto" && " Filled in automatically: change anything to make them yours."}
          </p>
          <TagEditor value={tags} onChange={setTags} options={options} />
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] px-4 py-3">
          {queue.length > 1 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => go(at + 1)}
              className="rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 disabled:opacity-50"
            >
              {last ? "Skip and finish" : "Skip"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="ml-auto rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Saving..." : queue.length > 1 && !last ? "Save and next" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
