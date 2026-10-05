import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { DailyMemoryStore } from "./daily-memory-store";
import { DailySupabaseStore } from "./daily-supabase-store";
import { describeDailyContract } from "./daily-store-contract";
import { SupabaseStore } from "./supabase-store";
import { dailyPairsForPuzzle } from "@/lib/game/daily-run";
import { puzzleNumberForDate, toIsoDate } from "@/lib/game/daily";

describeDailyContract("memory", () => new DailyMemoryStore());

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
if (url && key) {
  describeDailyContract("supabase", () => new DailySupabaseStore(url, key));
  it("merges legacy on-time streak dates without changing old results or inventing new scores", async () => {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const oldStore = new SupabaseStore(url, key);
    const newStore = new DailySupabaseStore(url, key);
    const playerId = crypto.randomUUID();
    const today = toIsoDate(new Date());
    const yesterday = toIsoDate(new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000));
    const legacy = await oldStore.createGame({
      playerId, mode: "daily", puzzleDate: yesterday, puzzleNumber: puzzleNumberForDate(yesterday),
      wordA: "donkey", wordB: "zebra",
    });
    const fixture = await db.from("games").update({
      status: "won", final_rounds: 1, completed_at: `${yesterday}T12:00:00Z`,
    }).eq("id", legacy.id);
    expect(fixture.error).toBeNull();
    const number = puzzleNumberForDate(today);
    const { run } = await newStore.start(playerId, today, number, dailyPairsForPuzzle(number));
    for (let round = 1; round <= 5; round++) {
      let current = (await newStore.get(run.id))!;
      const answer = await newStore.cachedAnswer(current) ?? "water";
      await newStore.commitAnswer({ id: run.id, playerId, round, guess: 1 }, answer);
      current = (await newStore.get(run.id))!;
      const committed = current.rounds[round - 1].aiAnswer!;
      await newStore.submit({
        id: run.id, playerId, round, guess: 1, answer: committed, exactAnswer: committed,
        semanticMatched: false, boardAttempts: (await newStore.firstBoard(today, round)).attempts,
      });
    }
    const summary = await newStore.summary(playerId, today);
    expect(summary.history).toHaveLength(1);
    expect(summary.streak).toEqual({ current: 2, best: 2 });
    expect((await oldStore.getPlayerScores(playerId, today)).recent).toMatchObject([{ id: legacy.id, rounds: 1 }]);
  });
}

describe.skipIf(!url || !anonKey)("Daily database permissions", () => {
  it("denies browser roles access to private tables and state-changing RPCs", async () => {
    const db = createClient(url!, anonKey!, { auth: { persistSession: false } });
    for (const table of ["daily_runs", "daily_rounds", "daily_guesses", "daily_ai_answers", "daily_puzzles"]) {
      const { data, error } = await db.from(table).select("*");
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
    const { error } = await db.rpc("start_daily_run", {
      p_player_id: crypto.randomUUID(), p_date: "2026-09-30", p_number: 1, p_pairs: [],
    });
    expect(error?.code).toBe("42501");
    const denied = await db.rpc("daily_score_results", { p_id: crypto.randomUUID(), p_player_id: crypto.randomUUID() });
    expect(denied.error?.code).toBe("42501");
  });
});
