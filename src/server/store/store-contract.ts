import { describe, expect, it } from "vitest";
import type { GameStore } from "./types";
import { DuplicateDailyGameError } from "./types";

/** Behaviour every GameStore implementation must satisfy. */
export function describeStoreContract(name: string, makeStore: () => GameStore) {
  describe(`${name} store contract`, () => {
    const newPlayer = () => crypto.randomUUID();

    async function startGame(store: GameStore, playerId = newPlayer()) {
      const game = await store.createGame({
        playerId,
        mode: "practice",
        puzzleDate: null,
        puzzleNumber: null,
        wordA: "pizza",
        wordB: "ocean",
      });
      return { game, playerId };
    }

    async function prepare(store: GameStore, gameId: string, ai: string) {
      const rounds = await store.getRounds(gameId);
      const current = rounds[rounds.length - 1];
      return store.setAiAnswer(current.id, ai);
    }

    it("creates a game with round 1", async () => {
      const store = makeStore();
      const { game } = await startGame(store);
      expect(game.status).toBe("active");
      expect(game.roundNumber).toBe(1);
      const rounds = await store.getRounds(game.id);
      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toMatchObject({ roundNumber: 1, wordA: "pizza", wordB: "ocean", aiAnswer: null });
    });

    it("allows only one daily game per player and date", async () => {
      const store = makeStore();
      const input = {
        playerId: newPlayer(),
        mode: "daily" as const,
        puzzleDate: "2026-10-01",
        puzzleNumber: 1,
        wordA: "pizza",
        wordB: "ocean",
      };
      const game = await store.createGame(input);
      await expect(store.createGame(input)).rejects.toBeInstanceOf(DuplicateDailyGameError);
      expect((await store.findDailyGame(input.playerId, "2026-10-01"))?.id).toBe(game.id);
    });

    it("keeps the first AI answer", async () => {
      const store = makeStore();
      const { game } = await startGame(store);
      expect(await prepare(store, game.id, "beach")).toBe("beach");
      expect(await prepare(store, game.id, "sand")).toBe("beach");
    });

    it("rejects submissions before the AI has answered", async () => {
      const store = makeStore();
      const { game, playerId } = await startGame(store);
      const result = await store.submitAnswer({ gameId: game.id, playerId, roundNumber: 1, answer: "beach", maxRounds: 8 });
      expect(result).toEqual({ ok: false, code: "ai_not_ready" });
    });

    it("advances on a miss, rejects duplicates, and wins on a match", async () => {
      const store = makeStore();
      const { game, playerId } = await startGame(store);
      await prepare(store, game.id, "boat");
      const submit = (roundNumber: number, answer: string) =>
        store.submitAnswer({ gameId: game.id, playerId, roundNumber, answer, maxRounds: 8 });

      expect(await submit(1, "beach")).toEqual({ ok: true, matched: false, status: "active", aiAnswer: "boat" });
      expect(await submit(1, "beach")).toEqual({ ok: false, code: "wrong_round" });
      expect(await submit(2, "water")).toEqual({ ok: false, code: "ai_not_ready" });

      const rounds = await store.getRounds(game.id);
      expect(rounds[1]).toMatchObject({ roundNumber: 2, wordA: "beach", wordB: "boat" });

      await prepare(store, game.id, "water");
      expect(await submit(2, "water")).toEqual({ ok: true, matched: true, status: "won", aiAnswer: "water" });
      const finished = await store.getGame(game.id);
      expect(finished).toMatchObject({ status: "won", finalRounds: 2 });
      expect(finished?.completedAt).not.toBeNull();
      expect(await submit(3, "x")).toEqual({ ok: false, code: "not_active" });
    });

    it("rejects other players", async () => {
      const store = makeStore();
      const { game } = await startGame(store);
      await prepare(store, game.id, "boat");
      const result = await store.submitAnswer({ gameId: game.id, playerId: newPlayer(), roundNumber: 1, answer: "beach", maxRounds: 8 });
      expect(result).toEqual({ ok: false, code: "forbidden" });
    });

    it("loses after max rounds", async () => {
      const store = makeStore();
      const { game, playerId } = await startGame(store);
      for (let n = 1; n <= 3; n++) {
        await prepare(store, game.id, `ai${n}`);
        const result = await store.submitAnswer({ gameId: game.id, playerId, roundNumber: n, answer: `me${n}`, maxRounds: 3 });
        expect(result).toMatchObject({ ok: true, status: n === 3 ? "lost" : "active" });
      }
      expect(await store.getGame(game.id)).toMatchObject({ status: "lost", finalRounds: 3 });
    });

    it("records events", async () => {
      const store = makeStore();
      const { game, playerId } = await startGame(store);
      await expect(store.insertEvent({ name: "game_started", playerId, gameId: game.id, properties: { mode: "practice" } })).resolves.toBeUndefined();
    });

    it("enforces per-player AI quotas", async () => {
      const store = makeStore();
      const playerId = newPlayer();
      expect(await store.consumeAiQuota(playerId, 2, 5_000)).toBe(true);
      expect(await store.consumeAiQuota(playerId, 2, 5_000)).toBe(true);
      expect(await store.consumeAiQuota(playerId, 2, 5_000)).toBe(false);
    });
  });
}
