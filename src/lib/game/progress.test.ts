import { describe, expect, it } from "vitest";
import { scoreProgress } from "./progress";
import type { DailyRunEntry } from "./daily-run";

const entry: DailyRunEntry = {
  id: "one", date: "2026-10-09", puzzleNumber: 10, mode: "daily", status: "completed",
  score: 3000, completedAt: "2026-10-09T10:00:00Z", solvedRounds: 3, solvedGuesses: 3,
};

describe("personal progress", () => {
  it("uses completed puzzles in the last seven UTC days without inventing zeros for missed days", () => {
    const progress = scoreProgress([entry,
      { ...entry, id: "old", date: "2026-10-02", score: 5000 },
      { ...entry, id: "active", status: "active", score: 0, completedAt: null },
      { ...entry, id: "archive", mode: "archive", score: 0 },
    ], "daily", "2026-10-09");
    expect(progress).toMatchObject({ weekAverage: 3000, weekPlayed: 1, averageSolvedGuesses: 1 });
    expect(progress.points).toHaveLength(2);
  });

  it("weights guess averages by solved rounds and handles old summaries without guess counts", () => {
    expect(scoreProgress([entry, { ...entry, solvedRounds: 1, solvedGuesses: 5 },
      { ...entry, solvedRounds: undefined, solvedGuesses: undefined },
      { ...entry, solvedRounds: 0, solvedGuesses: 0, score: 0 },
    ], "daily", "2026-10-09").averageSolvedGuesses).toBe(2);
    expect(scoreProgress([{ ...entry, solvedRounds: 0, solvedGuesses: 0 }], "daily", "2026-10-09").averageSolvedGuesses).toBeNull();
  });

  it("groups Archive scores by actual play date instead of historical puzzle date", () => {
    expect(scoreProgress([
      { ...entry, mode: "archive", date: "2026-09-30", score: 5000 },
      { ...entry, mode: "archive", date: "2026-10-01", score: 1000 },
    ], "archive", "2026-10-09")).toMatchObject({
      weekAverage: 3000, weekPlayed: 2, points: [{ date: "2026-10-09", score: 3000 }],
    });
  });

  it("renders no pretend trend or average when there are no completed puzzles", () => {
    expect(scoreProgress([], "daily", "2026-10-09")).toEqual({
      weekAverage: null, weekPlayed: 0, averageSolvedGuesses: null, points: [],
    });
  });
});
