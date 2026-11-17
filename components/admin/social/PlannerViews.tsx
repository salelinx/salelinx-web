"use client";

// The planner's three ways of looking at the plan: a week of day columns, a
// month grid and a list by day. Days are drop targets: a draft dropped on one
// opens the editor at that day, a scheduled post moves there at the same time
// (Planner.tsx does both). Past days take no drops and offer no Add. They
// render only in the browser, once the clock is known (see Planner.tsx), so
// local times need no hydration care here.

import { useState, type DragEvent, type ReactNode } from "react";
import {
  clockTime,
  dayKey,
  dayName,
  fromDayKey,
  monthGrid,
  postsByDay,
  shortDate,
  startOfDay,
  WEEKDAYS,
  weekDays,
} from "@/lib/social/calendar";
import type { PostThumb, SocialPost } from "@/lib/social/types";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { IconPlus } from "./icons";
import {
  DRAG_TYPE,
  MonthLine,
  PostPicture,
  sortedTargets,
  targetLabel,
  TARGET_TONE,
  toneOf,
  WeekCard,
} from "./PlannerCard";

export type ViewProps = {
  posts: SocialPost[];
  thumbs: Record<string, PostThumb>;
  anchor: Date;
  today: Date;
  nowMs: number;
  experimentName: (id: string | null) => string | null;
  dragging: string | null;
  onDragState: (id: string | null) => void;
  onOpen: (p: SocialPost) => void;
  onCreate: (day: Date) => void;
  onDrop: (postId: string, day: Date) => void;
  onFocusDay: (day: Date) => void;
};

/** Drop handling for one day, with the highlight while something hovers over it. */
function useDropDay(day: Date, today: Date, onDrop: ViewProps["onDrop"]) {
  const [over, setOver] = useState(false);
  const open = startOfDay(day) >= startOfDay(today);
  const accepts = (e: DragEvent) =>
    open && e.dataTransfer.types.includes(DRAG_TYPE);
  return {
    over,
    handlers: {
      onDragOver: (e: DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOver(false);
      },
      onDrop: (e: DragEvent) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (!accepts(e) || !id) return;
        e.preventDefault();
        onDrop(id, day);
      },
    },
  };
}

function AddButton({
  onClick,
  label,
  className = "",
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 ${className}`}
    >
      <IconPlus size={14} />
    </button>
  );
}

function DayColumn({
  day,
  posts,
  props,
}: {
  day: Date;
  posts: SocialPost[];
  props: ViewProps;
}) {
  const { today, onCreate, onDrop } = props;
  const { over, handlers } = useDropDay(day, today, onDrop);
  const isToday = dayKey(day) === dayKey(today);
  const past = startOfDay(day) < startOfDay(today);
  return (
    <section
      {...handlers}
      aria-label={shortDate(day)}
      className={`group/day flex min-w-0 flex-col transition-colors ${
        over ? "bg-blue-50" : past ? "bg-zinc-50" : "bg-[var(--admin-surface)]"
      }`}
    >
      <header className="flex items-center gap-2 px-2.5 pb-1.5 pt-2.5">
        <span
          className={`text-[11px] font-medium uppercase tracking-wide ${isToday ? "text-blue-600" : "text-zinc-500"}`}
        >
          {WEEKDAYS[(day.getDay() + 6) % 7]}
        </span>
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums ${
            isToday
              ? "bg-blue-600 text-white"
              : past
                ? "text-zinc-400"
                : "text-zinc-900"
          }`}
        >
          {day.getDate()}
        </span>
        {!past && (
          <AddButton
            onClick={() => onCreate(day)}
            label={`New post on ${shortDate(day)}`}
            className="ml-auto h-6 w-6 opacity-0 group-hover/day:opacity-100 [@media(pointer:coarse)]:opacity-100"
          />
        )}
      </header>
      <div
        className={`flex flex-1 flex-col gap-1.5 px-1.5 pb-2 ${over ? "rounded-lg outline-2 -outline-offset-4 outline-dashed outline-blue-400" : ""}`}
      >
        {posts.map((p) => (
          <WeekCard
            key={p.id}
            post={p}
            thumb={props.thumbs[p.id]}
            nowMs={props.nowMs}
            dragging={props.dragging === p.id}
            onOpen={props.onOpen}
            onDragState={props.onDragState}
          />
        ))}
        {!posts.length && !past && (
          <button
            type="button"
            onClick={() => onCreate(day)}
            className="hidden min-h-16 flex-1 items-center justify-center rounded-lg border border-dashed border-transparent text-xs text-zinc-400 transition hover:border-zinc-300 hover:text-zinc-600 md:flex"
          >
            <span className="opacity-0 transition group-hover/day:opacity-100">
              Add post
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

export function WeekView(props: ViewProps) {
  const byDay = postsByDay(props.posts);
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-border)] md:min-h-[28rem] md:grid-cols-7">
      {weekDays(props.anchor).map((d) => (
        <DayColumn
          key={dayKey(d)}
          day={d}
          posts={byDay.get(dayKey(d)) ?? []}
          props={props}
        />
      ))}
    </div>
  );
}

const MONTH_SHOWN = 3;

function MonthCell({
  day,
  posts,
  props,
  inMonth,
}: {
  day: Date;
  posts: SocialPost[];
  props: ViewProps;
  inMonth: boolean;
}) {
  const { today, onCreate, onDrop, onFocusDay } = props;
  const { over, handlers } = useDropDay(day, today, onDrop);
  const isToday = dayKey(day) === dayKey(today);
  const past = startOfDay(day) < startOfDay(today);
  const extra = posts.length - MONTH_SHOWN;
  return (
    <div
      {...handlers}
      className={`group/day flex min-h-16 min-w-0 flex-col gap-0.5 p-1 transition-colors md:min-h-28 ${
        over
          ? "bg-blue-50"
          : !inMonth || past
            ? "bg-zinc-50"
            : "bg-[var(--admin-surface)]"
      }`}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onFocusDay(day)}
          title={`Open the week of ${shortDate(day)}`}
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums transition hover:bg-zinc-100 ${
            isToday
              ? "bg-blue-600 text-white hover:bg-blue-600"
              : !inMonth || past
                ? "text-zinc-400"
                : "text-zinc-800"
          }`}
        >
          {day.getDate()}
        </button>
        {!past && (
          <AddButton
            onClick={() => onCreate(day)}
            label={`New post on ${shortDate(day)}`}
            className="ml-auto hidden h-5 w-5 opacity-0 group-hover/day:opacity-100 md:flex"
          />
        )}
      </div>
      {/* Phones: a dot per post, tap the day for the week. */}
      {posts.length > 0 && (
        <button
          type="button"
          onClick={() => onFocusDay(day)}
          className="flex flex-wrap gap-1 px-1 md:hidden"
          aria-label={`${posts.length} posts`}
        >
          {posts.map((p) => (
            <span
              key={p.id}
              className={`h-1.5 w-1.5 rounded-full ${toneOf(p).dot}`}
            />
          ))}
        </button>
      )}
      <div className="hidden flex-col gap-px md:flex">
        {posts.slice(0, MONTH_SHOWN).map((p) => (
          <MonthLine
            key={p.id}
            post={p}
            dragging={props.dragging === p.id}
            onOpen={props.onOpen}
            onDragState={props.onDragState}
          />
        ))}
        {extra > 0 && (
          <button
            type="button"
            onClick={() => onFocusDay(day)}
            className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {extra} more
          </button>
        )}
      </div>
    </div>
  );
}

export function MonthView(props: ViewProps) {
  const byDay = postsByDay(props.posts);
  const month = props.anchor.getMonth();
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-border)]">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-[var(--admin-surface)] px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500"
          >
            {w}
          </div>
        ))}
        {monthGrid(props.anchor).map((d) => (
          <MonthCell
            key={dayKey(d)}
            day={d}
            posts={byDay.get(dayKey(d)) ?? []}
            props={props}
            inMonth={d.getMonth() === month}
          />
        ))}
      </div>
    </div>
  );
}

function ListRow({ post, props }: { post: SocialPost; props: ViewProps }) {
  const tone = toneOf(post);
  const exp = props.experimentName(post.experiment_id);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => props.onOpen(post)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onOpen(post);
          }
        }}
        className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 sm:px-4"
      >
        <div className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
          {post.scheduled_at ? clockTime(new Date(post.scheduled_at)) : ""}
        </div>
        <PostPicture
          thumb={props.thumbs[post.id]}
          className="h-16 w-9 shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-zinc-900">{post.name}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone.chip}`}
            >
              {tone.label}
            </span>
            {exp && (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700">
                {exp} · {post.variant}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {sortedTargets(post).map((t) => (
              <span
                key={t.platform}
                className="flex items-center gap-1.5 text-xs"
                title={t.error ?? t.job.note ?? undefined}
              >
                <PlatformLogo platform={t.platform} size={14} />
                <span
                  className={`rounded-full px-1.5 py-px text-[11px] font-medium ${post.status === "draft" ? TARGET_TONE.pending.chip : TARGET_TONE[t.status].chip}`}
                >
                  {targetLabel(post, t, props.nowMs)}
                </span>
              </span>
            ))}
            {!post.targets.length && (
              <span className="text-xs text-zinc-400">No platforms picked</span>
            )}
          </div>
          {sortedTargets(post)
            .filter((t) => t.error || t.job.note)
            .map((t) => (
              <p
                key={t.platform}
                className={`flex items-start gap-1.5 text-xs ${t.status === "failed" ? "text-red-700" : "text-zinc-500"}`}
              >
                <span className="mt-px">
                  <PlatformLogo platform={t.platform} size={12} />
                </span>
                {t.error ?? t.job.note}
              </p>
            ))}
        </div>
      </div>
    </li>
  );
}

function DayGroup({
  day,
  posts,
  props,
  children,
}: {
  day: Date;
  posts: SocialPost[];
  props: ViewProps;
  children?: ReactNode;
}) {
  const isToday = dayKey(day) === dayKey(props.today);
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <h3 className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3 py-2 text-xs sm:px-4">
        <span
          className={`font-semibold ${isToday ? "text-blue-600" : "text-zinc-900"}`}
        >
          {dayName(day, props.today)}
        </span>
        {dayName(day, props.today) !== shortDate(day) && (
          <span className="text-zinc-400">{shortDate(day)}</span>
        )}
        <span className="ml-auto text-zinc-400">
          {posts.length === 1 ? "1 post" : `${posts.length} posts`}
        </span>
        {children}
      </h3>
      <ul className="divide-y divide-[var(--admin-border)]">
        {posts.map((p) => (
          <ListRow key={p.id} post={p} props={props} />
        ))}
      </ul>
    </section>
  );
}

export function ListView(props: ViewProps & { onNew: () => void }) {
  const [showPast, setShowPast] = useState(false);
  const byDay = postsByDay(props.posts.filter((p) => p.status !== "draft"));
  const todayKey = dayKey(props.today);
  const keys = [...byDay.keys()];
  const upcoming = keys.filter((k) => k >= todayKey);
  const past = keys.filter((k) => k < todayKey).reverse();
  return (
    <div className="space-y-3">
      {upcoming.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center">
          <p className="text-sm font-medium text-zinc-800">Nothing coming up</p>
          <p className="mt-1 text-xs text-zinc-500">
            Plan the next video and it shows here, a day at a time.
          </p>
          <button
            type="button"
            onClick={props.onNew}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
          >
            <IconPlus size={14} /> New post
          </button>
        </div>
      )}
      {upcoming.map((k) => (
        <DayGroup
          key={k}
          day={fromDayKey(k)}
          posts={byDay.get(k)!}
          props={props}
        />
      ))}
      {past.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowPast(!showPast)}
            aria-expanded={showPast}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            {showPast
              ? "Hide earlier posts"
              : `Show earlier posts (${past.reduce((n, k) => n + byDay.get(k)!.length, 0)})`}
          </button>
        </div>
      )}
      {showPast &&
        past.map((k) => (
          <DayGroup
            key={k}
            day={fromDayKey(k)}
            posts={byDay.get(k)!}
            props={props}
          />
        ))}
    </div>
  );
}
