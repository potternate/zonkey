import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyArchiveEntry } from "@/lib/game/archive";
import { POST } from "@/app/api/games/route";
import { MockAnswerJudge } from "./ai/mock-judge";
import { getDailyResults, getGame, startGame, submitAnswer } from "./game-service";
import { MemoryStore } from "./store/memory-store";

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
  vi.setSystemTime(new Date("2026-10-04T23:59:00Z"));
  store = new MemoryStore();
  chooseWord.mockReset().mockResolvedValue("water");
  reviewAnswer.mockReset().mockImplementation((input) => new MockAnswerJudge().reviewAnswer(input));
});
afterEach(() => vi.useRealTimers());

describe("playable Daily archives", () => {
  it("plays the original pair, resumes concurrent starts, and reopens saved results", async () => {
    const playerId = crypto.randomUUID();
    const input = { playerId, mode: "daily" as const, puzzleDate: "2026-09-30" };
    const [first, second] = await Promise.all([startGame(input), startGame(input)]);
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({
      mode: "practice", puzzleNumber: 1, startPair: dailyArchiveEntry(input.puzzleDate)?.pair,
    });
    expect(first.current).not.toHaveProperty("aiAnswer");
    expect(JSON.stringify(first)).not.toContain("water");
    await submitAnswer({ playerId, gameId: first.id, roundNumber: 1, answer: "water" });
    expect(await startGame(input)).toMatchObject({ id: first.id, status: "won" });
    await expect(getGame(crypto.randomUUID(), first.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("keeps archive results out of live Daily stats, streaks and distributions", async () => {
    const playerId = crypto.randomUUID();
    const daily = await startGame({ playerId, mode: "daily" });
    await submitAnswer({ playerId, gameId: daily.id, roundNumber: 1, answer: "water" });
    const archive = await startGame({ playerId, mode: "daily", puzzleDate: "2026-10-01" });
    await submitAnswer({ playerId, gameId: archive.id, roundNumber: 1, answer: "water" });
    const scores = await store.getPlayerScores(playerId, "2026-10-04");
    expect(scores.daily.played).toBe(1);
    expect(scores.unlimited.played).toBe(0);
    expect(scores.archive.played).toBe(1);
    expect(scores.dailyStreak).toEqual({ current: 1, best: 1 });
    expect((await getDailyResults(playerId, daily.id)).totalPlayers).toBe(1);
    await expect(getDailyResults(playerId, archive.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("resumes a previously started Daily from the archive after midnight", async () => {
    const playerId = crypto.randomUUID();
    const daily = await startGame({ playerId, mode: "daily", puzzleDate: "2026-10-04" });
    expect(daily.mode).toBe("daily");
    expect((await startGame({ playerId, mode: "daily" })).id).toBe(daily.id);
    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
    const archive = await startGame({ playerId, mode: "daily", puzzleDate: "2026-10-04" });
    expect(archive.mode).toBe("daily");
    expect(archive.id).toBe(daily.id);
    expect(archive.startPair).toEqual(daily.startPair);
    await submitAnswer({ playerId, gameId: daily.id, roundNumber: 1, answer: "water" });
    expect((await store.getPlayerScores(playerId, "2026-10-05")).dailyStreak.current).toBe(0);
  });

  it("opens an original completed Daily result instead of allowing a replay", async () => {
    const playerId = crypto.randomUUID();
    const daily = await startGame({ playerId, mode: "daily" });
    await submitAnswer({ playerId, gameId: daily.id, roundNumber: 1, answer: "water" });
    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
    const create = vi.spyOn(store, "createGame");
    chooseWord.mockClear();
    expect(await startGame({ playerId, mode: "daily", puzzleDate: "2026-10-04" })).toMatchObject({
      id: daily.id, mode: "daily", status: "won",
    });
    expect(create).not.toHaveBeenCalled();
    expect(chooseWord).not.toHaveBeenCalled();
  });

  it.each(["", "2026-09-29", "2026-10-05", "2026-02-30", "2026-9-30", "nonsense"])(
    "rejects unavailable date %s before creating a game or calling AI",
    async (puzzleDate) => {
      const create = vi.spyOn(store, "createGame");
      await expect(startGame({ playerId: crypto.randomUUID(), mode: "daily", puzzleDate }))
        .rejects.toMatchObject({ code: "bad_request", status: 400 });
      expect(create).not.toHaveBeenCalled();
      expect(chooseWord).not.toHaveBeenCalled();
    },
  );

  it("validates date requests at the API boundary", async () => {
    const headers = { "content-type": "application/json", "x-player-id": crypto.randomUUID() };
    const valid = await POST(new Request("http://localhost/api/games", {
      method: "POST", headers, body: JSON.stringify({ mode: "daily", puzzleDate: "2026-09-30" }),
    }));
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ game: { mode: "practice", puzzleNumber: 1 } });
    for (const body of [
      { mode: "daily", puzzleDate: 20261001 },
      { mode: "daily", puzzleDate: "2026-10-05" },
      { mode: "unlimited", puzzleDate: "2026-09-30" },
    ]) {
      const invalid = await POST(new Request("http://localhost/api/games", {
        method: "POST", headers, body: JSON.stringify(body),
      }));
      expect(invalid.status).toBe(400);
    }
  });
});
