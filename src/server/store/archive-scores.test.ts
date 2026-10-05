import { describe, expect, it } from "vitest";
import { toIsoDate } from "@/lib/game/daily";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { GameStore, NewGameInput } from "./types";

const stores: { name: string; create: () => GameStore }[] = [{ name: "memory", create: () => new MemoryStore() }];
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (url && key) stores.push({ name: "supabase", create: () => new SupabaseStore(url, key) });

for (const factory of stores) {
  describe(`${factory.name} archive persistence`, () => {
    it("allows one archive attempt per date separately from the live Daily", async () => {
      const store = factory.create();
      const input: NewGameInput = {
        playerId: crypto.randomUUID(), mode: "practice", puzzleDate: "2026-10-01",
        puzzleNumber: 2, wordA: "pizza", wordB: "ocean",
      };
      const results = await Promise.allSettled([store.createGame(input), store.createGame(input)]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const archive = await store.findDailyGame(input.playerId, input.puzzleDate!, "practice");
      expect(archive).toMatchObject({ mode: "practice", puzzleNumber: 2 });
      const daily = await store.createGame({ ...input, mode: "daily" });
      expect((await store.findDailyGame(input.playerId, input.puzzleDate!))?.id).toBe(daily.id);
      expect(daily.id).not.toBe(archive?.id);
    });

    it("separates archive scores, preserves legacy practice scores, and counts on-time Daily completions", async () => {
      const store = factory.create();
      const today = toIsoDate(new Date());
      const playerId = crypto.randomUUID();
      const inputs: NewGameInput[] = [
        { playerId, mode: "daily", puzzleDate: today, puzzleNumber: 5, wordA: "donkey", wordB: "zebra" },
        { playerId, mode: "practice", puzzleDate: "2026-09-30", puzzleNumber: 1, wordA: "donkey", wordB: "zebra" },
        { playerId, mode: "practice", puzzleDate: null, puzzleNumber: null, wordA: "donkey", wordB: "zebra" },
      ];
      for (const input of inputs) {
        const game = await store.createGame(input);
        const [round] = await store.getRounds(game.id);
        await store.setAiAnswer(round.id, "zonkey");
        expect(await store.submitAnswer({
          gameId: game.id, playerId, roundNumber: 1, answer: "zonkey", maxRounds: 8,
        })).toMatchObject({ ok: true, status: "won" });
      }
      const scores = await store.getPlayerScores(playerId, today);
      expect(scores.daily.played).toBe(1);
      expect(scores.archive.played).toBe(1);
      expect(scores.unlimited.played).toBe(1);
      expect(scores.dailyStreak).toEqual({ current: 1, best: 1 });
      expect(scores.recent).toHaveLength(3);
      expect((await store.getPlayerScores(crypto.randomUUID(), today)).dailyStreak).toEqual({ current: 0, best: 0 });
      const tomorrow = toIsoDate(new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000));
      expect((await store.getPlayerScores(playerId, tomorrow)).dailyStreak.current).toBe(1);
      const later = toIsoDate(new Date(Date.parse(`${today}T00:00:00Z`) + 172_800_000));
      expect((await store.getPlayerScores(playerId, later)).dailyStreak).toEqual({ current: 0, best: 1 });
    });
  });
}
