import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockAnswerJudge } from "./ai/mock-judge";
import type { ReviewAnswerInput } from "./ai/types";
import { MemoryStore } from "./store/memory-store";
import { firstGuessBoardKey } from "@/lib/game/first-guesses";
import { getGame, prepareRound, startGame, submitAnswer, trackShare } from "./game-service";

const { chooseWord, reviewAnswer } = vi.hoisted(() => ({
  chooseWord: vi.fn(),
  reviewAnswer: vi.fn(),
}));
let store: MemoryStore;
vi.mock("server-only", () => ({}));
vi.mock("./store", () => ({ getStore: () => store }));
vi.mock("./ai", async () => {
  const { AiUnavailableError } = await import("./ai/types");
  return { AiUnavailableError, getAiPlayer: () => ({ chooseWord }), getAnswerJudge: () => ({ reviewAnswer }) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T23:59:00Z"));
  store = new MemoryStore();
  chooseWord.mockReset().mockImplementation(async ({ wordA, wordB }) => ["water", "fire", "time"].find((word) => word !== wordA && word !== wordB));
  reviewAnswer.mockReset().mockImplementation((input) => new MockAnswerJudge().reviewAnswer(input));
});
afterEach(() => vi.useRealTimers());

describe("daily games and normalized first guesses", () => {
  it("shares the UTC puzzle between players and resumes one attempt per player", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "daily" });
    expect(game.puzzleNumber).toBe(2);
    const other = await startGame({ playerId: crypto.randomUUID(), mode: "daily" });
    expect(other.startPair).toEqual(game.startPair);
    expect(other.puzzleNumber).toBe(game.puzzleNumber);
    expect((await startGame({ playerId, mode: "daily" })).id).toBe(game.id);
    await submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "water" });
    expect((await startGame({ playerId, mode: "daily" })).status).toBe("won");
    vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    const tomorrow = await startGame({ playerId, mode: "daily" });
    expect(tomorrow.id).not.toBe(game.id);
    expect(tomorrow.puzzleNumber).toBe(3);
  });

  it("starts a new Unlimited game on every request", async () => {
    const playerId = crypto.randomUUID();
    const first = await startGame({ playerId, mode: "unlimited" });
    const second = await startGame({ playerId, mode: "unlimited" });
    expect(second.mode).toBe("unlimited");
    expect(second.id).not.toBe(first.id);
  });

  it("rejects new AI work when the quota is exhausted", async () => {
    vi.spyOn(store, "consumeAiQuota").mockResolvedValueOnce(false);
    await expect(startGame({ playerId: crypto.randomUUID(), mode: "unlimited" })).rejects.toMatchObject({
      code: "rate_limited",
    });
    expect(chooseWord).not.toHaveBeenCalled();
  });

  it("resumes the same daily game under simultaneous start requests", async () => {
    const playerId = crypto.randomUUID();
    const games = await Promise.all([startGame({ playerId, mode: "daily" }), startGame({ playerId, mode: "daily" })]);
    expect(games[0].id).toBe(games[1].id);
  });

  it("starts a first guess at 1 and groups equivalent guesses across users", async () => {
    const playerId = crypto.randomUUID();
    const first = await startGame({ playerId, mode: "daily" });
    expect(first.firstGuesses).toBeUndefined();
    expect(first.current).not.toHaveProperty("aiAnswer");
    const submitted = await submitAnswer({ playerId, gameId: first.id, roundNumber: 1, answer: "boat" });
    expect(submitted.game.firstGuesses).toEqual({ attempts: 1, guesses: [{ word: "boat", count: 1 }] });
    const secondPlayer = crypto.randomUUID();
    const second = await startGame({ playerId: secondPlayer, mode: "daily" });
    expect(second.firstGuesses).toBeUndefined();
    const equivalent = await submitAnswer({ playerId: secondPlayer, gameId: second.id, roundNumber: 1, answer: "Ships!" });
    expect(equivalent.reveal.playerAnswer).toBe("boat");
    expect(equivalent.game.firstGuesses).toEqual({ attempts: 2, guesses: [{ word: "boat", count: 2 }] });
    expect(reviewAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ boardWords: ["boat"] }));
  });

  it("keeps a failed judge call retryable without counting an attempt", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "daily" });
    reviewAnswer.mockRejectedValueOnce(new Error("Service unavailable"));
    await expect(submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "watr" })).rejects.toMatchObject({ code: "ai_unavailable" });
    expect((await getGame(playerId, game.id)).current).toMatchObject({ number: 1, ready: true });
    const record = await store.getGame(game.id);
    expect(await store.getFirstGuesses(firstGuessBoardKey(record!))).toEqual({ attempts: 0, guesses: [] });
    const retry = await submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "watr" });
    expect(retry.reveal.playerAnswer).toBe("water");
    expect(retry.game.firstGuesses?.attempts).toBe(1);
  });

  it("rejudges simultaneous synonyms against the committed board", async () => {
    const players = [crypto.randomUUID(), crypto.randomUUID()];
    const games = await Promise.all(players.map((playerId) => startGame({ playerId, mode: "daily" })));
    reviewAnswer.mockImplementation(async (input: ReviewAnswerInput) => ({
      word: input.boardWords[0] ?? input.answer,
      boardWord: input.boardWords[0] ?? null,
      semanticMatch: false,
    }));
    await Promise.all(games.map((game, index) => submitAnswer({
      playerId: players[index], gameId: game.id, roundNumber: 1, answer: ["boat", "ship"][index],
    })));
    expect(reviewAnswer).toHaveBeenCalledTimes(3);
    expect((await getGame(players[0], games[0].id)).firstGuesses).toEqual({
      attempts: 2, guesses: [{ word: "boat", count: 2 }],
    });
  });

  it("leaves the turn unchanged after repeated board conflicts", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "daily" });
    vi.spyOn(store, "submitAnswer").mockResolvedValue({ ok: false, code: "board_changed" });
    await expect(submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "boat" })).rejects.toMatchObject({
      code: "ai_unavailable",
    });
    expect(reviewAnswer).toHaveBeenCalledTimes(3);
    expect((await getGame(playerId, game.id)).current).toMatchObject({ number: 1, ready: true });
  });

  it("counts only one of concurrent duplicate submissions", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "daily" });
    const input = { playerId, gameId: game.id, roundNumber: 1, answer: "boat" };
    const results = await Promise.allSettled([submitAnswer(input), submitAnswer(input), submitAnswer(input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await getGame(playerId, game.id)).firstGuesses?.attempts).toBe(1);
  });

  it("records share events only for the game's owner", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "unlimited" });
    await trackShare(playerId, game.id);
    await expect(trackShare(crypto.randomUUID(), game.id)).rejects.toMatchObject({ code: "not_found" });
    expect(store.events.filter((event) => event.name === "share_clicked")).toHaveLength(1);
  });

  it("wins when an identical plural is canonicalized for the board", async () => {
    const playerId = crypto.randomUUID();
    chooseWord.mockResolvedValueOnce("boats");
    const game = await startGame({ playerId, mode: "daily" });
    reviewAnswer.mockResolvedValueOnce({ word: "boat", boardWord: null, semanticMatch: false });
    const result = await submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "Boats" });
    expect(result.game.status).toBe("won");
    expect(result.reveal).toMatchObject({ playerAnswer: "boat", aiAnswer: "boats", matched: true });
    expect(result.game.firstGuesses?.guesses).toEqual([{ word: "boat", count: 1 }]);
  });
});

describe("semantic wins", () => {
  it("accepts an equivalent later guess and stores it without changing the AI answer", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "daily" });
    await submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "beach" });
    chooseWord.mockResolvedValueOnce("ship");
    await prepareRound(playerId, game.id);
    reviewAnswer.mockResolvedValueOnce({ word: "boat", boardWord: null, semanticMatch: true });
    const result = await submitAnswer({ playerId, gameId: game.id, roundNumber: 2, answer: "boat" });
    expect(result.game.status).toBe("won");
    expect(result.reveal).toMatchObject({ playerAnswer: "boat", aiAnswer: "ship", matched: true });
    expect(result.game.firstGuesses?.attempts).toBe(1);
  });

  it("keeps related but different guesses as a mismatch", async () => {
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "daily" });
    await submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "beach" });
    chooseWord.mockResolvedValueOnce("boat");
    await prepareRound(playerId, game.id);
    reviewAnswer.mockResolvedValueOnce({ word: "ocean", boardWord: null, semanticMatch: false });
    const result = await submitAnswer({ playerId, gameId: game.id, roundNumber: 2, answer: "ocean" });
    expect(result.game.status).toBe("active");
    expect(result.reveal.matched).toBe(false);
  });
});
