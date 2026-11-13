import { describe, expect, it } from "vitest";
import type { DailyRunView } from "./daily-run";
import { decodeShareCard, encodeShareCard } from "./share-card";

function run(mode: DailyRunView["mode"], outcomes: boolean[][]): DailyRunView {
  return {
    mode, puzzleNumber: 45, score: 1800,
    rounds: outcomes.map((guesses, i) => ({ number: i + 1, guesses: guesses.map((matched, g) => ({ number: g + 1, matched })) })),
  } as unknown as DailyRunView;
}

describe("share card", () => {
  it("round-trips a daily run", () => {
    const slug = encodeShareCard(run("daily", [[true], [false, false, true], [false, false, false, false, false]]));
    expect(slug).toBe("45-1800-gooooxxgooxxxxx");
    expect(decodeShareCard(slug)).toEqual({
      puzzleNumber: 45,
      score: 1800,
      grid: [
        ["hit", "none", "none", "none", "none"],
        ["miss", "miss", "hit", "none", "none"],
        ["miss", "miss", "miss", "miss", "miss"],
      ],
    });
  });

  it("marks Unlimited runs without a puzzle number", () => {
    const slug = encodeShareCard(run("unlimited", [[true], [true], [true]]));
    expect(slug.startsWith("u-")).toBe(true);
    expect(decodeShareCard(slug)?.puzzleNumber).toBeNull();
  });

  it("rejects malformed slugs", () => {
    for (const slug of ["", "45-1800-ggg", "0-10-ooooooooooooooo", "45-9999-ooooooooooooooo", "45-10-oooooooooooooo!", "../x"]) {
      expect(decodeShareCard(slug)).toBeNull();
    }
  });
});
