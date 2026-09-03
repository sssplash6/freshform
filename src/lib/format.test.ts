import { describe, expect, it } from "vitest";

import { formatDuration, formatRough } from "@/lib/format";

/**
 * The owner asked for rounding because the exact figures had become
 * unreadable: "very many digits and I got a bit lost in them". These pin the
 * two halves of the answer — what rounds, and what the "+" is allowed to mean.
 */
describe("formatRough", () => {
  it("rounds a big total down to a five-hour step and says so", () => {
    // 7,807 minutes is 130h 07m. The program has at least 130 hours.
    expect(formatRough(7807)).toBe("130+ hours");
    expect(formatRough(74_400)).toBe("1,240 hours");
    expect(formatRough(74_460)).toBe("1,240+ hours");
  });

  it("never rounds up, because the plus would then be a lie", () => {
    // The transcription of the owner's note read "135+" for 130h 07m. Saying a
    // program has time it does not have is the one thing this must not do.
    expect(formatRough(7807)).not.toContain("135");
    for (const minutes of [601, 900, 7807, 12_345, 99_999]) {
      const claimed = Number(formatRough(minutes).replace(/[^\d]/g, ""));
      expect(claimed * 60).toBeLessThanOrEqual(minutes);
    }
  });

  it("drops the plus when the figure is exact", () => {
    expect(formatRough(600)).toBe("10 hours");
    expect(formatRough(120)).toBe("2 hours");
    expect(formatRough(60)).toBe("1 hour");
  });

  it("leaves anything under an hour alone", () => {
    // "45 min" is already the shortest true thing; "0+ hours" is not an answer.
    expect(formatRough(45)).toBe("45 min");
    expect(formatRough(0)).toBe("0 min");
  });

  it("keeps the hour precise below ten, where a five-hour step would erase it", () => {
    expect(formatRough(190)).toBe("3+ hours");
    expect(formatRough(599)).toBe("9+ hours");
  });

  it("rounds the size of an overdraw, not its sign", () => {
    expect(formatRough(-1202)).toBe("-20+ hours");
  });

    it("costs the reader fewer digits than the figure it replaces", () => {
    // Not fewer characters — "1,240+ hours" is longer than "1241h". What was
    // asked for was fewer digits to hold in your head, and a word instead of a
    // second unit to parse. That is the thing to hold it to.
    for (const minutes of [7807, 74_460, 1202, 190]) {
      const digits = (s: string) => s.replace(/[^\d]/g, "").length;
      expect(digits(formatRough(minutes))).toBeLessThanOrEqual(
        digits(formatDuration(minutes))
      );
    }
  });
});
