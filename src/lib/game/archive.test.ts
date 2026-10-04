import { describe, expect, it } from "vitest";
import {
  dailyArchiveDates,
  dailyArchiveEntry,
  formatArchiveDate,
} from "./archive";
import { LEGACY_STARTING_PAIRS } from "./pairs";

describe("Daily archive", () => {
  const now = new Date("2026-10-04T23:59:59Z");

  it("lists each puzzle date from launch through today", () => {
    expect(dailyArchiveDates(now)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("returns the same numbered pair as the live Daily schedule", () => {
    expect(dailyArchiveEntry("2026-09-30", now)).toEqual({
      date: "2026-09-30",
      number: 1,
      pair: LEGACY_STARTING_PAIRS.at(-1),
    });
    expect(dailyArchiveEntry("2026-10-01", now)).toEqual({
      date: "2026-10-01",
      number: 2,
      pair: LEGACY_STARTING_PAIRS[0],
    });
  });

  it("rejects invalid, pre-launch, and future dates", () => {
    expect(dailyArchiveEntry("nope", now)).toBeNull();
    expect(dailyArchiveEntry("2026-02-30", now)).toBeNull();
    expect(dailyArchiveEntry("2026-09-29", now)).toBeNull();
    expect(dailyArchiveEntry("2026-10-05", now)).toBeNull();
  });

  it("formats dates in UTC", () => {
    expect(formatArchiveDate("2026-10-04")).toBe("October 4, 2026");
  });
});
