"use client";

// /admin/marketing/planner: the plan as a week, a month or a list by day,
// with what needs a person (a failed platform, a TikTok waiting in the inbox)
// at the top and drafts in a tray beside it. Click a post to edit it, or to
// see where it is once a platform has started; drag one to another day to
// move it. Saving goes through ../../app/admin/marketing/actions.ts; Post now
// and Check now ask marketing-publish to run straight away.
//
// The calendar renders only once the browser has a clock (useClientNow), so
// days and times are always the viewer's own and never differ from the
// server's render.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import {
  deleteSocialPost,
  retrySocialTarget,
  saveSocialPost,
  type PostDraft,
} from "@/app/admin/marketing/actions";
import {
  dayKey,
  fromDayKey,
  isEditable,
  monthGrid,
  onDay,
  rangeLabel,
  shiftAnchor,
  slotOnDay,
  toLocalInput,
  usualTimes,
  weekDays,
  whenLabel,
  type PlannerView,
} from "@/lib/social/calendar";
import { useClientNow } from "@/lib/admin/use-client-now";
import { cleanTags, tagOptions } from "@/lib/social/tags";
import {
  canPost,
  PLATFORM_NAMES,
  SOCIAL_PLATFORMS,
  type PostThumb,
  type SocialAccount,
  type SocialExperimentRow,
  type SocialPlatform,
  type SocialPost,
} from "@/lib/social/types";
import { callFunction, connectNotice, connectPlatform } from "./client";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconPlus,
  IconRefresh,
  IconX,
} from "./icons";
import { DraftCard, toneOf } from "./PlannerCard";
import { usePlannerPrefs } from "./plannerPrefs";
import { PlannerSkeleton } from "./PlannerSkeleton";
import { ListView, MonthView, WeekView, type ViewProps } from "./PlannerViews";
import {
  PostEditor,
  editorFromPost,
  newEditor,
  type EditorState,
} from "./PostEditor";
import { PostSheet } from "./PostSheet";
import { ToastStack, useToasts } from "./Toasts";

const VIEW_LABEL: Record<PlannerView, string> = {
  week: "Week",
  month: "Month",
  list: "List",
};

const segment = (on: boolean) =>
  `rounded-md px-2.5 py-1 text-xs font-medium transition ${on ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`;

/** The post as a save request, at a new time, with everything else as it is. */
function draftAt(p: SocialPost, at: Date): PostDraft {
  return {
    id: p.id,
    name: p.name,
    media_path: p.media_path,
    media_bytes: p.media_bytes,
    media_type: p.media_type,
    cover_path: p.cover_path,
    schedule: p.status !== "draft",
    scheduled_at: at.toISOString(),
    experiment_id: p.experiment_id,
    variant: p.variant,
    notes: p.notes,
    targets: p.targets.map((t) => ({
      platform: t.platform,
      title: t.title ?? "",
      caption: t.caption ?? "",
      options: t.options as Record<string, unknown>,
    })),
  };
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function Planner({
  posts,
  experiments,
  accounts,
  thumbs,
  loadError,
  notice,
}: {
  posts: SocialPost[];
  experiments: SocialExperimentRow[];
  accounts: SocialAccount[];
  thumbs: Record<string, PostThumb>;
  loadError: string | null;
  // ?connected= / ?error= from marketing-oauth sending the browser back.
  notice: {
    connected?: string;
    error?: string;
    seen?: string;
    ig?: string;
    diag?: string;
  };
}) {
  const router = useRouter();
  const now = useClientNow();
  const [prefs, setPrefs] = usePlannerPrefs();
  const { toasts, push, dismiss } = useToasts();
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    state: EditorState;
    source: SocialPost | null;
  } | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(() =>
    connectNotice(notice),
  );
  const [running, setRunning] = useState(false);
  // Moves saved but not yet in the refreshed page: applied while the server
  // still shows the time they moved from.
  const [moves, setMoves] = useState<
    Record<string, { from: string | null; to: string }>
  >({});

  const shown = useMemo(
    () =>
      posts.map((p) => {
        const m = moves[p.id];
        return m && m.from === p.scheduled_at
          ? { ...p, scheduled_at: m.to }
          : p;
      }),
    [posts, moves],
  );
  const filtered = useMemo(
    () =>
      prefs.platform === "all"
        ? shown
        : shown.filter((p) =>
            p.targets.some((t) => t.platform === prefs.platform),
          ),
    [shown, prefs.platform],
  );
  const drafts = filtered.filter((p) => p.status === "draft");
  const attention = filtered.flatMap((p) =>
    p.targets
      .filter((t) => t.status === "failed" || t.status === "inbox")
      .map((t) => ({ post: p, target: t })),
  );
  const times = useMemo(() => usualTimes(posts), [posts]);

  const today = now === null ? null : new Date(now);
  const anchor = anchorKey ? fromDayKey(anchorKey) : today;
  const sheetPost = sheetId
    ? (shown.find((p) => p.id === sheetId) ?? null)
    : null;

  const experimentName = (id: string | null) =>
    experiments.find((e) => e.id === id)?.name ?? null;

  const nextVariant = (post: SocialPost) => {
    const exp = experiments.find((e) => e.id === post.experiment_id);
    const keys = exp?.variants.map((v) => v.key) ?? ["A", "B"];
    const i = keys.indexOf(post.variant ?? "A");
    return keys[(i + 1) % keys.length];
  };

  async function runPublisher() {
    setRunning(true);
    const res = await callFunction("marketing-publish").catch(() => null);
    setRunning(false);
    if (!res?.ok) {
      push(
        "Couldn't run the publisher. Check marketing-publish is deployed and you're verified with MFA.",
        "error",
      );
      return false;
    }
    router.refresh();
    return true;
  }

  function create(day?: Date) {
    if (now === null) return;
    const when = day ? toLocalInput(slotOnDay(posts, times, day, now)) : "";
    setSheetId(null);
    setEditing({ state: newEditor(accounts, when), source: null });
  }

  function open(p: SocialPost) {
    if (isEditable(p)) {
      setSheetId(null);
      setEditing({ state: editorFromPost(p), source: p });
    } else setSheetId(p.id);
  }

  function duplicate(p: SocialPost) {
    setSheetId(null);
    setEditing({
      state: {
        ...editorFromPost(p),
        id: null,
        when: "",
        name: `${p.name} (${nextVariant(p)})`,
        variant: p.experiment_id ? nextVariant(p) : null,
      },
      source: null,
    });
  }

  async function remove(p: SocialPost) {
    const live = p.targets.some((t) => t.status === "published");
    const ok = window.confirm(
      live
        ? `Remove "${p.name}" from the planner? The live posts stay up; only our plan goes.`
        : `Delete "${p.name}" and its video file?`,
    );
    if (!ok) return;
    const res = await deleteSocialPost(p.id);
    if (!res.ok) return push(res.error ?? "Delete failed.", "error");
    setSheetId(null);
    setEditing(null);
    push(`Deleted "${p.name}".`);
    router.refresh();
  }

  async function retry(p: SocialPost, platform: SocialPlatform) {
    const res = await retrySocialTarget(p.id, platform);
    if (!res.ok) return push(res.error ?? "Retry failed.", "error");
    push(`${PLATFORM_NAMES[platform]} is queued again.`);
    await runPublisher();
  }

  function copyCaption(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => push("Caption copied. Paste it in TikTok before posting."),
      () =>
        push(
          "Couldn't copy. Open the post and copy the caption by hand.",
          "error",
        ),
    );
  }

  async function reschedule(
    p: SocialPost,
    from: string | null,
    at: Date,
    undoable = true,
  ) {
    const server = posts.find((x) => x.id === p.id)?.scheduled_at ?? null;
    setMoves((m) => ({ ...m, [p.id]: { from: server, to: at.toISOString() } }));
    const res = await saveSocialPost(draftAt(p, at));
    if (!res.ok) {
      setMoves((m) => {
        const rest = { ...m };
        delete rest[p.id];
        return rest;
      });
      push(res.error ?? "Couldn't move it.", "error");
      return;
    }
    router.refresh();
    const soon =
      p.targets.some((t) => t.platform === "youtube") &&
      at.getTime() - Date.now() < 70 * 60_000;
    push(
      `Moved "${p.name}" to ${whenLabel(at, new Date())}.${soon ? " YouTube uploads an hour ahead, so it may go live a few minutes late." : ""}`,
      "ok",
      undoable && from
        ? {
            label: "Undo",
            run: () =>
              void reschedule(
                { ...p, scheduled_at: at.toISOString() },
                null,
                new Date(from),
                false,
              ),
          }
        : undefined,
    );
  }

  function drop(id: string, day: Date) {
    const p = shown.find((x) => x.id === id);
    if (!p || now === null || !isEditable(p)) return;
    if (p.status === "draft") {
      const at = p.scheduled_at
        ? onDay(p.scheduled_at, day)
        : slotOnDay(posts, times, day, now);
      setEditing({
        state: {
          ...editorFromPost(p),
          when: toLocalInput(
            at.getTime() > now ? at : slotOnDay(posts, times, day, now),
          ),
        },
        source: p,
      });
      return;
    }
    if (!p.scheduled_at) return;
    const at = onDay(p.scheduled_at, day);
    if (dayKey(at) === dayKey(new Date(p.scheduled_at))) return;
    if (at.getTime() < now + 60_000) {
      push(
        `${whenLabel(at, new Date(now))} has passed. Open the post to pick a later time.`,
        "error",
      );
      return;
    }
    void reschedule(p, p.scheduled_at, at);
  }

  // N for a new post, T for today, arrow keys to step, when nothing is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        editing ||
        sheetId ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        typing(e.target)
      )
        return;
      if (e.key === "n") {
        e.preventDefault();
        create();
      } else if (e.key === "t") setAnchorKey(null);
      else if (
        prefs.view !== "list" &&
        anchor &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      )
        setAnchorKey(
          dayKey(
            shiftAnchor(anchor, prefs.view, e.key === "ArrowLeft" ? -1 : 1),
          ),
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // What the visible range holds, for the line beside its dates.
  const rangeDays =
    anchor && prefs.view !== "list"
      ? prefs.view === "week"
        ? weekDays(anchor)
        : monthGrid(anchor).filter((d) => d.getMonth() === anchor.getMonth())
      : [];
  const rangeKeys = new Set(rangeDays.map(dayKey));
  const inRange = filtered.filter(
    (p) => p.scheduled_at && rangeKeys.has(dayKey(new Date(p.scheduled_at))),
  );
  const counts = { planned: 0, live: 0, attention: 0 };
  for (const p of inRange) {
    const state = toneOf(p).state;
    if (state === "posted") counts.live++;
    else if (state === "attention") counts.attention++;
    else if (state !== "draft") counts.planned++;
  }
  const isCurrent =
    !!today &&
    !!anchor &&
    rangeLabel(prefs.view, anchor) === rangeLabel(prefs.view, today);

  const viewProps: Omit<ViewProps, "anchor" | "today" | "nowMs"> = {
    posts: filtered,
    thumbs,
    experimentName,
    dragging,
    onDragState: setDragging,
    onOpen: open,
    onCreate: create,
    onDrop: drop,
    onFocusDay: (d) => {
      setAnchorKey(dayKey(d));
      setPrefs({ view: "week" });
    },
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">Planner</h1>
        <div className="flex items-center gap-1" aria-label="Accounts">
          {SOCIAL_PLATFORMS.map((p) => {
            const acc = accounts.find((a) => a.platform === p);
            const ready = canPost(acc);
            return (
              <button
                key={p}
                type="button"
                onClick={async () => {
                  const err = await connectPlatform(p);
                  if (err) push(err, "error");
                }}
                className={`relative flex items-center gap-1.5 rounded-full py-1 transition hover:bg-zinc-100 ${ready ? "px-1" : "border border-amber-300 pl-1 pr-2"}`}
                title={
                  ready
                    ? `${PLATFORM_NAMES[p]} can post${acc?.handle ? ` as @${acc.handle.replace(/^@/, "")}` : ""}. Click to log in again.`
                    : `Log in to ${PLATFORM_NAMES[p]} with the permission to post`
                }
              >
                <PlatformLogo platform={p} size={16} />
                {ready ? (
                  <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[var(--admin-surface)]" />
                ) : (
                  <span className="text-[11px] font-medium text-amber-700">
                    {acc?.logged_in ? "Reconnect" : "Connect"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void runPublisher().then(
                (ok) => ok && push("Checked. Anything due is on its way."),
              )
            }
            disabled={running}
            title="Posting runs every 5 minutes on its own. This runs it now."
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-2.5 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
          >
            <IconRefresh size={14} className={running ? "animate-spin" : ""} />
            <span className="hidden sm:inline">
              {running ? "Checking" : "Check now"}
            </span>
          </button>
          <a
            href="salelinx-tiktok://schedule"
            onClick={() =>
              push(
                "Scheduling TikTok posts in TikTok Studio. Each shows as processing once it's in.",
              )
            }
            title="Puts every pending TikTok post due in the next 10 days into TikTok Studio's scheduler. Runs on the Mac with TikTok Studio Scheduler.app installed."
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-2.5 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            <PlatformLogo platform="tiktok" size={14} />
            <span className="hidden sm:inline">Schedule in Studio</span>
          </a>
          <button
            type="button"
            onClick={() => create()}
            title="New post (N)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-700"
          >
            <IconPlus size={14} /> New post
          </button>
        </div>
      </header>

      {!today || !anchor ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <PlannerSkeleton withHeader={false} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] space-y-4 p-4">
            {(banner || loadError) && (
              <div className="flex items-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-zinc-700">
                <p className="flex-1">
                  {loadError
                    ? `Couldn't load the planner: ${loadError}`
                    : banner}
                </p>
                {!loadError && (
                  <button
                    type="button"
                    onClick={() => setBanner(null)}
                    aria-label="Dismiss"
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-900"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            )}

            {attention.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/40">
                <h2 className="flex items-center gap-2 px-3.5 pt-2.5 text-sm font-semibold text-amber-900">
                  <IconAlert size={15} /> Needs you
                  <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                    {attention.length}
                  </span>
                </h2>
                <ul className="divide-y divide-amber-200/70 px-1.5 pb-1.5 pt-1">
                  {attention.map(({ post, target }) => (
                    <li
                      key={`${post.id}:${target.platform}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2"
                    >
                      <PlatformLogo platform={target.platform} size={16} />
                      <button
                        type="button"
                        onClick={() => setSheetId(post.id)}
                        className="text-sm font-medium text-zinc-900 hover:underline"
                      >
                        {post.name}
                      </button>
                      <span className="min-w-0 flex-1 basis-60 text-xs text-zinc-600">
                        {target.status === "failed" ? (
                          <span className="text-red-700">
                            {target.error ??
                              `${PLATFORM_NAMES[target.platform]} failed.`}
                          </span>
                        ) : (
                          "In the TikTok inbox. Open TikTok, tap the notification, paste the caption and post."
                        )}
                      </span>
                      <span className="flex gap-1.5">
                        {target.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => void retry(post, target.platform)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 transition hover:border-red-300"
                          >
                            <IconRefresh size={13} /> Retry
                          </button>
                        ) : (
                          target.caption && (
                            <button
                              type="button"
                              onClick={() => copyCaption(target.caption ?? "")}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-900 transition hover:border-amber-300"
                            >
                              <IconCopy size={13} /> Copy caption
                            </button>
                          )
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {prefs.view !== "list" && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAnchorKey(null)}
                    disabled={isCurrent}
                    title="Today (T)"
                    className="rounded-lg border border-[var(--admin-border)] px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAnchorKey(dayKey(shiftAnchor(anchor, prefs.view, -1)))
                    }
                    aria-label={`Previous ${prefs.view}`}
                    title="Previous (left arrow)"
                    className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <IconChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAnchorKey(dayKey(shiftAnchor(anchor, prefs.view, 1)))
                    }
                    aria-label={`Next ${prefs.view}`}
                    title="Next (right arrow)"
                    className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <IconChevronRight size={16} />
                  </button>
                  <h2 className="ml-1 text-base font-semibold tracking-tight text-zinc-900">
                    {rangeLabel(prefs.view, anchor)}
                  </h2>
                </div>
              )}
              {prefs.view === "list" && (
                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                  Everything planned
                </h2>
              )}
              {prefs.view !== "list" && (
                <p className="text-xs text-zinc-500">
                  {[
                    counts.planned ? `${counts.planned} planned` : "",
                    counts.live ? `${counts.live} live` : "",
                    counts.attention ? `${counts.attention} need you` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Nothing planned"}
                </p>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div
                  className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5"
                  role="group"
                  aria-label="Platform"
                >
                  <button
                    type="button"
                    aria-pressed={prefs.platform === "all"}
                    onClick={() => setPrefs({ platform: "all" })}
                    className={segment(prefs.platform === "all")}
                  >
                    All
                  </button>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={prefs.platform === p}
                      aria-label={PLATFORM_NAMES[p]}
                      title={`Only posts going to ${PLATFORM_NAMES[p]}`}
                      onClick={() => setPrefs({ platform: p })}
                      className={`${segment(prefs.platform === p)} px-1.5`}
                    >
                      <span
                        className={
                          prefs.platform === p ? "" : "opacity-60 grayscale"
                        }
                      >
                        <PlatformLogo platform={p} size={14} />
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5"
                  role="group"
                  aria-label="View"
                >
                  {(["week", "month", "list"] as PlannerView[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={prefs.view === v}
                      onClick={() => setPrefs({ view: v })}
                      className={segment(prefs.view === v)}
                    >
                      {VIEW_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start">
              <div className="min-w-0 flex-1">
                {prefs.view === "week" && (
                  <WeekView
                    {...viewProps}
                    anchor={anchor}
                    today={today}
                    nowMs={now!}
                  />
                )}
                {prefs.view === "month" && (
                  <MonthView
                    {...viewProps}
                    anchor={anchor}
                    today={today}
                    nowMs={now!}
                  />
                )}
                {prefs.view === "list" && (
                  <ListView
                    {...viewProps}
                    anchor={anchor}
                    today={today}
                    nowMs={now!}
                    onNew={() => create()}
                  />
                )}
              </div>

              <aside className="w-full shrink-0 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] 2xl:sticky 2xl:top-0 2xl:w-64">
                <h2 className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3.5 py-2.5 text-sm font-semibold">
                  Drafts
                  {drafts.length > 0 && (
                    <span className="rounded-full bg-zinc-100 px-1.5 text-xs font-medium text-zinc-500">
                      {drafts.length}
                    </span>
                  )}
                </h2>
                {drafts.length ? (
                  <div className="space-y-1.5 p-2">
                    <p className="px-1 pb-1 text-[11px] text-zinc-400">
                      Drag one onto a day to schedule it.
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-1">
                      {drafts.map((p) => (
                        <DraftCard
                          key={p.id}
                          post={p}
                          thumb={thumbs[p.id]}
                          nowMs={now}
                          dragging={dragging === p.id}
                          onOpen={open}
                          onDragState={setDragging}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="px-3.5 py-4 text-xs leading-relaxed text-zinc-500">
                    No drafts. Save draft in the editor keeps a post here until
                    it&apos;s ready to schedule.
                  </p>
                )}
              </aside>
            </div>

            <p className="text-xs leading-relaxed text-zinc-400">
              Posting runs every 5 minutes. YouTube uploads an hour early and
              goes public on time by itself; Instagram and Facebook post at the
              time; TikTok posts are scheduled in TikTok Studio every morning at
              8 (or now, with Schedule in Studio), and any it missed land in the
              app&apos;s inbox at the time for you to post. Times are in your own time
              zone. Keys: N new post, T today, arrows to step.
            </p>
          </div>
        </div>
      )}

      {editing && (
        <PostEditor
          key={editing.state.id ?? "new"}
          initial={editing.state}
          experiments={experiments.filter(
            (e) =>
              e.status === "running" || e.id === editing.state.experimentId,
          )}
          accounts={accounts}
          posts={shown}
          tagOptions={tagOptions(posts.map((p) => cleanTags(p.tags)))}
          onClose={() => setEditing(null)}
          onDuplicate={
            editing.source ? () => duplicate(editing.source!) : undefined
          }
          onDelete={
            editing.source ? () => void remove(editing.source!) : undefined
          }
          onSaved={async (msg, postNow) => {
            setEditing(null);
            if (postNow) {
              if (await runPublisher())
                push(
                  "Posting now. Instagram and YouTube take a minute or two.",
                );
            } else {
              push(msg);
              router.refresh();
            }
          }}
        />
      )}

      {sheetPost && today && now !== null && (
        <PostSheet
          post={sheetPost}
          thumb={thumbs[sheetPost.id]}
          nowMs={now}
          today={today}
          experimentName={experimentName(sheetPost.experiment_id)}
          onClose={() => setSheetId(null)}
          onRetry={(p, platform) => void retry(p, platform)}
          onCopyCaption={copyCaption}
          onDuplicate={duplicate}
          onDelete={(p) => void remove(p)}
          onEdit={(p) => open(p)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
