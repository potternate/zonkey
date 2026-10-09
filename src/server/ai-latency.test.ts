import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDaily, prepareDaily, startDaily, startUnlimited, submitDaily } from "./daily-service";
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
      run: { status: "active", playerFirst: true, current: { opening: true, ready: true } },
    });
    expect(chooseWord).not.toHaveBeenCalled();
  });

  it("counts concurrent opening submissions once without making an AI request", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const preparation = prepareDaily(playerId, run.id);
    const answer = (await dailyStore.get(run.id))!.openingWords[0];
    const input = { playerId, id: run.id, round: 1, guess: 1, answer };
    const submissions = Promise.allSettled([submitDaily(input), submitDaily(input)]);
    await preparation;
    const results = await submissions;
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "fulfilled")).toMatchObject({
      value: { run: { score: 1000, current: { round: 2 } }, reveal: { aiAnswer: answer, matched: true } },
    });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(1);
    expect(chooseWord).not.toHaveBeenCalled();
    expect(reviewAnswer).not.toHaveBeenCalled();
  });

  it("lets an Unlimited submission wait on the same independent generation as preparation", async () => {
    const ai = Promise.withResolvers<string>();
    chooseWord.mockReturnValue(ai.promise);
    const playerId = crypto.randomUUID();
    const game = await startUnlimited(playerId);
    await submitDaily({ playerId, id: game.id, round: 1, guess: 1, answer: "divergence" });
    const preparation = prepareDaily(playerId, game.id);
    const submission = submitDaily({ playerId, id: game.id, round: 1, guess: 2, answer: "convergence" });
    await vi.waitFor(() => expect(chooseWord).toHaveBeenCalledTimes(1));
    expect(reviewAnswer).not.toHaveBeenCalled();
    ai.resolve("convergence");
    await preparation;
    expect(await submission).toMatchObject({ run: { status: "active", score: 800, current: { round: 2 } }, reveal: { matched: true, aiAnswer: "convergence" } });
    expect(chooseWord).toHaveBeenCalledWith({ wordA: "divergence", wordB: (await dailyStore.get(game.id))!.openingWords[0] });
  });

  it("keeps a failed early guess uncounted and clears pending generation for a retry", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    await submitDaily({ playerId, id: run.id, round: 1, guess: 1, answer: "divergence" });
    const input = { playerId, id: run.id, round: 1, guess: 2, answer: "convergence" };
    chooseWord.mockRejectedValueOnce(new Error("offline"));
    await expect(submitDaily(input)).rejects.toMatchObject({ code: "ai_unavailable" });
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ ready: false, guess: 2 });
    expect((await getDaily(playerId, run.id)).rounds[0].guesses).toHaveLength(1);
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(1);
    expect(reviewAnswer).not.toHaveBeenCalled();
    expect(await submitDaily(input)).toMatchObject({ run: { score: 800 } });
    expect(chooseWord).toHaveBeenCalledTimes(2);
  });

  it("waits for an unprepared later guess and keeps its tapered score", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    await submitDaily({ playerId, id: run.id, round: 1, guess: 1, answer: "divergence" });
    const ai = Promise.withResolvers<string>();
    chooseWord.mockReturnValue(ai.promise);
    const submission = submitDaily({ playerId, id: run.id, round: 1, guess: 2, answer: "meeting" });
    await vi.waitFor(() => expect(chooseWord).toHaveBeenCalledTimes(1));
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
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ ready: true, guess: 1 });
  });

  it("prepares all five openings at creation and shares them privately across players", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const context = { params: Promise.resolve({ id: run.id }) };
    const preparation = prepareRoute(new Request("http://localhost", { method: "POST", headers: { "x-player-id": playerId } }), context);
    expect(run.current?.ready).toBe(true);
    const response = await preparation;
    expect(response.status).toBe(200);
    const publicView = await response.json();
    expect(JSON.stringify(publicView)).not.toContain("convergence");
    expect(publicView.run.current.ready).toBe(true);
    const otherId = crypto.randomUUID();
    const other = await startDaily(otherId);
    await prepareRoute(new Request("http://localhost", { method: "POST", headers: { "x-player-id": otherId } }), { params: Promise.resolve({ id: other.id }) });
    const words = (await dailyStore.get(run.id))!.openingWords;
    expect((await dailyStore.get(other.id))!.openingWords).toEqual(words);
    for (const word of words) expect(JSON.stringify(publicView)).not.toContain(JSON.stringify(word));
    await submitDaily({ id: run.id, playerId, round: 1, guess: 1, answer: words[0] });
    await prepareDaily(playerId, run.id);
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ round: 2, ready: true });
    expect(chooseWord).not.toHaveBeenCalled();
  });

  it("allows every preset opening even while the AI is offline", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    chooseWord.mockRejectedValue(new Error("offline"));
    const response = await prepareRoute(new Request("http://localhost", { method: "POST", headers: { "x-player-id": playerId } }), { params: Promise.resolve({ id: run.id }) });
    expect(response.status).toBe(200);
    const words = (await dailyStore.get(run.id))!.openingWords;
    for (let round = 1; round <= 5; round++) {
      expect((await getDaily(playerId, run.id)).current).toMatchObject({ round, opening: true, ready: true });
      await submitDaily({ id: run.id, playerId, round, guess: 1, answer: words[round - 1] });
    }
    expect(await getDaily(playerId, run.id)).toMatchObject({ score: 5000, status: "completed" });
    expect(chooseWord).not.toHaveBeenCalled();
  });
});
