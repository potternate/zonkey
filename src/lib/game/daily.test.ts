import { describe, expect, it } from "vitest";
import { DAILY_EPOCH } from "./config";
import { dailyPuzzle, isAcceptablePuzzleDate, pairForPuzzle, puzzleNumberForDate } from "./daily";
import { LEGACY_STARTING_PAIRS, STARTING_PAIRS } from "./pairs";

describe("daily puzzle", () => {
  it("numbers puzzles from the epoch", () => {
    expect(puzzleNumberForDate(DAILY_EPOCH)).toBe(1);
    expect(puzzleNumberForDate("2026-10-01")).toBe(2);
    expect(puzzleNumberForDate("2026-10-02")).toBe(3);
    expect(puzzleNumberForDate("2027-10-01")).toBe(367);
  });

  it("gives every player the same pair for a date and cycles the pool", () => {
    expect(pairForPuzzle(2)).toBe(STARTING_PAIRS[0]);
    expect(pairForPuzzle(2 + STARTING_PAIRS.length)).toBe(STARTING_PAIRS[0]);
  });

  it("rolls from #2 to #3 at midnight UTC without changing the pair schedule", () => {
    expect(dailyPuzzle(new Date("2026-10-01T23:59:59.999Z"))).toEqual({
      date: "2026-10-01", number: 2, pair: STARTING_PAIRS[0],
    });
    expect(dailyPuzzle(new Date("2026-10-02T00:00:00Z"))).toEqual({
      date: "2026-10-02", number: 3, pair: STARTING_PAIRS[1],
    });
  });

  it("preserves the pre-rotation Daily and then reaches the expanded pool", () => {
    expect(pairForPuzzle(1)).toBe(LEGACY_STARTING_PAIRS.at(-1));
    expect(pairForPuzzle(2 + LEGACY_STARTING_PAIRS.length)).toBe(
      STARTING_PAIRS[LEGACY_STARTING_PAIRS.length],
    );
  });

  it("accepts local dates within a day of server time", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(isAcceptablePuzzleDate("2026-10-05", now)).toBe(true);
    expect(isAcceptablePuzzleDate("2026-10-04", now)).toBe(true);
    expect(isAcceptablePuzzleDate("2026-10-06", now)).toBe(true);
    expect(isAcceptablePuzzleDate("2026-10-07", now)).toBe(false);
    expect(isAcceptablePuzzleDate("2026-02-30", now)).toBe(false);
    expect(isAcceptablePuzzleDate("nope", now)).toBe(false);
  });

  it("rejects dates before the first puzzle", () => {
    expect(isAcceptablePuzzleDate("2026-09-29", new Date("2026-09-30T00:30:00Z"))).toBe(false);
  });

  it("has unique starting pairs", () => {
    const keys = STARTING_PAIRS.map((p) => `${p.a}|${p.b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
