"use client";

// /admin/marketing/planner: every planned post, grouped by what it needs, and
// an editor to upload a video, write each platform's caption and pick a time.
// Saving goes through ../../app/admin/marketing/actions.ts; Post now saves
// with the time set to now and asks marketing-publish to run straight away.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import {
  deleteSocialPost,
  retrySocialTarget,
} from "@/app/admin/marketing/actions";
import {
  canPost,
  PLATFORM_NAMES,
  SOCIAL_PLATFORMS,
  type SocialAccount,
  type SocialExperimentRow,
  type SocialPlatform,
  type SocialPost,
  type SocialTargetRow,
} from "@/lib/social/types";
import { useClientNow } from "@/lib/admin/use-client-now";
import { callFunction, connectNotice, connectPlatform, megabytes } from "./client";
import { PostEditor, editorFromPost, newEditor, type EditorState } from "./PostEditor";
import { LocalTime } from "./LocalTime";

type Group = "attention" | "upcoming" | "drafts" | "posted";

const GROUPS: { key: Group; title: string; empty?: string }[] = [
  { key: "attention", title: "Needs you" },
  { key: "upcoming", title: "Upcoming", empty: "Nothing scheduled. Press New post to plan one." },
  { key: "drafts", title: "Drafts" },
  { key: "posted", title: "Posted" },
];

function groupOf(p: SocialPost): Group {
  if (p.status === "draft") return "drafts";
  if (p.targets.some((t) => t.status === "failed" || t.status === "inbox")) return "attention";
  if (p.targets.some((t) => t.status !== "published")) return "upcoming";
  return "posted";
}

const STATUS_TEXT: Record<SocialTargetRow["status"], string> = {
  pending: "Scheduled",
  sending: "Uploading",
  processing: "Processing",
  inbox: "In TikTok inbox",
  published: "Live",
  failed: "Failed",
};

const STATUS_TONE: Record<SocialTargetRow["status"], string> = {
  pending: "bg-zinc-100 text-zinc-600",
  sending: "bg-sky-50 text-sky-700",
  processing: "bg-sky-50 text-sky-700",
  inbox: "bg-amber-50 text-amber-800",
  published: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

function TargetChip({
  post,
  target,
  now,
  onRetry,
  onCopy,
}: {
  post: SocialPost;
  target: SocialTargetRow;
  // Null until the client has a clock (see use-client-now.ts).
  now: number | null;
  onRetry: () => void;
  onCopy: () => void;
}) {
  const goesLiveLater =
    target.status === "published" &&
    !!target.job.publish_at &&
    (now === null || Date.parse(target.job.publish_at) > now);
  const label =
    post.status === "draft"
      ? "Draft"
      : goesLiveLater
        ? "Uploaded"
        : STATUS_TEXT[target.status];
  const note = target.error ?? target.job.note ?? null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <PlatformLogo platform={target.platform} size={16} />
      <span className={`rounded-full px-2 py-0.5 font-medium ${post.status === "draft" ? STATUS_TONE.pending : STATUS_TONE[target.status]}`}>
        {label}
      </span>
      {goesLiveLater && (
        <span className="text-zinc-500">
          goes public <LocalTime iso={target.job.publish_at!} />
        </span>
      )}
      {target.url && (
        <a href={target.url} target="_blank" rel="noreferrer" className="text-zinc-600 underline hover:text-zinc-900">
          open
        </a>
      )}
      {target.status === "inbox" && target.caption && (
        <button type="button" onClick={onCopy} className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-zinc-600 hover:text-zinc-900">
          Copy caption
        </button>
      )}
      {target.status === "failed" && (
        <button type="button" onClick={onRetry} className="rounded border border-red-200 px-1.5 py-0.5 text-red-700 hover:bg-red-50">
          Retry
        </button>
      )}
      {note && (
        <span className={`basis-full pl-6 ${target.status === "failed" ? "text-red-700" : "text-zinc-500"}`}>
          {note}
        </span>
      )}
    </div>
  );
}

export function Planner({
  posts,
  experiments,
  accounts,
  loadError,
  notice,
}: {
  posts: SocialPost[];
  experiments: SocialExperimentRow[];
  accounts: SocialAccount[];
  loadError: string | null;
  // ?connected= / ?error= from marketing-oauth sending the browser back.
  notice: { connected?: string; error?: string; seen?: string; ig?: string; diag?: string };
}) {
  const router = useRouter();
  const now = useClientNow();
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [message, setMessage] = useState<string | null>(() => connectNotice(notice));
  const [running, setRunning] = useState(false);

  const experimentName = (id: string | null) =>
    experiments.find((e) => e.id === id)?.name ?? null;

  const grouped = useMemo(() => {
    const out: Record<Group, SocialPost[]> = { attention: [], upcoming: [], drafts: [], posted: [] };
    for (const p of posts) out[groupOf(p)].push(p);
    const at = (p: SocialPost) => Date.parse(p.scheduled_at ?? p.updated_at);
    out.upcoming.sort((a, b) => at(a) - at(b));
    out.attention.sort((a, b) => at(a) - at(b));
    out.posted.sort((a, b) => at(b) - at(a));
    return out;
  }, [posts]);

  async function runPublisher() {
    setRunning(true);
    const res = await callFunction("marketing-publish").catch(() => null);
    setRunning(false);
    if (!res?.ok) {
      setMessage("Couldn't run the publisher. Check marketing-publish is deployed and you're verified with MFA.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function retry(post: SocialPost, platform: SocialPlatform) {
    const res = await retrySocialTarget(post.id, platform);
    if (!res.ok) return setMessage(res.error ?? "Retry failed.");
    setMessage(`${PLATFORM_NAMES[platform]} is queued again.`);
    await runPublisher();
  }

  async function remove(post: SocialPost) {
    const live = post.targets.some((t) => t.status === "published");
    const ok = window.confirm(
      live
        ? `Remove "${post.name}" from the planner? The live posts stay up; only our plan goes.`
        : `Delete "${post.name}" and its video file?`,
    );
    if (!ok) return;
    const res = await deleteSocialPost(post.id);
    setMessage(res.ok ? "Deleted." : (res.error ?? "Delete failed."));
    router.refresh();
  }

  const nextVariant = (post: SocialPost) => {
    const exp = experiments.find((e) => e.id === post.experiment_id);
    const keys = exp?.variants.map((v) => v.key) ?? ["A", "B"];
    const i = keys.indexOf(post.variant ?? "A");
    return keys[(i + 1) % keys.length];
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">Planner</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {SOCIAL_PLATFORMS.map((p) => {
            const acc = accounts.find((a) => a.platform === p);
            const ready = canPost(acc);
            return (
              <button
                key={p}
                type="button"
                onClick={async () => setMessage(await connectPlatform(p))}
                className="flex items-center gap-1 rounded-full border border-[var(--admin-border)] px-2 py-0.5 hover:border-zinc-400"
                title={
                  ready
                    ? `${PLATFORM_NAMES[p]} can post. Click to log in again.`
                    : `Log in to ${PLATFORM_NAMES[p]} with the permission to post`
                }
              >
                <PlatformLogo platform={p} size={14} />
                <span className={ready ? "text-emerald-700" : "text-amber-700"}>
                  {ready ? "ready" : acc?.logged_in ? "Reconnect" : "Connect"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runPublisher()}
            disabled={running}
            title="Posting runs every 5 minutes on its own. This runs it now."
            className="rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
          >
            {running ? "Checking..." : "Check now"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(newEditor(accounts))}
            className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            New post
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-4 p-4">
          {(message || loadError) && (
            <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
              {loadError ? `Couldn't load: ${loadError}` : message}
            </p>
          )}

          {GROUPS.map((g) => {
            const list = grouped[g.key];
            // After a failed load an empty list means nothing, so say nothing.
            if (loadError || (!list.length && !g.empty)) return null;
            return (
              <section key={g.key} className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <h2 className="border-b border-[var(--admin-border)] px-4 py-2.5 text-sm font-semibold">
                  {g.title}
                  {list.length > 0 && <span className="ml-2 font-normal text-zinc-400">{list.length}</span>}
                </h2>
                {list.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-zinc-500">{g.empty}</p>
                ) : (
                  <ul>
                    {list.map((p) => {
                      const editable = p.targets.every((t) => t.status === "pending");
                      const exp = experimentName(p.experiment_id);
                      return (
                        <li key={p.id} className="flex flex-col gap-2 border-t border-[var(--admin-border)] px-4 py-3 first:border-t-0 sm:flex-row sm:items-start">
                          <div className="w-36 shrink-0 text-xs text-zinc-500">
                            {p.scheduled_at ? <LocalTime iso={p.scheduled_at} weekday /> : "No time yet"}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium text-zinc-900">{p.name}</span>
                              {exp && (
                                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">
                                  {exp} · {p.variant}
                                </span>
                              )}
                              <span className="text-xs text-zinc-400">
                                {p.media_path ? megabytes(p.media_bytes) : "no video"}
                              </span>
                            </div>
                            {p.targets.length === 0 && <p className="text-xs text-zinc-400">No platforms picked.</p>}
                            {p.targets.map((t) => (
                              <TargetChip
                                key={t.platform}
                                post={p}
                                target={t}
                                now={now}
                                onRetry={() => void retry(p, t.platform)}
                                onCopy={() => {
                                  void navigator.clipboard.writeText(t.caption ?? "");
                                  setMessage("Caption copied. Paste it in TikTok before posting.");
                                }}
                              />
                            ))}
                          </div>
                          <div className="flex shrink-0 gap-1.5 text-xs">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => setEditing(editorFromPost(p))}
                                className="rounded border border-[var(--admin-border)] px-2 py-1 text-zinc-600 hover:text-zinc-900"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({
                                  ...editorFromPost(p),
                                  id: null,
                                  when: "",
                                  name: `${p.name} (${nextVariant(p)})`,
                                  variant: p.experiment_id ? nextVariant(p) : null,
                                })
                              }
                              title="A new post with the same video and captions, as the next variant if it is in an experiment"
                              className="rounded border border-[var(--admin-border)] px-2 py-1 text-zinc-600 hover:text-zinc-900"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => void remove(p)}
                              className="rounded border border-[var(--admin-border)] px-2 py-1 text-zinc-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}

          <p className="text-xs text-zinc-400">
            Posting runs every 5 minutes. YouTube uploads an hour early and goes public on time by
            itself; Instagram posts at the time; TikTok lands in the app&apos;s inbox at the time for
            you to post, because TikTok only lets audited apps post publicly and does not audit
            tools for your own accounts.
          </p>
        </div>
      </div>

      {editing && (
        <PostEditor
          initial={editing}
          experiments={experiments.filter((e) => e.status === "running" || e.id === editing.experimentId)}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={async (msg, postNow) => {
            setEditing(null);
            setMessage(msg);
            if (postNow) {
              if (await runPublisher()) setMessage("Posting now. Instagram and YouTube take a minute or two.");
            } else router.refresh();
          }}
        />
      )}
    </div>
  );
}
