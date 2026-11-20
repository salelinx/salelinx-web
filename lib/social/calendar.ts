// Dates and slots for the planner's calendar. Everything is in the viewer's
// own time zone (the browser's), since that is how the planner shows every
// time, and dates are built from local parts so a clock change never shifts a
// day. Pure, so tests/social-calendar.test.ts can run it.

import type { SocialPost } from "./types";

export type PlannerView = "week" | "month" | "list";
export const PLANNER_VIEWS: PlannerView[] = ["week", "month", "list"];

/** Where a post is, from what each of its platforms has done. */
export type PlanState =
  "draft" | "scheduled" | "posting" | "attention" | "posted";

export function planState(
  p: Pick<SocialPost, "status" | "targets">,
): PlanState {
  if (p.status === "draft") return "draft";
  if (p.targets.some((t) => t.status === "failed" || t.status === "inbox"))
    return "attention";
  if (p.targets.length > 0 && p.targets.every((t) => t.status === "published"))
    return "posted";
  if (p.targets.some((t) => t.status !== "pending")) return "posting";
  return "scheduled";
}

/** A post can change until a platform starts on it; after that it is history (052's save refuses it). */
export const isEditable = (p: Pick<SocialPost, "targets">) =>
  p.targets.every((t) => t.status === "pending");

const pad = (n: number) => String(n).padStart(2, "0");

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 0 for Monday to 6 for Sunday. */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** "2026-11-17", the local date. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d: Date) => addDays(d, -weekdayIndex(d));

export const weekDays = (anchor: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));

/** Whole weeks covering the anchor's month, Monday first: 4 to 6 rows of 7. */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = dayKey(addDays(startOfWeek(last), 6));
  const out: Date[] = [];
  for (let d = startOfWeek(first); ; d = addDays(d, 1)) {
    out.push(d);
    if (dayKey(d) === end) return out;
  }
}

/** The anchor a step back or forward: a week, or a month (landing on its 1st). */
export function shiftAnchor(
  anchor: Date,
  view: PlannerView,
  steps: number,
): Date {
  if (view === "month")
    return new Date(anchor.getFullYear(), anchor.getMonth() + steps, 1);
  return addDays(anchor, 7 * steps);
}

/** "17 to 23 Nov 2026", or "November 2026" for a month. */
export function rangeLabel(view: PlannerView, anchor: Date): string {
  if (view === "month")
    return `${MONTHS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const days = weekDays(anchor);
  const a = days[0];
  const b = days[6];
  if (a.getFullYear() !== b.getFullYear())
    return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} to ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth())
    return `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  return `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** "Wed 19 Nov" */
export const shortDate = (d: Date) =>
  `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** "Today", "Tomorrow", "Yesterday", or "Wed 19 Nov". */
export function dayName(d: Date, today: Date): string {
  const diff = Math.round(
    (startOfDay(d).getTime() - startOfDay(today).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return shortDate(d);
}

/** "18:00", the local clock time. */
export const clockTime = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "Today, 18:00" or "Wed 19 Nov, 18:00". */
export const whenLabel = (d: Date, today: Date) =>
  `${dayName(d, today)}, ${clockTime(d)}`;

/** A video's length: "0:42", "12:05". */
export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

type Timed = Pick<SocialPost, "id" | "status" | "scheduled_at">;

/** Posts with a time, by local day, earliest first within a day. */
export function postsByDay<T extends Timed>(posts: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const p of [...posts]
    .filter((p) => p.scheduled_at)
    .sort(
      (a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!),
    )) {
    const key = dayKey(new Date(p.scheduled_at!));
    out.set(key, [...(out.get(key) ?? []), p]);
  }
  return out;
}

/** The same local clock time on another day. */
export function onDay(iso: string, day: Date): Date {
  const t = new Date(iso);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    t.getHours(),
    t.getMinutes(),
  );
}

/** A day at "HH:MM". */
export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export const DEFAULT_TIMES = ["09:00", "13:00", "18:00"];

/** The moment a day's date reads `hour`:00 in London, which is how the brief's best hours are kept. */
export function ukHourOn(day: Date, hour: number): Date {
  const guess = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour);
  const london = Number(
    new Date(guess).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }),
  );
  return new Date(guess - (((london - hour + 24) % 24) * 3_600_000));
}

/**
 * The clock times we post at, earliest first: any time used by two or more
 * scheduled posts, up to four of the most used. Until there are two, the
 * defaults, so the shortcuts are there from the first post.
 */
export function usualTimes(posts: Timed[], max = 4): string[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    if (p.status !== "scheduled" || !p.scheduled_at) continue;
    const t = clockTime(new Date(p.scheduled_at));
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const used = [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([t]) => t);
  return (used.length >= 2 ? used : DEFAULT_TIMES).sort();
}

/** Whether a scheduled post (other than `ignore`) already sits at that exact local minute. */
export function slotTaken<T extends Timed>(
  posts: T[],
  at: Date,
  ignore: string | null = null,
): T | null {
  const key = dayKey(at);
  const time = clockTime(at);
  return (
    posts.find((p) => {
      if (p.id === ignore || p.status !== "scheduled" || !p.scheduled_at)
        return false;
      const d = new Date(p.scheduled_at);
      return dayKey(d) === key && clockTime(d) === time;
    }) ?? null
  );
}

/**
 * The first usual time with nothing scheduled, at least 15 minutes from now
 * (so YouTube, which uploads an hour early, is the only one ever squeezed).
 */
export function nextFreeSlot(
  posts: Timed[],
  times: string[],
  nowMs: number,
  ignore: string | null = null,
): Date {
  const today = startOfDay(new Date(nowMs));
  for (let i = 0; i < 120; i++) {
    const day = addDays(today, i);
    for (const t of times) {
      const at = atTime(day, t);
      if (at.getTime() >= nowMs + 15 * 60_000 && !slotTaken(posts, at, ignore))
        return at;
    }
  }
  return atTime(addDays(today, 1), times[0] ?? DEFAULT_TIMES[0]);
}

/**
 * A time for a post started from a day on the calendar: that day's first free
 * usual time still ahead; on a day whose usual times have all gone, the next
 * quarter hour at least an hour out, if it is still that day; else the day's
 * last usual time (the editor then says it has passed).
 */
export function slotOnDay(
  posts: Timed[],
  times: string[],
  day: Date,
  nowMs: number,
): Date {
  const usual = times.length ? times : DEFAULT_TIMES;
  for (const t of usual) {
    const at = atTime(day, t);
    if (at.getTime() >= nowMs + 15 * 60_000 && !slotTaken(posts, at)) return at;
  }
  const quarter = 15 * 60_000;
  const soon = new Date(Math.ceil((nowMs + 60 * 60_000) / quarter) * quarter);
  if (dayKey(soon) === dayKey(day)) return soon;
  return atTime(day, usual[usual.length - 1]);
}

/** A datetime-local value ("2026-11-19T18:00") for a date. */
export const toLocalInput = (d: Date) => `${dayKey(d)}T${clockTime(d)}`;
