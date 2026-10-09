import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyMemoryStore } from "./store/daily-memory-store";
import type { DailyRunView } from "@/lib/game/daily-run";
import { MemoryStore } from "./store/memory-store";
import type { ReviewAnswerInput } from "./ai/types";
import { dailyResults, getDaily, prepareDaily, shareDaily, startDaily, submitDaily } from "./daily-service";
import { POST as startRoute } from "@/app/api/daily/route";
import { GET as getRoute } from "@/app/api/daily/[id]/route";
import { POST as prepareRoute } from "@/app/api/daily/[id]/prepare/route";
import { POST as submitRoute } from "@/app/api/daily/[id]/submit/route";
import { GET as resultsRoute } from "@/app/api/daily/[id]/results/route";
import { GET as scoresRoute } from "@/app/api/scores/route";
import { POST as legacyStartRoute } from "@/app/api/games/route";

vi.mock("server-only", () => ({}));
let dailyStore: DailyMemoryStore;
let store: MemoryStore;
const { chooseWord, reviewAnswer } = vi.hoisted(() => ({ chooseWord: vi.fn(), reviewAnswer: vi.fn() }));
vi.mock("./store/daily-index", () => ({ getDailyStore: () => dailyStore }));
vi.mock("./store", () => ({ getStore: () => store }));
vi.mock("./opening-words", () => ({
  presetOpeningWords: () => ["zebra", "mountain", "coffee", "ocean", "moon"],
}));
vi.mock("./ai", () => ({
  getAiPlayer: () => ({ id: "test", chooseWord }),
  getAnswerJudge: () => ({ reviewAnswer }),
  AiUnavailableError: class extends Error {},
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  dailyStore = new DailyMemoryStore();
  store = new MemoryStore();
  chooseWord.mockReset().mockImplementation(async ({ wordA, wordB }: { wordA: string; wordB: string }) =>
    ["water", "boat", "bridge"].find((word) => word !== wordA && word !== wordB),
  );
  reviewAnswer.mockReset().mockImplementation(async (input: ReviewAnswerInput) => ({
    word: input.answer, boardWord: null, semanticMatch: false,
  }));
});
afterEach(() => vi.useRealTimers());

describe("five-round Daily service", () => {
  it("backfills valid past dates with five hidden openings, resumes, and rejects unavailable dates", async () => {
    const playerId = crypto.randomUUID();
    const archive = await startDaily(playerId, "2026-09-30");
    expect(archive).toMatchObject({ mode: "archive", puzzleNumber: 1 });
    expect(archive.rounds).toHaveLength(5);
    expect(archive.current).toMatchObject({ opening: true, wordA: "", wordB: "" });
    expect(archive.rounds.every((round) => round.startPair === null)).toBe(true);
    expect((await startDaily(playerId, "2026-09-30")).id).toBe(archive.id);
    const today = await startDaily(playerId);
    expect(today.mode).toBe("daily");
    for (const date of ["2026-10-06", "2026-09-29", "2026-02-30", "oops"]) {
      await expect(startDaily(playerId, date)).rejects.toMatchObject({ code: "bad_request" });
    }
    expect(store.events.filter((event) => event.name === "daily_started")).toHaveLength(2);
  });

  it("reuses committed AI choices and never returns an unanswered choice", async () => {
    const players = [crypto.randomUUID(), crypto.randomUUID()];
    const runs = await Promise.all(players.map((playerId) => startDaily(playerId)));
    const a = await prepareDaily(players[0], runs[0].id);
    expect(a.current).not.toHaveProperty("aiAnswer");
    expect(a.rounds[0].guesses).toEqual([]);
    await prepareDaily(players[1], runs[1].id);
    expect(chooseWord).not.toHaveBeenCalled();
    await Promise.all(players.map((playerId, index) => submitDaily({
      id: runs[index].id, playerId, round: 1, guess: 1, answer: "beach",
    })));
    await prepareDaily(players[0], runs[0].id);
    await prepareDaily(players[1], runs[1].id);
    expect(chooseWord).toHaveBeenCalledTimes(1);
    await expect(getDaily(players[1], a.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(prepareDaily(players[1], a.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("doesn't consume a guess on validation or AI failures, and enforces quotas", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    const input = { id: run.id, playerId, round: 1, guess: 1 };
    await expect(submitDaily({ ...input, answer: "two words" })).rejects.toMatchObject({ code: "invalid_answer" });
    await submitDaily({ ...input, answer: "beach" });
    chooseWord.mockRejectedValueOnce(new Error("offline"));
    await expect(prepareDaily(playerId, run.id)).rejects.toMatchObject({ code: "ai_unavailable" });
    await prepareDaily(playerId, run.id);
    reviewAnswer.mockRejectedValueOnce(new Error("offline"));
    await expect(submitDaily({ ...input, guess: 2, answer: "ship" })).rejects.toMatchObject({ code: "ai_unavailable" });
    expect((await getDaily(playerId, run.id)).current?.guess).toBe(2);
    vi.spyOn(store, "consumeAiQuota").mockResolvedValueOnce(false);
    await expect(submitDaily({ ...input, guess: 2, answer: "ship" })).rejects.toMatchObject({ code: "rate_limited" });
    expect((await dailyStore.firstBoard(run.date, 1)).attempts).toBe(1);
  });

  it("normalizes and canonically counts first guesses, and judges later semantic matches", async () => {
    const playerId = crypto.randomUUID();
    const run = await startDaily(playerId);
    await prepareDaily(playerId, run.id);
    const first = await submitDaily({ id: run.id, playerId, round: 1, guess: 1, answer: "Beech!" });
    expect(first.firstGuesses).toEqual({ attempts: 1, guesses: [{ word: "beech", count: 1 }] });
    const otherId = crypto.randomUUID();
    const other = await startDaily(otherId);
    await prepareDaily(otherId, other.id);
    await submitDaily({ id: other.id, playerId: otherId, round: 1, guess: 1, answer: "beech" });
    expect((await dailyStore.firstBoard(run.date, 1)).guesses).toEqual([{ word: "beech", count: 2 }]);
    expect(reviewAnswer).not.toHaveBeenCalled();
    await prepareDaily(playerId, run.id);
    reviewAnswer.mockResolvedValueOnce({ word: "ship", boardWord: null, semanticMatch: true });
    const second = await submitDaily({ id: run.id, playerId, round: 1, guess: 2, answer: "ship" });
    expect(second.reveal.matched).toBe(true);
    expect(second.run).toMatchObject({ score: 800, current: { round: 2, guess: 1 } });
    await expect(dailyResults(playerId, run.id)).rejects.toMatchObject({ code: "conflict" });
    await expect(submitDaily({ id: run.id, playerId, round: 1, guess: 2, answer: "ship" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("reveals distributions only after five rounds, saves scores, and scopes sharing to the owner", async () => {
    const playerId = crypto.randomUUID();
    let run = await startDaily(playerId);
    for (let round = 1; round <= 5; round++) {
      await prepareDaily(playerId, run.id);
      const answer = (await dailyStore.get(run.id))!.rounds[round - 1].aiAnswer!;
      const result = await submitDaily({ id: run.id, playerId, round, guess: 1, answer });
      run = result.run;
      if (round < 5) await expect(dailyResults(playerId, run.id)).rejects.toMatchObject({ code: "conflict" });
    }
    expect(run).toMatchObject({ status: "completed", score: 5000, current: null });
    expect((await dailyResults(playerId, run.id)).betterThanPercent).toBeNull();
    expect(store.events.filter((event) => event.name === "daily_completed")).toHaveLength(1);
    await shareDaily(playerId, run.id);
    await expect(shareDaily(crypto.randomUUID(), run.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await startDaily(playerId)).id).toBe(run.id);
    vi.setSystemTime(new Date("2026-10-06T00:01:00Z"));
    expect((await dailyStore.summary(playerId, "2026-10-06")).streak.current).toBe(1);
    expect((await startDaily(playerId)).id).not.toBe(run.id);
  });

  it("retries concurrent first-guess board updates without judging or changing the player's word", async () => {
    const players = [crypto.randomUUID(), crypto.randomUUID()];
    const runs = await Promise.all(players.map((playerId) => startDaily(playerId)));
    await Promise.all(runs.map((run, index) => prepareDaily(players[index], run.id)));
    reviewAnswer.mockImplementation(async (input: ReviewAnswerInput) => ({
      word: input.boardWords[0] ?? input.answer, boardWord: input.boardWords[0] ?? null, semanticMatch: false,
    }));
    await Promise.all(runs.map((run, index) => submitDaily({
      id: run.id, playerId: players[index], round: 1, guess: 1, answer: ["beach", "shore"][index],
    })));
    expect(reviewAnswer).not.toHaveBeenCalled();
    expect((await dailyStore.firstBoard(runs[0].date, 1)).guesses).toEqual([{ word: "beach", count: 1 }, { word: "shore", count: 1 }]);
  });

  it("enforces HTTP ownership and guess bounds, ignores client scoring, and merges saved scores", async () => {
    const playerId = crypto.randomUUID();
    const headers = { "x-player-id": playerId, "content-type": "application/json" };
    const request = (body: object) => new Request("http://localhost/api/daily", {
      method: "POST", headers, body: JSON.stringify(body),
    });
    const started = await startRoute(request({}));
    expect(started.status).toBe(200);
    const { run }: { run: DailyRunView } = await started.json();
    const ctx = { params: Promise.resolve({ id: run.id }) };
    expect((await prepareRoute(request({}), ctx)).status).toBe(200);
    const read = await getRoute(new Request("http://localhost", { headers }), ctx);
    expect(JSON.stringify(await read.json())).not.toContain('"aiAnswer"');
    expect(read.headers.get("Cache-Control")).toBe("no-store");
    expect((await getRoute(new Request("http://localhost", { headers: { "x-player-id": crypto.randomUUID() } }), ctx)).status).toBe(404);
    expect((await getRoute(new Request("http://localhost"), ctx)).status).toBe(400);
    expect((await resultsRoute(new Request("http://localhost", { headers }), ctx)).status).toBe(409);
    for (const invalid of [{ round: 0, guess: 1 }, { round: 6, guess: 1 }, { round: 1, guess: 6 }, { round: 1.5, guess: 1 }]) {
      expect((await submitRoute(request({ ...invalid, answer: "water" }), ctx)).status).toBe(400);
    }
    const answer = (await dailyStore.get(run.id))!.rounds[0].aiAnswer!;
    const submitted = await submitRoute(request({ round: 1, guess: 1, answer, score: 5000, status: "completed" }), ctx);
    expect(await submitted.json()).toMatchObject({ run: { score: 1000, status: "active", current: { round: 2 } } });
    const compatibleStart = await legacyStartRoute(request({ mode: "daily" }));
    expect(compatibleStart.status).toBe(200);
    expect(await compatibleStart.json()).toMatchObject({ run: { id: run.id, playerFirst: true } });
    const scores = await scoresRoute(new Request("http://localhost/api/scores", { headers }));
    expect(await scores.json()).toMatchObject({ scores: { dailyRuns: { history: [{ score: 1000, status: "active" }] } } });
  });

  it("preserves legacy scores and merges old on-time completions into the new streak", async () => {
    const playerId = crypto.randomUUID();
    const legacy = await store.createGame({
      playerId, mode: "daily", puzzleDate: "2026-10-04", puzzleNumber: 5,
      wordA: "donkey", wordB: "zebra",
    });
    const [round] = await store.getRounds(legacy.id);
    await store.setAiAnswer(round.id, "zonkey");
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    await store.submitAnswer({ gameId: legacy.id, playerId, roundNumber: 1, answer: "zonkey", maxRounds: 8 });
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    dailyStore = new DailyMemoryStore(async (id) => {
      const scores = await store.getPlayerScores(id, "2026-10-05");
      return scores.savedDailies.filter((game) => game.status !== "active").map((game) => game.date);
    });
    const run = await startDaily(playerId);
    for (let number = 1; number <= 5; number++) {
      await prepareDaily(playerId, run.id);
      const answer = (await dailyStore.get(run.id))!.rounds[number - 1].aiAnswer!;
      await submitDaily({ id: run.id, playerId, round: number, guess: 1, answer });
    }
    expect((await dailyStore.summary(playerId, "2026-10-05")).streak).toEqual({ current: 2, best: 2 });
    expect((await store.getPlayerScores(playerId, "2026-10-05")).recent).toMatchObject([{ id: legacy.id, rounds: 1 }]);
    expect((await dailyStore.summary(playerId, "2026-10-05")).history).toHaveLength(1);
  });
});
