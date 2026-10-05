import { describe, expect, it } from "vitest";
import { dailyStreak } from "./scores";
import type { GameRecord } from "./view";

function finished(date: string, overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: crypto.randomUUID(), playerId: "player", mode: "daily", puzzleDate: date,
    puzzleNumber: 1, startWordA: "donkey", startWordB: "zebra", status: "won",
    roundNumber: 1, startedAt: `${date}T10:00:00Z`, completedAt: `${date}T10:01:00Z`,
    finalRounds: 1, ...overrides,
  };
}

describe("Daily completion streaks", () => {
  it("counts consecutive completed UTC days, including losses, once per date", () => {
    const games = [
      finished("2026-10-02", { status: "lost" }),
      finished("2026-09-30"), finished("2026-10-01"), finished("2026-10-01"),
    ];
    expect(dailyStreak(games, "2026-10-02")).toEqual({ current: 3, best: 3 });
    expect(dailyStreak(games, "2026-10-03")).toEqual({ current: 3, best: 3 });
    expect(dailyStreak(games, "2026-10-04")).toEqual({ current: 0, best: 3 });
  });

  it("starts a new run after a missed day while preserving the best", () => {
    const games = ["2026-09-30", "2026-10-01", "2026-10-03"].map((date) => finished(date));
    expect(dailyStreak(games, "2026-10-03")).toEqual({ current: 1, best: 2 });
  });

  it("ignores unfinished games, late completions, future dates and other modes", () => {
    expect(dailyStreak([
      finished("2026-10-01", { status: "active", completedAt: null }),
      finished("2026-10-01", { completedAt: "2026-10-02T00:00:00Z" }),
      finished("2026-10-02", { mode: "practice" }),
      finished("2026-10-02", { mode: "unlimited" }),
      finished("2026-10-03"),
    ], "2026-10-02")).toEqual({ current: 0, best: 0 });
  });

  it("uses UTC completion dates across month and year boundaries", () => {
    expect(dailyStreak([
      finished("2026-12-31", { completedAt: "2027-01-01T01:00:00+02:00" }),
      finished("2027-01-01"),
    ], "2027-01-01")).toEqual({ current: 2, best: 2 });
  });
});
