import { describe, expect, it } from "vitest";
import { puzzleNumberForDate, toIsoDate } from "@/lib/game/daily";
import { presetOpeningWords } from "../opening-words";
import { DailyMemoryStore } from "./daily-memory-store";
import { DailySupabaseStore } from "./daily-supabase-store";
import { toDailyView } from "./daily-types";
import type { DailyStore } from "./daily-types";

function cacheContract(name: string, makeStore: () => DailyStore) {
  describe(`${name} opening answer cache`, () => {
    it("commits all five preset words at creation and never exposes a future answer early", async () => {
      const store = makeStore();
      const date = toIsoDate(new Date());
      const number = puzzleNumberForDate(date);
      const { run } = await store.start(crypto.randomUUID(), date, number, presetOpeningWords(5));
      const opening = { ...run, currentRound: 2 };
      const canonical = await store.cachedAnswer(opening);
      expect(canonical).toBe(run.openingWords[1]);
      const fresh = (await store.get(run.id))!;
      expect(fresh.rounds[1].aiAnswer).toBe(canonical);
      expect(toDailyView(fresh).rounds[1].guesses).toEqual([]);
      expect(toDailyView(fresh).rounds[1]).not.toHaveProperty("aiAnswer");
      const first = await store.cachedAnswer(run) ?? "bridge";
      await store.commitAnswer({ id: run.id, playerId: run.playerId, round: 1, guess: 1 }, first);
      await store.submit({
        id: run.id, playerId: run.playerId, round: 1, guess: 1, answer: first, exactAnswer: first,
        semanticMatched: false, boardAttempts: (await store.firstBoard(date, 1)).attempts,
      });
      const next = (await store.get(run.id))!;
      expect(await store.cachedAnswer(next)).toBe(canonical);
      await store.commitAnswer({ id: run.id, playerId: run.playerId, round: 2, guess: 1 }, "different");
      expect((await store.get(run.id))!.rounds[1].aiAnswer).toBe(canonical);
    });
  });
}

cacheContract("memory", () => new DailyMemoryStore());
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (url && key) cacheContract("supabase", () => new DailySupabaseStore(url, key));
