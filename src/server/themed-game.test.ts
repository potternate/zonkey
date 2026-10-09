import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/games/route";
import { startGame } from "./game-service";
import { GameError } from "./errors";
import { MemoryStore } from "./store/memory-store";
import { SupabaseStore } from "./store/supabase-store";
import type { GameStore } from "./store/types";
import { THEMED_PAIRS, UNLIMITED_THEMES } from "@/lib/game/themes";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ enabled: false, user: false, plus: false }));
let store: GameStore;
vi.mock("./store", () => ({ getStore: () => store }));
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
const stores: [string, () => GameStore][] = [["memory", () => new MemoryStore()]];
if (url && key) stores.push(["supabase", () => new SupabaseStore(url, key)]);

for (const [name, makeStore] of stores) {
  describe(`themed games: ${name}`, () => {
    beforeEach(() => {
      store = makeStore();
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

    it.each(UNLIMITED_THEMES)("persists %s and its pair through reload without waiting for AI", async (theme) => {
      const response = await POST(request({ mode: "unlimited", theme }));
      expect(response.status).toBe(200);
      const { game } = await response.json();
      expect(game.theme).toBe(theme);
      expect(THEMED_PAIRS[theme]).toContainEqual(game.startPair);
      expect(game.current.ready).toBe(false);
      expect(await store.getGame(game.id)).toMatchObject({ theme });
      expect(JSON.stringify(game)).not.toContain("aiAnswer");
    });

    it("validates category names and prevents themes on dated or practice games", async () => {
      expect((await POST(request({ mode: "unlimited", theme: "unknown" }))).status).toBe(400);
      expect((await POST(request({ mode: "practice", theme: "animals" }))).status).toBe(400);
      await expect(startGame({ playerId, mode: "daily", theme: "food" }, false)).rejects.toMatchObject({ code: "bad_request" });
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
