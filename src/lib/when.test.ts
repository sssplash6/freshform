import { describe, expect, it } from "vitest";

import {
  BUCKET_LABEL,
  bucketOf,
  daysAway,
  formatDay,
  formatTimeOfDay,
  programWallClock,
} from "@/lib/when";

/**
 * The bug this file exists for, stated as a test.
 *
 * Meeting times are stored as the program's wall clock in a UTC field, and
 * `now` is a real instant. Comparing them directly puts them on different
 * calendar days for the five hours after midnight in Tashkent — the exact hours
 * when a mentor checks the day's schedule.
 */
describe("program-local day arithmetic", () => {
  it("calls a meeting later this morning today, at 02:00 Tashkent", () => {
    // 02:00 Tashkent on Sep 4 is 21:00 UTC on Sep 3 — a different UTC date.
    const now = new Date("2026-09-03T21:00:00Z");
    const meeting = new Date("2026-09-04T10:00:00Z"); // 10:00 Tashkent, Sep 4
    expect(bucketOf(meeting, now)).toBe("today");
    expect(daysAway(meeting, now)).toBe(0);
  });

  it("does not call this morning's meeting overdue, at 01:30 Tashkent", () => {
    const now = new Date("2026-09-03T20:30:00Z"); // 01:30 Tashkent, Sep 4
    const meeting = new Date("2026-09-04T09:00:00Z");
    expect(bucketOf(meeting, now)).not.toBe("overdue");
  });

  it("still calls yesterday's meeting overdue in those same hours", () => {
    const now = new Date("2026-09-03T21:00:00Z"); // 02:00 Tashkent, Sep 4
    const meeting = new Date("2026-09-03T15:00:00Z"); // Sep 3, 15:00 Tashkent
    expect(bucketOf(meeting, now)).toBe("overdue");
    expect(daysAway(meeting, now)).toBe(-1);
  });

  it("rolls the day over at midnight Tashkent, not midnight UTC", () => {
    // 23:30 Tashkent Sep 3 = 18:30 UTC Sep 3. Still Sep 3 locally.
    const beforeMidnight = new Date("2026-09-03T18:30:00Z");
    expect(programWallClock(beforeMidnight).toISOString().slice(0, 10)).toBe("2026-09-03");
    // 00:30 Tashkent Sep 4 = 19:30 UTC Sep 3. Now Sep 4 locally.
    const afterMidnight = new Date("2026-09-03T19:30:00Z");
    expect(programWallClock(afterMidnight).toISOString().slice(0, 10)).toBe("2026-09-04");
  });
});

describe("bucketOf", () => {
  const now = new Date("2026-09-04T09:00:00Z"); // 14:00 Tashkent

  it("keeps a meeting from earlier today under Today, not Overdue", () => {
    // The row a mentor looks for after a missed morning call must be where they
    // left it. Whether it needs logging is the attention list's job.
    expect(bucketOf(new Date("2026-09-04T08:00:00Z"), now)).toBe("today");
  });

  it("groups the coming week apart from later", () => {
    expect(bucketOf(new Date("2026-09-05T10:00:00Z"), now)).toBe("week");
    expect(bucketOf(new Date("2026-09-11T10:00:00Z"), now)).toBe("week");
    expect(bucketOf(new Date("2026-09-12T10:00:00Z"), now)).toBe("later");
  });

  it("names every bucket", () => {
    expect(Object.values(BUCKET_LABEL).every((l) => l.length > 0)).toBe(true);
    expect(BUCKET_LABEL.week).toBe("Next 7 days");
  });
});

describe("formatDay", () => {
  const now = new Date("2026-09-04T09:00:00Z"); // Friday, 14:00 Tashkent

  it("uses the words a person scanning a list would use", () => {
    expect(formatDay(new Date("2026-09-04T18:00:00Z"), now)).toBe("Today");
    expect(formatDay(new Date("2026-09-05T10:00:00Z"), now)).toBe("Tomorrow");
    expect(formatDay(new Date("2026-09-03T10:00:00Z"), now)).toBe("Yesterday");
  });

  it("names the weekday inside the week and the date beyond it", () => {
    expect(formatDay(new Date("2026-09-08T10:00:00Z"), now)).toBe("Tue");
    expect(formatDay(new Date("2026-09-30T10:00:00Z"), now)).toBe("Sep 30");
  });

  it("says Today at 02:00 Tashkent for a meeting later that morning", () => {
    const earlyHours = new Date("2026-09-03T21:00:00Z");
    expect(formatDay(new Date("2026-09-04T10:00:00Z"), earlyHours)).toBe("Today");
  });
});

describe("formatTimeOfDay", () => {
  it("names the zone the time means", () => {
    expect(formatTimeOfDay(new Date("2026-09-04T15:00:00Z"), true)).toBe("15:00 Tashkent");
  });

  it("pads to a stable width so a column of times lines up", () => {
    expect(formatTimeOfDay(new Date("2026-09-04T09:05:00Z"), true)).toBe("09:05 Tashkent");
  });

  it("says nothing when only a date was given", () => {
    expect(formatTimeOfDay(new Date("2026-09-04T00:00:00Z"), false)).toBeNull();
  });
});
