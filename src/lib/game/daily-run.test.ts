import { describe, expect, it } from "vitest";
import { dateForPuzzleNumber, pairForPuzzle } from "./daily";
import { buildDailyShareText, dailyPairsForPuzzle, dailyRoundScore, dailyScoreResults } from "./daily-run";
import type { DailyRunView } from "./daily-run";
import { toDailyView, type DailyRunRecord } from "@/server/store/daily-types";

describe("five-round Daily rules", () => {
  it("backfills the schedule while preserving the original first pair", () => {
    for (let number = 1; number <= 10_000; number++) {
      const pairs = dailyPairsForPuzzle(number);
      expect(pairs).toHaveLength(5);
      expect(pairs[0]).toEqual(pairForPuzzle(number));
      expect(new Set(pairs.map((pair) => [pair.a, pair.b].sort().join("|"))).size).toBe(5);
    }
    expect(dateForPuzzleNumber(1)).toBe("2026-09-30");
  });

  it("scores all five allowed guesses and failed rounds", () => {
    expect([1, 2, 3, 4, 5].map((guess) => dailyRoundScore(guess, true))).toEqual([1000, 800, 600, 400, 200]);
    expect(dailyRoundScore(5, false)).toBe(0);
    expect(dailyRoundScore(6, true)).toBe(0);
  });

  it("uses actual score counts, excludes self from percentiles, and never beats ties", () => {
    const yours = { id: "you", score: 3000 };
    const results = dailyScoreResults([yours, { id: "a", score: 3000 }, { id: "b", score: 2000 }, { id: "c", score: 4000 }], yours);
    expect(results.betterThanPercent).toBe(33);
    expect(results.distribution.find((row) => row.score === 3000)?.count).toBe(2);
    expect(results.totalPlayers).toBe(4);
    expect(dailyScoreResults([yours], yours).betterThanPercent).toBeNull();
    expect(dailyScoreResults([{ id: "zero", score: 0 }], { id: "zero", score: 0 }).distribution[0].count).toBe(1);
  });

  it("excludes all unsubmitted AI answers from the client view", () => {
    const pairs = dailyPairsForPuzzle(1);
    const run: DailyRunRecord = {
      id: "run", playerId: "you", date: "2026-09-30", puzzleNumber: 1, mode: "archive",
      status: "active", currentRound: 1, score: 0, completedAt: null, pairs,
      rounds: pairs.map((pair, index) => ({
        number: index + 1, wordA: pair.a, wordB: pair.b, aiAnswer: "hiddenword", status: "active", score: 0, guesses: [],
      })),
    };
    expect(JSON.stringify(toDailyView(run))).not.toContain("hiddenword");
    expect(toDailyView(run).current?.ready).toBe(true);
  });

  it("shares five spoiler-free rows and the total score", () => {
    const run: DailyRunView = {
      id: "run", date: "2026-09-30", puzzleNumber: 1, mode: "daily", status: "completed", score: 1000, current: null,
      rounds: dailyPairsForPuzzle(1).map((startPair, index) => ({
        number: index + 1, startPair, status: index === 0 ? "won" : "lost", score: index === 0 ? 1000 : 0,
        guesses: Array.from({ length: index === 0 ? 1 : 5 }, (_, guess) => ({
          number: guess + 1, wordA: "donkey", wordB: "zebra", playerAnswer: "hybrid", aiAnswer: "secret", matched: index === 0,
        })),
      })),
    };
    const text = buildDailyShareText(run, "https://zonkey.io/?daily=2026-09-30");
    expect(text).toContain("1,000 / 5,000");
    expect(text).toContain("🟩➖➖➖➖");
    expect(text).not.toMatch(/donkey|zebra|hybrid|secret/);
    expect(text.split("\n").filter((row) => /[⬜🟩]/u.test(row))).toHaveLength(5);
  });
});
