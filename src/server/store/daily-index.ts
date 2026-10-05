import "server-only";
import { toIsoDate } from "@/lib/game/daily";
import { getStore } from "./index";
import { DailyMemoryStore } from "./daily-memory-store";
import { DailySupabaseStore } from "./daily-supabase-store";
import type { DailyStore } from "./daily-types";

const globalStore = globalThis as typeof globalThis & { __zonkeyDailyStore?: DailyStore };

export function getDailyStore(): DailyStore {
  if (globalStore.__zonkeyDailyStore) return globalStore.__zonkeyDailyStore;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    globalStore.__zonkeyDailyStore = new DailySupabaseStore(url, key);
  } else if (process.env.NODE_ENV !== "production") {
    globalStore.__zonkeyDailyStore = new DailyMemoryStore(async (playerId) => {
      const store = getStore();
      const scores = await store.getPlayerScores(playerId, toIsoDate(new Date()));
      const games = await Promise.all(scores.savedDailies.map((entry) => store.getGame(entry.id)));
      return games.filter((game) =>
        game?.mode === "daily" && game.completedAt?.slice(0, 10) === game.puzzleDate,
      ).map((game) => game!.puzzleDate!);
    });
  } else {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production");
  }
  return globalStore.__zonkeyDailyStore;
}
