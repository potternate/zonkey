import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "./store/memory-store";
import { DailyMemoryStore } from "./store/daily-memory-store";
import { startGame, submitAnswer } from "./game-service";
import { startDaily, submitDaily } from "./daily-service";
import { GameError } from "./errors";
import { getPlayerId } from "./http";
import { POST as startGameRoute } from "@/app/api/games/route";
import { GET as gameRoute } from "@/app/api/games/[id]/route";
import { POST as prepareGameRoute } from "@/app/api/games/[id]/prepare/route";
import { POST as submitGameRoute } from "@/app/api/games/[id]/submit/route";
import { POST as startDailyRoute } from "@/app/api/daily/route";
import { GET as dailyRoute } from "@/app/api/daily/[id]/route";
import { POST as prepareDailyRoute } from "@/app/api/daily/[id]/prepare/route";
import { POST as submitDailyRoute } from "@/app/api/daily/[id]/submit/route";
import { GET as accountRoute } from "@/app/api/account/route";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  enabled: true, userId: null as string | null, plus: false, claimed: false,
  playerId: "62f906da-37d3-45ab-8f2c-4d8c54bf03ed", chooseWord: vi.fn(),
}));
let store: MemoryStore;
let dailyStore: DailyMemoryStore;
vi.mock("./store", () => ({ getStore: () => store }));
vi.mock("./store/daily-index", () => ({ getDailyStore: () => dailyStore }));
vi.mock("./auth", () => ({
  plusEnabled: () => state.enabled,
  currentUser: async () => state.userId ? { id: state.userId } : null,
  requireUser: async () => {
    if (!state.userId) throw new GameError("auth_required", "Sign in.");
    return { id: state.userId };
  },
}));
vi.mock("./account-store", () => ({
  hasPlusAccess: async () => state.plus,
  isAccountPlayer: async () => state.claimed,
  linkPlayerAccount: async () => state.playerId,
}));
vi.mock("./ai", () => ({
  getAiPlayer: () => ({ chooseWord: state.chooseWord }),
  getAnswerJudge: () => ({ reviewAnswer: async ({ answer }: { answer: string }) =>
    ({ word: answer, boardWord: null, semanticMatch: false }) }),
  AiUnavailableError: class extends Error {},
}));

const playerId = state.playerId;
function request(body?: object, player = playerId) {
  return new Request("http://localhost/api/games", {
    method: body ? "POST" : "GET",
    headers: { "x-player-id": player, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function context(id: string) { return { params: Promise.resolve({ id }) }; }

beforeEach(() => {
  vi.unstubAllEnvs();
  store = new MemoryStore();
  dailyStore = new DailyMemoryStore();
  state.enabled = true;
  state.userId = null;
  state.plus = false;
  state.claimed = false;
  state.chooseWord.mockReset().mockResolvedValue("convergence");
});

describe("Plus route enforcement", () => {
  it("keeps all current Daily operations free and answers private", async () => {
    const started = await startDailyRoute(request({}));
    expect(started.status).toBe(200);
    const { run } = await started.json();
    const read = await dailyRoute(request(), context(run.id));
    expect(read.status).toBe(200);
    const prepared = await prepareDailyRoute(request({}), context(run.id));
    expect(prepared.status).toBe(200);
    expect(JSON.stringify(await prepared.json())).not.toContain("convergence");
    const submitted = await submitDailyRoute(request({ round: 1, guess: 1, answer: "convergence" }), context(run.id));
    expect(submitted.status).toBe(200);
    expect(await submitted.json()).toMatchObject({ run: { score: 1000 } });
  });

  it.each(["unlimited", "practice", "daily"])("requires Plus when starting %s through the legacy API", async (mode) => {
    const body = { mode, ...(mode === "daily" ? { puzzleDate: "2026-09-30" } : {}) };
    expect((await startGameRoute(request(body))).status).toBe(401);
    state.userId = crypto.randomUUID();
    expect((await startGameRoute(request(body))).status).toBe(402);
    expect(state.chooseWord).not.toHaveBeenCalled();
    state.plus = true;
    expect((await startGameRoute(request(body))).status).toBe(200);
  });

  it("blocks Unlimited resume, preparation and submission before AI work", async () => {
    const game = await startGame({ playerId, mode: "unlimited" }, false);
    state.userId = crypto.randomUUID();
    expect((await gameRoute(request(), context(game.id))).status).toBe(402);
    expect((await prepareGameRoute(request({}), context(game.id))).status).toBe(402);
    expect((await submitGameRoute(request({ roundNumber: 1, answer: "convergence" }), context(game.id))).status).toBe(402);
    expect(state.chooseWord).not.toHaveBeenCalled();
    state.plus = true;
    expect((await prepareGameRoute(request({}), context(game.id))).status).toBe(200);
    expect((await submitGameRoute(request({ roundNumber: 1, answer: "convergence" }), context(game.id))).status).toBe(200);
    state.plus = false;
    expect((await gameRoute(request(), context(game.id))).status).toBe(200);
  });

  it("gates every Archive operation while allowing completed results", async () => {
    const date = "2026-09-30";
    expect((await startDailyRoute(request({ date }))).status).toBe(401);
    state.userId = crypto.randomUUID();
    expect((await startDailyRoute(request({ date }))).status).toBe(402);
    const run = await startDaily(playerId, date);
    expect((await dailyRoute(request(), context(run.id))).status).toBe(402);
    expect((await prepareDailyRoute(request({}), context(run.id))).status).toBe(402);
    expect((await submitDailyRoute(request({ round: 1, guess: 1, answer: "convergence" }), context(run.id))).status).toBe(402);
    expect(state.chooseWord).not.toHaveBeenCalled();
    state.plus = true;
    expect((await startDailyRoute(request({ date }))).status).toBe(200);
    expect((await dailyRoute(request(), context(run.id))).status).toBe(200);
    expect((await prepareDailyRoute(request({}), context(run.id))).status).toBe(200);
    expect((await submitDailyRoute(request({ round: 1, guess: 1, answer: "convergence" }), context(run.id))).status).toBe(200);
    for (let round = 2; round <= 5; round++) {
      await submitDaily({ playerId, id: run.id, round, guess: 1, answer: "convergence" });
    }
    state.plus = false;
    state.userId = null;
    expect((await dailyRoute(request(), context(run.id))).status).toBe(200);
    expect((await startDailyRoute(request({ date }))).status).toBe(200);
  });

  it("rejects foreign game IDs even for a paid account", async () => {
    const game = await startGame({ playerId: crypto.randomUUID(), mode: "unlimited" }, false);
    state.userId = crypto.randomUUID();
    state.plus = true;
    expect((await gameRoute(request(), context(game.id))).status).toBe(404);
  });

  it("keeps the deployed game working until Plus is enabled", async () => {
    state.enabled = false;
    expect((await startGameRoute(request({ mode: "unlimited" }))).status).toBe(200);
    expect((await startDailyRoute(request({ date: "2026-09-30" }))).status).toBe(200);
  });

  it("resolves the authenticated account independently of a spoofed player header", async () => {
    state.userId = crypto.randomUUID();
    expect(await getPlayerId(request(undefined, crypto.randomUUID()))).toBe(playerId);
    state.userId = null;
    state.claimed = true;
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    await expect(getPlayerId(request())).rejects.toMatchObject({ code: "auth_required" });
    expect(await (await accountRoute(request())).json()).toMatchObject({ restore: true, email: null, playerId: null });
  });

  it("keeps completed legacy results readable without Plus", async () => {
    const game = await startGame({ playerId, mode: "unlimited" });
    await submitAnswer({ playerId, gameId: game.id, roundNumber: 1, answer: "convergence" });
    expect((await gameRoute(request(), context(game.id))).status).toBe(200);
  });
});
