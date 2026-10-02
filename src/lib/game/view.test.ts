import { describe, expect, it } from "vitest";
import { toGameView, type GameRecord, type RoundRecord } from "./view";

const game: GameRecord = {
  id: "g1",
  playerId: "p1",
  mode: "daily",
  puzzleDate: "2026-10-01",
  puzzleNumber: 1,
  startWordA: "pizza",
  startWordB: "ocean",
  status: "active",
  roundNumber: 2,
  startedAt: "",
  completedAt: null,
  finalRounds: null,
};

function round(n: number, a: string, b: string, player: string | null, ai: string | null): RoundRecord {
  return { id: `r${n}`, gameId: "g1", roundNumber: n, wordA: a, wordB: b, playerAnswer: player, aiAnswer: ai, matched: player === null ? null : player === ai, createdAt: "" };
}

describe("toGameView", () => {
  it("never exposes the AI answer for the current round", () => {
    const view = toGameView(game, [round(1, "pizza", "ocean", "beach", "boat"), round(2, "beach", "boat", null, "sail")], 8);
    expect(view.current).toEqual({ number: 2, wordA: "beach", wordB: "boat", ready: true });
    expect(JSON.stringify(view)).not.toContain("sail");
    expect(view.rounds).toHaveLength(1);
    expect(view.startPair.emojiA).toBe("🍕");
  });

  it("reports not-ready when the AI hasn't answered", () => {
    const view = toGameView({ ...game, roundNumber: 1 }, [round(1, "pizza", "ocean", null, null)], 8);
    expect(view.current?.ready).toBe(false);
  });
});
