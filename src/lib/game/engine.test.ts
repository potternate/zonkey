import { describe, expect, it } from "vitest";
import { resolveSubmission } from "./engine";

describe("resolveSubmission", () => {
  it("wins on an exact match", () => {
    expect(resolveSubmission({ roundNumber: 3, playerAnswer: "water", aiAnswer: "water", maxRounds: 8 })).toEqual({
      matched: true,
      status: "won",
      nextRound: null,
    });
  });

  it("uses both answers as the next endpoints on a miss", () => {
    expect(resolveSubmission({ roundNumber: 1, playerAnswer: "beach", aiAnswer: "boat", maxRounds: 8 })).toEqual({
      matched: false,
      status: "active",
      nextRound: { roundNumber: 2, wordA: "beach", wordB: "boat" },
    });
  });

  it("loses after the final round", () => {
    expect(resolveSubmission({ roundNumber: 8, playerAnswer: "a", aiAnswer: "b", maxRounds: 8 }).status).toBe("lost");
  });

  it("still wins on the final round", () => {
    expect(resolveSubmission({ roundNumber: 8, playerAnswer: "a", aiAnswer: "a", maxRounds: 8 }).status).toBe("won");
  });
});
