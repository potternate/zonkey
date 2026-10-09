import { beforeEach, describe, expect, it, vi } from "vitest";
import { startGame, prepareRound, submitAnswer } from "./game-service";
import { getDaily, prepareDaily, startDaily, submitDaily } from "./daily-service";
import { DailyMemoryStore } from "./store/daily-memory-store";
import { MemoryStore } from "./store/memory-store";
import { POST as prepareRoute } from "@/app/api/daily/[id]/prepare/route";
import { POST as startRoute } from "@/app/api/games/route";
import type { ReviewAnswerInput } from "./ai/types";

vi.mock("server-only", () => ({}));
const { chooseWord, reviewAnswer } = vi.hoisted(() => ({ chooseWord: vi.fn(), reviewAnswer: vi.fn() }));
let dailyStore: DailyMemoryStore;
let store: MemoryStore;
vi.mock("./store/daily-index", () => ({ getDailyStore: () => dailyStore }));
vi.mock("./store", () => ({ getStore: () => store }));
vi.mock("./ai", () => ({
  getAiPlayer: () => ({ chooseWord }),
  getAnswerJudge: () => ({ reviewAnswer }),
  AiUnavailableError: class extends Error {},
}));

beforeEach(() => {
  dailyStore = new DailyMemoryStore();
  store = new MemoryStore();
  chooseWord.mockReset().mockResolvedValue("convergence");
  reviewAnswer.mockReset().mockImplementation(async (input: ReviewAnswerInput) => ({
    word: input.answer, boardWord: null, semanticMatch: false,
  }));
});

describe("playing during AI preparation", () => {
  it("returns a ready Unlimited opening without calling the AI", async () => {
    const response = await startRoute(new Request("http://localhost/api/games", {
      method: "POST", headers: { "x-player-id": crypto.randomUUID(), "content-type": "application/json" },
      body: JSON.stringify({ mode: "unlimited" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      game: { status: "active", maxRounds: 8, startPair: null, current: { opening: true, ready: true } },
    });
    expect(chooseWord).not.toHaveBeenCalled();
  });

  it("waits for a pending Daily commitment and counts duplicate early submissions once", async () => {
    const ai = Promise.withResolvers<string>();
    chooseWord.mockReturnValue(ai.promise);
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const preparation = prepareDaily(playerId, run.id);
    const input = { playerId, id: run.id, round: 1, guess: 1, answer: "convergence" };
    const submissions = Promise.allSettled([submitDaily(input), submitDaily(input)]);
    await vi.waitFor(() => expect(chooseWord).toHaveBeenCalledTimes(1));
    expect(reviewAnswer).not.toHaveBeenCalled();
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ ready: false, guess: 1 });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(0);
    ai.resolve("convergence");
    await preparation;
    const results = await submissions;
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "fulfilled")).toMatchObject({
      value: { run: { score: 1000, current: { round: 2 } }, reveal: { aiAnswer: "convergence", matched: true } },
    });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(1);
    expect(chooseWord).toHaveBeenCalledWith({ wordA: run.current!.wordA, wordB: run.current!.wordB });
  });

  it("lets an Unlimited submission wait on the same independent generation as preparation", async () => {
    const ai = Promise.withResolvers<string>();
    chooseWord.mockReturnValue(ai.promise);
    const playerId = crypto.randomUUID();
    const game = await startGame({ playerId, mode: "unlimited" }, false);
    const preparation = prepareRound(playerId, game.id);
    const submission = submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "convergence" });
    await vi.waitFor(() => expect(chooseWord).toHaveBeenCalledTimes(1));
    expect(reviewAnswer).not.toHaveBeenCalled();
    ai.resolve("convergence");
    await preparation;
    expect(await submission).toMatchObject({ game: { status: "won" }, reveal: { matched: true, aiAnswer: "convergence" } });
    expect(chooseWord).toHaveBeenCalledWith({ wordA: game.current!.wordA, wordB: game.current!.wordB });
  });

  it("keeps a failed early guess uncounted and clears pending generation for a retry", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const input = { playerId, id: run.id, round: 1, guess: 1, answer: "convergence" };
    chooseWord.mockRejectedValueOnce(new Error("offline"));
    await expect(submitDaily(input)).rejects.toMatchObject({ code: "ai_unavailable" });
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ ready: false, guess: 1 });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(0);
    expect(reviewAnswer).not.toHaveBeenCalled();
    expect(await submitDaily(input)).toMatchObject({ run: { score: 1000 } });
    expect(chooseWord).toHaveBeenCalledTimes(2);
  });

  it("waits for an unprepared later guess and keeps its tapered score", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    await submitDaily({ playerId, id: run.id, round: 1, guess: 1, answer: "divergence" });
    const ai = Promise.withResolvers<string>();
    chooseWord.mockReturnValue(ai.promise);
    const submission = submitDaily({ playerId, id: run.id, round: 1, guess: 2, answer: "meeting" });
    await vi.waitFor(() => expect(chooseWord).toHaveBeenCalledTimes(2));
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ guess: 2, ready: false });
    ai.resolve("meeting");
    expect(await submission).toMatchObject({ run: { score: 800, current: { round: 2 } }, reveal: { matched: true } });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(1);
  });

  it("rejects invalid early guesses before starting AI work", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    await expect(submitDaily({ playerId, id: run.id, round: 1, guess: 1, answer: "two words" })).rejects.toMatchObject({ code: "invalid_answer" });
    expect(chooseWord).not.toHaveBeenCalled();
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ ready: false, guess: 1 });
  });

  it("starts all five opening choices in parallel and reuses the private cache across players", async () => {
    const ai = Promise.withResolvers<string>();
    chooseWord.mockReturnValue(ai.promise);
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const context = { params: Promise.resolve({ id: run.id }) };
    const preparation = prepareRoute(new Request("http://localhost", { method: "POST", headers: { "x-player-id": playerId } }), context);
    await vi.waitFor(() => expect(chooseWord).toHaveBeenCalledTimes(5));
    expect(run.current?.ready).toBe(false);
    ai.resolve("convergence");
    const response = await preparation;
    expect(response.status).toBe(200);
    const publicView = await response.json();
    expect(JSON.stringify(publicView)).not.toContain("convergence");
    expect(publicView.run.current.ready).toBe(true);
    const otherId = crypto.randomUUID();
    const other = await startDaily(otherId);
    await prepareRoute(new Request("http://localhost", { method: "POST", headers: { "x-player-id": otherId } }), { params: Promise.resolve({ id: other.id }) });
    expect(chooseWord).toHaveBeenCalledTimes(5);
    await submitDaily({ id: run.id, playerId, round: 1, guess: 1, answer: "convergence" });
    await prepareDaily(playerId, run.id);
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ round: 2, ready: true });
    expect(chooseWord).toHaveBeenCalledTimes(5);
  });

  it("retries a failed future opening when reached without blocking the current round", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const failedPair = run.rounds[1].startPair;
    if (!failedPair) throw new Error("Expected a legacy starting pair");
    chooseWord.mockImplementation(async ({ wordA, wordB }: { wordA: string; wordB: string }) => {
      if (wordA === failedPair.a && wordB === failedPair.b) throw new Error("offline");
      return "convergence";
    });
    const response = await prepareRoute(new Request("http://localhost", { method: "POST", headers: { "x-player-id": playerId } }), { params: Promise.resolve({ id: run.id }) });
    expect(response.status).toBe(200);
    await submitDaily({ id: run.id, playerId, round: 1, guess: 1, answer: "convergence" });
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ round: 2, ready: false });
    chooseWord.mockResolvedValue("convergence");
    expect(await submitDaily({ id: run.id, playerId, round: 2, guess: 1, answer: "convergence" })).toMatchObject({ run: { score: 2000 } });
    expect(chooseWord).toHaveBeenCalledTimes(6);
  });
});
