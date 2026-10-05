import { describe, expect, it } from "vitest";
import { dateForPuzzleNumber } from "@/lib/game/daily";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { GameStore, NewGameInput } from "./types";

const stores: { name: string; create: () => GameStore }[] = [{ name: "memory", create: () => new MemoryStore() }];
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (url && key) stores.push({ name: "supabase", create: () => new SupabaseStore(url, key) });

for (const factory of stores) {
  describe(`${factory.name} archive calendar history`, () => {
    it("retains old results beyond recent scores and restricts history to its owner", async () => {
      const store = factory.create();
      const playerId = crypto.randomUUID();
      const ids: string[] = [];
      for (let number = 1; number <= 13; number++) {
        const game = await store.createGame({
          playerId, mode: "practice", puzzleDate: dateForPuzzleNumber(number),
          puzzleNumber: number, wordA: "donkey", wordB: "zebra",
        });
        ids.push(game.id);
        const [round] = await store.getRounds(game.id);
        await store.setAiAnswer(round.id, "zonkey");
        await store.submitAnswer({ gameId: game.id, playerId, roundNumber: 1, answer: "zonkey", maxRounds: 8 });
      }
      const scores = await store.getPlayerScores(playerId, "2026-10-31");
      expect(scores.recent).toHaveLength(10);
      expect(scores.savedDailies).toHaveLength(13);
      expect(scores.savedDailies.map((game) => game.id)).toEqual(ids.reverse());
      expect(scores.savedDailies.at(-1)).toMatchObject({ date: "2026-09-30", status: "won", rounds: 1 });
      expect(JSON.stringify(scores.savedDailies)).not.toContain("zonkey");
      expect((await store.getPlayerScores(crypto.randomUUID(), "2026-10-31")).savedDailies).toEqual([]);
    });

    it("shows original Daily results, resumable turns and losses without unrelated games", async () => {
      const store = factory.create();
      const playerId = crypto.randomUUID();
      const input: NewGameInput = {
        playerId, mode: "practice", puzzleDate: "2026-09-30", puzzleNumber: 1, wordA: "donkey", wordB: "zebra",
      };
      await store.createGame(input);
      const original = await store.createGame({ ...input, mode: "daily" });
      const [round] = await store.getRounds(original.id);
      await store.setAiAnswer(round.id, "zonkey");
      await store.submitAnswer({ gameId: original.id, playerId, roundNumber: 1, answer: "horse", maxRounds: 8 });
      const lost = await store.createGame({ ...input, puzzleDate: "2026-10-01", puzzleNumber: 2 });
      const [lostRound] = await store.getRounds(lost.id);
      await store.setAiAnswer(lostRound.id, "zonkey");
      await store.submitAnswer({ gameId: lost.id, playerId, roundNumber: 1, answer: "horse", maxRounds: 1 });
      await store.createGame({ ...input, mode: "unlimited", puzzleDate: null, puzzleNumber: null });
      await store.createGame({ ...input, puzzleDate: null, puzzleNumber: null });
      await store.createGame({ ...input, puzzleDate: "2026-11-01", puzzleNumber: 33 });
      const scores = await store.getPlayerScores(playerId, "2026-10-31");
      expect(scores.savedDailies).toEqual([
        { id: lost.id, date: "2026-10-01", puzzleNumber: 2, status: "lost", rounds: 1 },
        { id: original.id, date: "2026-09-30", puzzleNumber: 1, status: "active", rounds: 1 },
      ]);
    });
  });
}
