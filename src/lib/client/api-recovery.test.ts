import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameView } from "@/lib/game/types";
import type { DailyRunView } from "@/lib/game/daily-run";

const fetchMock = vi.fn();
const assign = vi.fn();
const game: GameView = {
  id: "game", mode: "unlimited", status: "active", puzzleNumber: null, maxRounds: 8,
  startPair: { a: "zebra", b: "piano", emojiA: "⬜", emojiB: "⬜" },
  current: { number: 2, wordA: "music", wordB: "stripe", ready: false },
  rounds: [{ number: 1, wordA: "zebra", wordB: "piano", playerAnswer: "music", aiAnswer: "stripe", matched: false }],
};
const run: DailyRunView = {
  id: "daily", date: "2026-10-09", puzzleNumber: 10, mode: "daily", status: "active", score: 1000,
  current: { round: 2, guess: 1, wordA: "dog", wordB: "bone", ready: false },
  rounds: [{ number: 1, startPair: game.startPair, score: 1000, status: "won", guesses: [{ ...game.rounds[0], matched: true }] }],
};
function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchMock.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { assign, pathname: "/", search: "" } });
  vi.stubGlobal("localStorage", { getItem: () => "62f906da-37d3-45ab-8f2c-4d8c54bf03ed", setItem: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("client request recovery", () => {
  it("preserves the submitted body through a transient failure and retries only once", async () => {
    const { api } = await import("./api");
    fetchMock.mockResolvedValueOnce(response({ code: "ai_unavailable", error: "Retry" }, 503))
      .mockResolvedValueOnce(response({ game: { ...game, rounds: [] } }))
      .mockResolvedValueOnce(response({ game, reveal: { roundNumber: 1, playerAnswer: "music", aiAnswer: "stripe", matched: false } }));
    const pending = api.submit("game", 1, "music");
    await vi.advanceTimersByTimeAsync(400);
    expect(await pending).toMatchObject({ game, reveal: { playerAnswer: "music" } });
    const posts = fetchMock.mock.calls.filter(([, init]) => init.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0][1].body).toBe(posts[1][1].body);
  });

  it("recovers a committed Unlimited guess after the response is lost without posting it twice", async () => {
    const { api } = await import("./api");
    fetchMock.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(response({ game }));
    expect(await api.submit("game", 1, "music")).toMatchObject({ game, reveal: { roundNumber: 1, playerAnswer: "music" } });
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("recovers the original Daily guess when a duplicate finds the next round already open", async () => {
    const { api } = await import("./api");
    fetchMock.mockResolvedValueOnce(response({ code: "conflict", error: "Already done" }, 409))
      .mockResolvedValueOnce(response({ run }));
    expect(await api.submitDaily("daily", 1, 1, "music")).toMatchObject({ run: { score: 1000 }, reveal: { matched: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["invalid_answer", "rate_limited", "bad_request"])("never retries %s", async (code) => {
    const { api } = await import("./api");
    fetchMock.mockResolvedValue(response({ code, error: "No" }, 422));
    await expect(api.submit("game", 1, "music")).rejects.toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh anonymous identity for an expired account when Plus is off, without an upgrade redirect", async () => {
    const { api } = await import("./api");
    fetchMock.mockResolvedValueOnce(response({ code: "auth_required", error: "Sign in" }, 401))
      .mockResolvedValueOnce(response({ enabled: false, restore: true, playerId: null, email: null, plus: false }))
      .mockResolvedValueOnce(response({ game }));
    expect(await api.startGame("unlimited")).toEqual({ game });
    expect(assign).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers["x-player-id"]).not.toBe(fetchMock.mock.calls[2][1].headers["x-player-id"]);
  });

  it("still sends a player to Plus when the flag is enabled", async () => {
    const { api } = await import("./api");
    fetchMock.mockResolvedValueOnce(response({ code: "plus_required", error: "Unlock" }, 402))
      .mockResolvedValueOnce(response({ enabled: true }));
    await expect(api.startGame("unlimited")).rejects.toMatchObject({ code: "plus_required" });
    expect(assign).toHaveBeenCalledWith("/plus?next=%2F");
  });
});
