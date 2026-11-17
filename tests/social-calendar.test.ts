import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKey,
  dayName,
  duration,
  isEditable,
  monthGrid,
  nextFreeSlot,
  onDay,
  planState,
  postsByDay,
  rangeLabel,
  shiftAnchor,
  slotOnDay,
  slotTaken,
  startOfWeek,
  usualTimes,
  weekDays,
} from "../lib/social/calendar";
import type {
  SocialPost,
  SocialTargetRow,
  TargetStatus,
} from "../lib/social/types";

// Every date is built from local parts, so these pass in any time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);

const target = (status: TargetStatus): SocialTargetRow =>
  ({
    platform: "youtube",
    status,
    options: {},
    job: {},
  }) as unknown as SocialTargetRow;

const post = (
  id: string,
  when: Date | null,
  status: SocialPost["status"] = "scheduled",
  targets: TargetStatus[] = ["pending"],
) =>
  ({
    id,
    status,
    scheduled_at: when ? when.toISOString() : null,
    targets: targets.map(target),
  }) as unknown as SocialPost;

describe("planState", () => {
  it("reads drafts, waiting, in progress, attention and done", () => {
    expect(planState(post("a", null, "draft"))).toBe("draft");
    expect(
      planState(
        post("a", at(2026, 11, 20), "scheduled", ["pending", "pending"]),
      ),
    ).toBe("scheduled");
    expect(
      planState(
        post("a", at(2026, 11, 20), "scheduled", ["published", "pending"]),
      ),
    ).toBe("posting");
    expect(
      planState(
        post("a", at(2026, 11, 20), "scheduled", ["processing", "pending"]),
      ),
    ).toBe("posting");
    expect(
      planState(
        post("a", at(2026, 11, 20), "scheduled", ["published", "inbox"]),
      ),
    ).toBe("attention");
    expect(
      planState(
        post("a", at(2026, 11, 20), "scheduled", ["failed", "published"]),
      ),
    ).toBe("attention");
    expect(
      planState(
        post("a", at(2026, 11, 20), "scheduled", ["published", "published"]),
      ),
    ).toBe("posted");
  });

  it("only lets a post change while every platform is still waiting", () => {
    expect(isEditable(post("a", null, "draft", ["pending", "pending"]))).toBe(
      true,
    );
    expect(
      isEditable(post("a", null, "scheduled", ["pending", "processing"])),
    ).toBe(false);
  });
});

describe("weeks and months", () => {
  it("starts weeks on Monday", () => {
    expect(dayKey(startOfWeek(at(2026, 11, 17)))).toBe("2026-11-16");
    expect(dayKey(startOfWeek(at(2026, 11, 22)))).toBe("2026-11-16");
    expect(dayKey(startOfWeek(at(2026, 11, 16)))).toBe("2026-11-16");
    expect(weekDays(at(2026, 11, 19)).map(dayKey)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("keeps whole days across a clock change", () => {
    // UK clocks go back on 25 Oct 2026; a day is still one calendar day.
    expect(dayKey(addDays(at(2026, 10, 24), 1))).toBe("2026-10-25");
    expect(dayKey(addDays(at(2026, 10, 25), 1))).toBe("2026-10-26");
    expect(dayKey(addDays(at(2026, 3, 28), 2))).toBe("2026-03-30");
  });

  it("covers a month in whole weeks", () => {
    const nov = monthGrid(at(2026, 11, 17));
    expect(nov.length % 7).toBe(0);
    expect(dayKey(nov[0])).toBe("2026-10-26");
    expect(dayKey(nov[nov.length - 1])).toBe("2026-12-06");
    // February 2027 starts on a Monday and fits four rows.
    expect(monthGrid(at(2027, 2, 10)).length).toBe(28);
  });

  it("steps by a week or a month", () => {
    expect(dayKey(shiftAnchor(at(2026, 11, 17), "week", 1))).toBe("2026-11-24");
    expect(dayKey(shiftAnchor(at(2026, 11, 30), "month", 1))).toBe(
      "2026-12-01",
    );
    expect(dayKey(shiftAnchor(at(2026, 1, 31), "month", -1))).toBe(
      "2025-12-01",
    );
  });

  it("labels the range without a dash", () => {
    expect(rangeLabel("week", at(2026, 11, 17))).toBe("16 to 22 Nov 2026");
    expect(rangeLabel("week", at(2026, 12, 1))).toBe("30 Nov to 6 Dec 2026");
    expect(rangeLabel("week", at(2026, 12, 30))).toBe(
      "28 Dec 2026 to 3 Jan 2027",
    );
    expect(rangeLabel("month", at(2026, 11, 17))).toBe("November 2026");
  });

  it("names nearby days", () => {
    const today = at(2026, 11, 17, 10);
    expect(dayName(at(2026, 11, 17, 23), today)).toBe("Today");
    expect(dayName(at(2026, 11, 18, 1), today)).toBe("Tomorrow");
    expect(dayName(at(2026, 11, 16), today)).toBe("Yesterday");
    expect(dayName(at(2026, 11, 19), today)).toBe("Thu 19 Nov");
  });
});

describe("posts on the calendar", () => {
  it("groups by local day, earliest first, and leaves untimed drafts out", () => {
    const days = postsByDay([
      post("late", at(2026, 11, 17, 18)),
      post("early", at(2026, 11, 17, 9)),
      post("next", at(2026, 11, 18, 13)),
      post("untimed", null, "draft"),
    ]);
    expect([...days.keys()]).toEqual(["2026-11-17", "2026-11-18"]);
    expect(days.get("2026-11-17")!.map((p) => p.id)).toEqual(["early", "late"]);
  });

  it("moves a post to another day at the same clock time", () => {
    const moved = onDay(
      at(2026, 11, 17, 18, 30).toISOString(),
      at(2026, 11, 20),
    );
    expect(dayKey(moved)).toBe("2026-11-20");
    expect([moved.getHours(), moved.getMinutes()]).toEqual([18, 30]);
  });

  it("formats lengths", () => {
    expect(duration(42.4)).toBe("0:42");
    expect(duration(65)).toBe("1:05");
    expect(duration(null)).toBe("");
  });
});

describe("slots", () => {
  const posts = [
    post("a", at(2026, 11, 17, 9)),
    post("b", at(2026, 11, 17, 13)),
    post("c", at(2026, 11, 18, 9)),
    post("d", at(2026, 11, 18, 13)),
    post("e", at(2026, 11, 18, 18)),
    post("f", at(2026, 11, 19, 21)),
    post("g", at(2026, 11, 20, 7, 15), "draft"),
  ];

  it("learns the times we use twice or more, and falls back to defaults", () => {
    expect(usualTimes(posts)).toEqual(["09:00", "13:00"]);
    expect(usualTimes([post("a", at(2026, 11, 17, 9))])).toEqual([
      "09:00",
      "13:00",
      "18:00",
    ]);
  });

  it("finds a taken slot, ignoring drafts and the post being edited", () => {
    expect(slotTaken(posts, at(2026, 11, 18, 18))?.id).toBe("e");
    expect(slotTaken(posts, at(2026, 11, 18, 18), "e")).toBeNull();
    expect(slotTaken(posts, at(2026, 11, 20, 7, 15))).toBeNull();
  });

  it("picks the first free usual time at least 15 minutes ahead", () => {
    const times = ["09:00", "13:00", "18:00"];
    // 17 Nov, 12:50: 13:00 is under 15 minutes away and taken anyway, 18:00 is free.
    expect(
      dayKey(nextFreeSlot(posts, times, at(2026, 11, 17, 12, 50).getTime())),
    ).toBe("2026-11-17");
    expect(
      nextFreeSlot(posts, times, at(2026, 11, 17, 12, 50).getTime()).getHours(),
    ).toBe(18);
    // 17 Nov, 19:00: the 18th is full, so the 19th at 09:00.
    const next = nextFreeSlot(posts, times, at(2026, 11, 17, 19).getTime());
    expect([dayKey(next), next.getHours()]).toEqual(["2026-11-19", 9]);
  });

  it("picks a time for a post started from a day", () => {
    const times = ["09:00", "13:00", "18:00"];
    const morning = at(2026, 11, 17, 8).getTime();
    // The 17th has 09:00 and 13:00 taken, so 18:00.
    expect(slotOnDay(posts, times, at(2026, 11, 17), morning).getHours()).toBe(
      18,
    );
    // A free future day starts at its first usual time.
    expect(slotOnDay(posts, times, at(2026, 11, 21), morning).getHours()).toBe(
      9,
    );
    // Late on a day whose usual times have gone: the next quarter hour an hour out.
    const late = slotOnDay(
      posts,
      times,
      at(2026, 11, 19),
      at(2026, 11, 19, 20, 5).getTime(),
    );
    expect([dayKey(late), late.getHours(), late.getMinutes()]).toEqual([
      "2026-11-19",
      21,
      15,
    ]);
  });
});
