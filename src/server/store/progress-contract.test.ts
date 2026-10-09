import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { DailyMemoryStore } from "./daily-memory-store";
import { DailySupabaseStore } from "./daily-supabase-store";
import type { DailyStore } from "./daily-types";
import { dailyPairsForPuzzle } from "@/lib/game/daily-run";
import { puzzleNumberForDate, toIsoDate } from "@/lib/game/daily";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const stores: [string, () => DailyStore][] = [["memory", () => new DailyMemoryStore()]];
if (url && key) stores.push(["supabase", () => new DailySupabaseStore(url, key)]);

for (const [name, makeStore] of stores) {
  describe(`progress summaries: ${name}`, () => {
    it("counts only winning guesses and never exposes AI or player answers in the summary", async () => {
      const store = makeStore();
      const playerId = crypto.randomUUID();
      const today = toIsoDate(new Date());
      const number = puzzleNumberForDate(today);
      const { run } = await store.start(playerId, today, number, dailyPairsForPuzzle(number));
      for (let round = 1; round <= 5; round++) {
        for (let guess = 1; guess <= 5; guess++) {
          const current = (await store.get(run.id))!;
          const cached = await store.cachedAnswer(current);
          await store.commitAnswer({ id: run.id, playerId, round, guess }, cached ?? "connection");
          const updated = (await store.get(run.id))!;
          const answer = updated.rounds[round - 1].aiAnswer!;
          const win = round === 1 && guess === 2 || round === 2 && guess === 4;
          const board = guess === 1 ? await store.firstBoard(today, round) : null;
          await store.submit({
            id: run.id, playerId, round, guess, answer: win ? answer : "different",
            exactAnswer: win ? answer : "different", semanticMatched: false,
            boardAttempts: board?.attempts ?? null,
          });
          if (win) break;
        }
      }
      const summary = await store.summary(playerId, today);
      expect(summary.history[0]).toMatchObject({ status: "completed", solvedRounds: 2, solvedGuesses: 6, score: 1200 });
      expect(JSON.stringify(summary)).not.toContain("connection");
      expect(JSON.stringify(summary)).not.toContain("different");
      expect((await store.summary(crypto.randomUUID(), today)).history).toHaveLength(0);
    });
  });
}

describe.skipIf(!url || !anon)("themed game permissions", () => {
  it("denies browser roles the new creation RPC", async () => {
    const db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.rpc("create_themed_game", {
      p_player_id: crypto.randomUUID(), p_mode: "unlimited", p_puzzle_date: null, p_puzzle_number: null,
      p_word_a: "zebra", p_word_b: "donkey", p_theme: "animals",
    });
    expect(error?.code).toBe("42501");
  });
});
