import { describe, expect, it } from "vitest";
import { archiveCalendarMonth } from "./archive";

describe("archive calendar months", () => {
  it("aligns days to Sunday and pads complete weeks", () => {
    const calendar = archiveCalendarMonth("2026-10");
    expect(calendar?.days.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(calendar?.days).toHaveLength(35);
    expect(calendar?.days.filter((date) => date !== null)).toHaveLength(31);
    expect(calendar?.days.slice(-2)).toEqual(["2026-10-30", "2026-10-31"]);
  });

  it("handles leap days and month navigation across years in UTC", () => {
    expect(archiveCalendarMonth("2028-02")?.days).toContain("2028-02-29");
    expect(archiveCalendarMonth("2027-02")?.days).not.toContain("2027-02-29");
    expect(archiveCalendarMonth("2026-12")).toMatchObject({ label: "December 2026", next: "2027-01" });
    expect(archiveCalendarMonth("2027-01")?.previous).toBe("2026-12");
  });

  it.each(["", "2026-13", "2026-00", "2026-1", "not-a-month"])("rejects invalid month %s", (month) => {
    expect(archiveCalendarMonth(month)).toBeNull();
  });
});
