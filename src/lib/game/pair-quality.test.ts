import { describe, expect, it } from "vitest";
import { pairQuality, type PairObservation } from "./pair-quality";
import { CURATED_DAILY_FROM, CURATED_PAIRS } from "./curated-pairs";
import { dailyPairsForPuzzle } from "./daily-run";
import { pairForPuzzle } from "./daily";
import { STARTING_PAIRS } from "./pairs";
import { validateAnswer } from "./normalize";

const sample: PairObservation = {
  a: "dog", b: "bone", mode: "daily", status: "won", guesses: 1,
  firstGuessMatched: true, updatedAt: "2026-10-09T10:00:00Z",
};

describe("starter-pair quality", () => {
  it("does not label sparse data or count unsolved games in the solved-guess average", () => {
    expect(pairQuality([sample])[0]).toMatchObject({ sample: "insufficient", flags: [], averageSolvedGuesses: 1 });
    const observations = [...Array.from({ length: 20 }, () => ({ ...sample, status: "lost" as const, guesses: 5, firstGuessMatched: false })), sample];
    expect(pairQuality(observations)[0]).toMatchObject({ flags: ["often unsolved"], averageSolvedGuesses: 1 });
  });

  it("separates modes, combines reversed endpoints and ignores fresh unfinished games", () => {
    const rows = pairQuality([sample, { ...sample, a: "bone", b: "dog" }, { ...sample, mode: "archive" },
      { ...sample, status: "active", guesses: 0 }], new Date("2026-10-09T12:00:00Z"));
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.mode === "daily")).toMatchObject({ started: 3, completed: 2, staleUnfinished: 0 });
  });

  it("preserves every published five-round puzzle before the curation boundary", () => {
    for (let number = 1; number < CURATED_DAILY_FROM; number++) {
      expect(dailyPairsForPuzzle(number)).toEqual([
        pairForPuzzle(number),
        ...Array.from({ length: 4 }, (_, index) => STARTING_PAIRS[((number - 2 + (index + 1) * 997) % STARTING_PAIRS.length + STARTING_PAIRS.length) % STARTING_PAIRS.length]),
      ]);
    }
  });

  it("adds a deterministic mix of four curated challenges without changing the published first pair", () => {
    for (let number = CURATED_DAILY_FROM; number < CURATED_DAILY_FROM + 100; number++) {
      const pairs = dailyPairsForPuzzle(number);
      expect(pairs[0]).toEqual(pairForPuzzle(number));
      expect(pairs).toEqual(dailyPairsForPuzzle(number));
      expect(CURATED_PAIRS.gentle).toContainEqual(pairs[1]);
      expect(CURATED_PAIRS.medium).toContainEqual(pairs[2]);
      expect(CURATED_PAIRS.gentle).toContainEqual(pairs[3]);
      expect(CURATED_PAIRS.tricky).toContainEqual(pairs[4]);
      expect(new Set(pairs.map(({ a, b }) => [a, b].sort().join("|"))).size).toBe(5);
      expect(pairs.every(({ a, b }) => validateAnswer(a, [b, "placeholder"]).ok && validateAnswer(b, [a, "placeholder"]).ok)).toBe(true);
    }
  });
});
