import { describe, expect, it } from "vitest";
import { MAX_ROUNDS } from "@/lib/game/config";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { GameStore, NewGameInput } from "./types";

const stores: { name: string; create: () => GameStore }[] = [{ name: "memory", create: () => new MemoryStore() }];
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (url && key) stores.push({ name: "supabase", create: () => new SupabaseStore(url, key) });

for (const factory of stores) {
  describe(`${factory.name} Daily results`, () => {
    function dailyInput(): NewGameInput {
      const date = new Date(Date.UTC(2400, 0, 1) + Math.floor(Math.random() * 1_000_000) * 86_400_000);
      return {
        playerId: crypto.randomUUID(), mode: "daily", puzzleDate: date.toISOString().slice(0, 10),
        puzzleNumber: 1, wordA: "pizza", wordB: "ocean",
      };
    }

    async function finish(store: GameStore, input: NewGameInput, rounds: number, won = true) {
      const game = await store.createGame(input);
      for (let n = 1; n <= rounds; n += 1) {
        const current = (await store.getRounds(game.id)).find((round) => round.roundNumber === n)!;
        await store.setAiAnswer(current.id, `ai${n}`);
        expect(await store.submitAnswer({
          gameId: game.id, playerId: input.playerId, roundNumber: n,
          answer: won && n === rounds ? `ai${n}` : `guess${n}`, maxRounds: MAX_ROUNDS,
        })).toMatchObject({ ok: true, status: n === rounds ? won ? "won" : "lost" : "active" });
      }
      return game;
    }

    it("counts completed outcomes for the same date, ranks ties equally, and never double-counts", async () => {
      const store = factory.create();
      const input = dailyInput();
      const own = await finish(store, input, 2);
      for (const rounds of [1, 2, 4, 8]) {
        await finish(store, { ...input, playerId: crypto.randomUUID() }, rounds);
      }
      await finish(store, { ...input, playerId: crypto.randomUUID() }, 8, false);
      await store.createGame({ ...input, playerId: crypto.randomUUID() });
      const tomorrow = new Date(`${input.puzzleDate}T00:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      await finish(store, { ...input, puzzleDate: tomorrow.toISOString().slice(0, 10) }, 1);
      await finish(store, { ...input, mode: "unlimited", puzzleDate: null }, 1);
      await finish(store, { ...input, mode: "practice", puzzleDate: null }, 1);
      expect(await store.submitAnswer({
        gameId: own.id, playerId: input.playerId, roundNumber: 2, answer: "ai2", maxRounds: MAX_ROUNDS,
      })).toMatchObject({ ok: false });
      const results = await store.getDailyResults(own.id, input.playerId);
      expect(results).toEqual({
        distribution: [1, 2, 0, 1, 0, 0, 0, 1].map((count, index) => ({ rounds: index + 1, count })),
        failed: 1, totalPlayers: 6, betterThanPercent: 60,
      });
      expect(JSON.stringify(results)).not.toMatch(/pizza|ocean|guess|playerId|aiAnswer/);
    });

    it("handles the first finisher, later completions, and an eighth-turn win ahead of a loss", async () => {
      const store = factory.create();
      const input = dailyInput();
      const own = await finish(store, input, 8);
      expect(await store.getDailyResults(own.id, input.playerId)).toMatchObject({
        totalPlayers: 1, failed: 0, betterThanPercent: null,
      });
      const otherInput = { ...input, playerId: crypto.randomUUID() };
      const lost = await finish(store, otherInput, 8, false);
      expect(await store.getDailyResults(own.id, input.playerId)).toMatchObject({
        totalPlayers: 2, failed: 1, betterThanPercent: 100,
      });
      expect(await store.getDailyResults(lost.id, otherInput.playerId)).toMatchObject({ betterThanPercent: 0 });
    });

    it("denies access before completion, for another player, and for non-Daily games", async () => {
      const store = factory.create();
      const input = dailyInput();
      const game = await store.createGame(input);
      expect(await store.getDailyResults(game.id, input.playerId)).toBeNull();
      const [round] = await store.getRounds(game.id);
      await store.setAiAnswer(round.id, "water");
      await store.submitAnswer({
        gameId: game.id, playerId: input.playerId, roundNumber: 1, answer: "beach", maxRounds: MAX_ROUNDS,
      });
      expect(await store.getDailyResults(game.id, input.playerId)).toBeNull();
      const finished = await finish(store, { ...input, playerId: crypto.randomUUID() }, 1);
      expect(await store.getDailyResults(finished.id, input.playerId)).toBeNull();
      const unlimited = await finish(store, { ...input, mode: "unlimited", puzzleDate: null }, 1);
      expect(await store.getDailyResults(unlimited.id, input.playerId)).toBeNull();
      expect(await store.getDailyResults(crypto.randomUUID(), input.playerId)).toBeNull();
    });
  });
}
