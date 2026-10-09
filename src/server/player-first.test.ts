import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyMemoryStore } from "./store/daily-memory-store";
import { MemoryStore } from "./store/memory-store";
import { getDaily, prepareDaily, startDaily, startUnlimited, submitDaily } from "./daily-service";
import type { ReviewAnswerInput } from "./ai/types";

vi.mock("server-only", () => ({}));
const { chooseWord, reviewAnswer } = vi.hoisted(() => ({ chooseWord: vi.fn(), reviewAnswer: vi.fn() }));
vi.mock("./opening-words", () => ({
  presetOpeningWords: (count: number) => ["zebra", "mountain", "coffee", "ocean", "moon"].slice(0, count),
}));
vi.mock("./ai", () => ({
  getAiPlayer: () => ({ id: "test", chooseWord }),
  getAnswerJudge: () => ({ reviewAnswer }),
  AiUnavailableError: class extends Error {},
}));
let dailyStore: DailyMemoryStore;
let store: MemoryStore;
vi.mock("./store/daily-index", () => ({ getDailyStore: () => dailyStore }));
vi.mock("./store", () => ({ getStore: () => store }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  dailyStore = new DailyMemoryStore();
  store = new MemoryStore();
  chooseWord.mockReset().mockResolvedValue("bridge");
  reviewAnswer.mockReset().mockImplementation(async (input: ReviewAnswerInput) => ({
    word: input.answer, boardWord: null, semanticMatch: false,
  }));
});
afterEach(() => vi.useRealTimers());

describe("player-first gameplay", () => {
  it("commits five shared Daily words before any submission without exposing them or calling AI", async () => {
    const players = [crypto.randomUUID(), crypto.randomUUID()];
    const runs = await Promise.all(players.map((playerId) => startDaily(playerId)));
    for (let i = 0; i < runs.length; i++) {
      expect(runs[i].current).toMatchObject({ guess: 1, opening: true, wordA: "", wordB: "", ready: true });
      expect(runs[i].rounds.every((round) => round.startPair === null)).toBe(true);
      expect(JSON.stringify(runs[i])).not.toMatch(/zebra|mountain|coffee|ocean|moon/);
      await prepareDaily(players[i], runs[i].id);
    }
    expect((await dailyStore.get(runs[0].id))?.openingWords).toEqual((await dailyStore.get(runs[1].id))?.openingWords);
    expect(chooseWord).not.toHaveBeenCalled();
    expect(reviewAnswer).not.toHaveBeenCalled();
  });

  it("reveals the committed word with the player's first word and resumes ordinary convergence", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const input = { id: run.id, playerId, round: 1, guess: 1 };
    await expect(submitDaily({ ...input, answer: "two words" })).rejects.toMatchObject({ code: "invalid_answer" });
    expect((await getDaily(playerId, run.id)).current?.guess).toBe(1);
    const first = await submitDaily({ ...input, answer: "Donkey!" });
    expect(first.reveal).toMatchObject({ playerAnswer: "donkey", aiAnswer: "zebra", matched: false });
    expect(first.run.current).toMatchObject({ guess: 2, wordA: "donkey", wordB: "zebra" });
    expect(first.run.current?.opening).toBeUndefined();
    expect(reviewAnswer).not.toHaveBeenCalled();
    await expect(submitDaily({ ...input, answer: "donkey" })).rejects.toMatchObject({ code: "conflict" });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(1);
    await prepareDaily(playerId, run.id);
    expect(chooseWord).toHaveBeenCalledWith({ wordA: "donkey", wordB: "zebra" });
    const second = await submitDaily({ ...input, guess: 2, answer: "bridge" });
    expect(second.run.score).toBe(800);
    expect(second.run.current).toMatchObject({ round: 2, guess: 1, opening: true });
    expect(reviewAnswer).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(second.run)).not.toContain("mountain");
  });

  it("scores opening matches across all five rounds and converts every historical Daily", async () => {
    const playerId = crypto.randomUUID();
    let run = await startDaily(playerId);
    for (const [index, word] of ["zebra", "mountain", "coffee", "ocean", "moon"].entries()) {
      run = (await submitDaily({ id: run.id, playerId, round: index + 1, guess: 1, answer: word })).run;
    }
    expect(run).toMatchObject({ score: 5000, status: "completed", current: null });
    expect((await startDaily(playerId)).id).toBe(run.id);
    expect(reviewAnswer).not.toHaveBeenCalled();
    for (const date of ["2026-09-30", "2026-10-09"]) {
      const archive = await startDaily(playerId, date);
      expect(archive.playerFirst).toBe(true);
      expect(archive.rounds.every((round) => round.startPair === null)).toBe(true);
      expect(archive.current).toMatchObject({ opening: true, wordA: "", wordB: "", ready: true });
      await prepareDaily(playerId, archive.id);
    }
    expect(chooseWord).not.toHaveBeenCalled();
  });

  it("preserves a submitted opening while later AI preparation fails", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    await submitDaily({ id: run.id, playerId, round: 1, guess: 1, answer: "donkey" });
    chooseWord.mockRejectedValueOnce(new Error("offline"));
    await expect(prepareDaily(playerId, run.id)).rejects.toMatchObject({ code: "ai_unavailable" });
    expect((await getDaily(playerId, run.id)).current).toMatchObject({ guess: 2, wordA: "donkey", wordB: "zebra" });
    expect((await getDaily(playerId, run.id)).rounds[0].guesses).toHaveLength(1);
  });

  it("plays Unlimited through the same five-round engine with hidden preset words", async () => {
    const playerId = crypto.randomUUID();
    const fresh = await startUnlimited(playerId, "animals");
    expect(fresh).toMatchObject({ playerFirst: true, mode: "unlimited", theme: "animals", current: { opening: true, ready: true } });
    expect(fresh.rounds).toHaveLength(5);
    expect(JSON.stringify(await getDaily(playerId, fresh.id))).not.toContain("zebra");
    const first = await submitDaily({ playerId, id: fresh.id, round: 1, guess: 1, answer: "donkey" });
    expect(first.reveal).toMatchObject({ playerAnswer: "donkey", aiAnswer: "zebra" });
    await prepareDaily(playerId, fresh.id);
    expect(chooseWord).toHaveBeenCalledWith({ wordA: "donkey", wordB: "zebra" });
    let result = await submitDaily({ playerId, id: fresh.id, round: 1, guess: 2, answer: "bridge" });
    expect(result.run.score).toBe(800);
    for (const [index, answer] of ["mountain", "coffee", "ocean", "moon"].entries()) {
      result = await submitDaily({ playerId, id: fresh.id, round: index + 2, guess: 1, answer });
    }
    expect(result.run).toMatchObject({ status: "completed", score: 4800, current: null });
  });
});
