import { describe, expect, it } from "vitest";
import type { DailyRunView } from "./daily-run";
import { addTally, EMPTY_TALLY, hearts, livesLeft, tallyRun } from "./survival";

const run = (score: number, statuses: ("active" | "won" | "lost")[]) =>
  ({ score, rounds: statuses.map((status, i) => ({ number: i + 1, status })) }) as unknown as DailyRunView;

describe("survival tally", () => {
  it("counts finished and lost rounds across runs", () => {
    const first = tallyRun(run(1800, ["won", "lost", "won"]));
    expect(first).toEqual({ total: 1800, rounds: 3, lost: 1 });
    const both = addTally(first, tallyRun(run(600, ["lost", "won", "active"])));
    expect(both).toEqual({ total: 2400, rounds: 5, lost: 2 });
    expect(livesLeft(both)).toBe(1);
  });

  it("never goes below zero lives", () => {
    expect(livesLeft({ ...EMPTY_TALLY, lost: 5 })).toBe(0);
    expect(hearts(1)).toBe("♥♡♡");
  });
});
