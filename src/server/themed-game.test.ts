import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/games/route";
import { GameError } from "./errors";
import { MemoryStore } from "./store/memory-store";
import { DailyMemoryStore } from "./store/daily-memory-store";
import { DailySupabaseStore } from "./store/daily-supabase-store";
import type { DailyStore } from "./store/daily-types";
import { THEMED_PAIRS, UNLIMITED_THEMES } from "@/lib/game/themes";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ enabled: false, user: false, plus: false }));
let store: MemoryStore;
let dailyStore: DailyStore;
vi.mock("./store", () => ({ getStore: () => store }));
vi.mock("./store/daily-index", () => ({ getDailyStore: () => dailyStore }));
vi.mock("./auth", () => ({
  plusEnabled: () => state.enabled,
  currentUser: async () => state.user ? { id: "user" } : null,
  requireUser: async () => {
    if (!state.user) throw new GameError("auth_required", "Sign in.");
    return { id: "user" };
  },
}));
vi.mock("./account-store", () => ({
  hasPlusAccess: async () => state.plus,
  isAccountPlayer: async () => false,
  linkPlayerAccount: async (_user: string, player: string) => player,
}));

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const stores: [string, () => DailyStore][] = [["memory", () => new DailyMemoryStore()]];
if (url && key) stores.push(["supabase", () => new DailySupabaseStore(url, key)]);

for (const [name, makeStore] of stores) {
  describe(`themed games: ${name}`, () => {
    beforeEach(() => {
      store = new MemoryStore();
      dailyStore = makeStore();
      state.enabled = false;
      state.user = false;
      state.plus = false;
    });
    const playerId = crypto.randomUUID();
    function request(body: object) {
      return new Request("http://localhost/api/games", {
        method: "POST", headers: { "content-type": "application/json", "x-player-id": playerId },
        body: JSON.stringify(body),
      });
    }

    it.each(UNLIMITED_THEMES)("persists %s and its hidden preset word without waiting for AI", async (theme) => {
      const response = await POST(request({ mode: "unlimited", theme }));
      expect(response.status).toBe(200);
      const { run: game } = await response.json();
      expect(game.theme).toBe(theme);
      expect(game.rounds).toHaveLength(5);
      expect(game.current).toMatchObject({ opening: true, wordA: "", wordB: "", ready: true });
      const record = (await dailyStore.get(game.id))!;
      expect(record).toMatchObject({ theme });
      for (const word of record.openingWords) {
        expect(THEMED_PAIRS[theme].flatMap((pair) => [pair.a, pair.b])).toContain(word);
        expect(JSON.stringify(game)).not.toContain(JSON.stringify(word));
      }
      expect(JSON.stringify(game)).not.toContain("aiAnswer");
    });

    it("validates category names and prevents themes on dated or practice games", async () => {
      expect((await POST(request({ mode: "unlimited", theme: "unknown" }))).status).toBe(400);
      expect((await POST(request({ mode: "practice", theme: "animals" }))).status).toBe(400);
      expect((await POST(request({ mode: "daily", theme: "food" }))).status).toBe(400);
    });

    it("requires Plus for themed starts only while the flag is enabled", async () => {
      state.enabled = true;
      expect((await POST(request({ mode: "unlimited", theme: "animals" }))).status).toBe(401);
      state.user = true;
      expect((await POST(request({ mode: "unlimited", theme: "animals" }))).status).toBe(402);
      state.plus = true;
      expect((await POST(request({ mode: "unlimited", theme: "animals" }))).status).toBe(200);
    });
  });
}
