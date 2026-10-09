import { describe, expect, it } from "vitest";
import { presetOpeningWords } from "../opening-words";
import { puzzleNumberForDate, toIsoDate } from "@/lib/game/daily";
import { DailyConflictError, toDailyView } from "./daily-types";
import type { DailyRunRecord, DailyStore, DailySubmission } from "./daily-types";

export function describeDailyContract(name: string, makeStore: () => DailyStore) {
  describe(`${name} five-round Daily store`, () => {
    const today = toIsoDate(new Date());
    const number = puzzleNumberForDate(today);
    const player = () => crypto.randomUUID();
    const start = async (store: DailyStore, playerId = player(), date = today) =>
      (await store.start(playerId, date, puzzleNumberForDate(date), presetOpeningWords(5))).run;

    async function prepare(store: DailyStore, run: DailyRunRecord) {
      const round = run.rounds[run.currentRound - 1];
      const guess = round.guesses.length + 1;
      const answer = await store.cachedAnswer(run) ?? `connection${run.currentRound}${guess}`;
      await store.commitAnswer({ id: run.id, playerId: run.playerId, round: run.currentRound, guess }, answer);
      return (await store.get(run.id))!;
    }

    async function submit(store: DailyStore, run: DailyRunRecord, match: boolean, semanticMatched = false) {
      const current = run.rounds[run.currentRound - 1];
      const guess = current.guesses.length + 1;
      const answer = match ? current.aiAnswer! : `guess${run.id.slice(0, 8)}${run.currentRound}${guess}`;
      return store.submit({
        id: run.id, playerId: run.playerId, round: run.currentRound, guess,
        answer, exactAnswer: answer, semanticMatched,
        boardAttempts: guess === 1 ? (await store.firstBoard(run.date, run.currentRound)).attempts : null,
      });
    }

    async function finish(store: DailyStore, run: DailyRunRecord, targets: number[]) {
      for (let round = 1; round <= 5; round++) {
        const target = targets[round - 1];
        for (let guess = 1; guess <= (target || 5); guess++) {
          run = await prepare(store, (await store.get(run.id))!);
          await submit(store, run, target === guess);
        }
      }
      return (await store.get(run.id))!;
    }

    it("atomically starts one resumable five-round run per player/date", async () => {
      const store = makeStore();
      const playerId = player();
      const input = () => store.start(playerId, today, number, presetOpeningWords(5));
      const [a, b] = await Promise.all([input(), input()]);
      expect(a.run.id).toBe(b.run.id);
      expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
      expect(a.run.rounds).toHaveLength(5);
      expect(a.run.rounds.every((round) => round.guesses.length === 0)).toBe(true);
      expect(a.run.mode).toBe("daily");
    });

    it("commits the same hidden AI answer across players and never overwrites it", async () => {
      const store = makeStore();
      const a = await start(store);
      const b = await start(store);
      await Promise.all([a, b].map((run, index) => store.commitAnswer({
        id: run.id, playerId: run.playerId, round: 1, guess: 1,
      }, ["first", "second"][index])));
      const first = (await store.get(a.id))!;
      const second = (await store.get(b.id))!;
      expect(first.rounds[0].aiAnswer).toBe(second.rounds[0].aiAnswer);
      await store.commitAnswer({ id: a.id, playerId: a.playerId, round: 1, guess: 1 }, "third");
      expect((await store.get(a.id))!.rounds[0].aiAnswer).toBe(first.rounds[0].aiAnswer);
      expect(JSON.stringify(toDailyView(first))).not.toContain(`"aiAnswer"`);
    });

    it("rejects unprepared guesses and other players without consuming a guess", async () => {
      const store = makeStore();
      const run = await start(store);
      const input: DailySubmission = {
        id: run.id, playerId: run.playerId, round: 1, guess: 1,
        answer: "word", exactAnswer: "word", semanticMatched: false, boardAttempts: 0,
      };
      await expect(store.submit({ ...input, playerId: player() })).rejects.toMatchObject({ code: "not_found" });
      await expect(store.commitAnswer({ ...input, playerId: player() }, "water")).rejects.toMatchObject({ code: "not_found" });
      expect((await store.get(run.id))?.rounds[0].guesses).toHaveLength(0);
      await submit(store, run, false);
      const updated = (await store.get(run.id))!;
      await expect(store.submit({ ...input, guess: 2, boardAttempts: null })).rejects.toMatchObject({ code: "ai_not_ready" });
      expect(updated.rounds[0].guesses).toHaveLength(1);
    });

    it("converges on misses, accepts later synonyms, and starts a fresh pair after solving", async () => {
      const store = makeStore();
      let run = await prepare(store, await start(store));
      const initialAi = run.rounds[0].aiAnswer;
      const miss = await submit(store, run, false, true);
      expect(miss.matched).toBe(false);
      run = (await store.get(run.id))!;
      expect(run.rounds[0]).toMatchObject({ wordA: miss.playerAnswer, wordB: initialAi, aiAnswer: null });
      run = await prepare(store, run);
      expect((await submit(store, run, false, true)).matched).toBe(true);
      run = (await store.get(run.id))!;
      expect(run).toMatchObject({ currentRound: 2, status: "active", score: 800 });
      expect(run.rounds[1]).toMatchObject({ wordA: "", wordB: "", aiAnswer: run.openingWords[1] });
      expect(toDailyView(run).current).toMatchObject({ round: 2, opening: true, wordA: "", wordB: "", ready: true });
    });

    it("counts only one concurrent submission and one first-guess vote", async () => {
      const store = makeStore();
      const run = await prepare(store, await start(store));
      const before = (await store.firstBoard(run.date, 1)).attempts;
      const answer = run.rounds[0].aiAnswer!;
      const input: DailySubmission = {
        id: run.id, playerId: run.playerId, round: 1, guess: 1,
        answer, exactAnswer: answer, semanticMatched: false, boardAttempts: before,
      };
      const submissions = await Promise.allSettled([store.submit(input), store.submit(input), store.submit(input)]);
      expect(submissions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect((await store.firstBoard(run.date, 1)).attempts).toBe(before + 1);
      expect((await store.get(run.id))?.score).toBe(1000);
      expect((await store.get(run.id))?.rounds[0].guesses).toHaveLength(1);
    });

    it("does not consume a guess when the canonical first-guess board changes", async () => {
      const store = makeStore();
      const run = await prepare(store, await start(store));
      await expect(store.submit({
        id: run.id, playerId: run.playerId, round: 1, guess: 1, answer: "word", exactAnswer: "word",
        semanticMatched: false, boardAttempts: -1,
      })).rejects.toBeInstanceOf(DailyConflictError);
      expect((await store.get(run.id))?.rounds[0].guesses).toHaveLength(0);
    });

    it("tapers points per round and finishes only after all five", async () => {
      const store = makeStore();
      const run = await finish(store, await start(store), [1, 2, 3, 4, 5]);
      expect(run.score).toBe(3000);
      expect(run.rounds.map((round) => round.score)).toEqual([1000, 800, 600, 400, 200]);
      expect(run.status).toBe("completed");
      expect(run.completedAt).not.toBeNull();
      expect(toDailyView(run).current).toBeNull();
      await expect(submit(store, run, true)).rejects.toMatchObject({ code: "conflict" });
    });

    it("continues after five misses and completes with zero points when no rounds connect", async () => {
      const store = makeStore();
      const run = await finish(store, await start(store), [0, 0, 0, 0, 0]);
      expect(run).toMatchObject({ score: 0, status: "completed" });
      expect(run.rounds.every((round) => round.status === "lost" && round.guesses.length === 5)).toBe(true);
    });

    it("keeps results private until full completion and excludes archive runs", async () => {
      const store = makeStore();
      const active = await start(store);
      expect(await store.results(active.id, active.playerId)).toBeNull();
      const completed = await finish(store, await start(store), [1, 1, 1, 1, 1]);
      expect(await store.results(completed.id, player())).toBeNull();
      const results = (await store.results(completed.id, completed.playerId))!;
      expect(results.distribution.reduce((sum, row) => sum + row.count, 0)).toBe(results.totalPlayers);
      expect(results.distribution.find((row) => row.score === 5000)?.count).toBeGreaterThanOrEqual(1);
      const perfect = results.distribution.find((row) => row.score === 5000)!.count;
      expect(results.betterThanPercent).toBe(results.totalPlayers > 1 ?
        Math.floor((results.totalPlayers - perfect) * 100 / (results.totalPlayers - 1)) : null);
      const archive = await finish(store, await start(store, player(), "2026-09-30"), [1, 1, 1, 1, 1]);
      expect(archive.mode).toBe("archive");
      expect(await store.results(archive.id, archive.playerId)).toBeNull();
      expect(await store.results(completed.id, completed.playerId)).toEqual(results);
    });

    it("scopes saved runs to one player and counts only complete live Dailies in streaks", async () => {
      const store = makeStore();
      const playerId = player();
      const run = await finish(store, await start(store, playerId), [1, 1, 1, 1, 1]);
      await start(store, playerId, "2026-09-30");
      const summary = await store.summary(playerId, today);
      expect(summary.history).toHaveLength(2);
      expect(summary.history.find((entry) => entry.id === run.id)?.score).toBe(5000);
      expect(summary.streak.current).toBe(1);
      expect((await store.summary(player(), today)).history).toEqual([]);
    });

    it("starts distinct themed Unlimited games, resumes retries once, and completes five scored rounds", async () => {
      const store = makeStore();
      const playerId = player();
      const requestId = crypto.randomUUID();
      const words = presetOpeningWords(5, "animals");
      const [a, b] = await Promise.all([
        store.startUnlimited(playerId, words, "animals", requestId),
        store.startUnlimited(playerId, presetOpeningWords(5, "food"), "food", requestId),
      ]);
      expect(a.id).toBe(b.id);
      expect(a).toMatchObject({ mode: "unlimited", puzzleNumber: null });
      expect(a.theme).toBe(b.theme);
      expect(a.openingWords).toEqual(b.openingWords);
      expect(a.rounds).toHaveLength(5);
      const another = await store.startUnlimited(playerId, words, "animals");
      expect(another.id).not.toBe(a.id);
      const daily = await start(store, playerId);
      expect(daily.id).not.toBe(a.id);
      await expect(store.startUnlimited(player(), words, "animals", requestId)).rejects.toThrow();
      let run = a;
      for (let round = 1; round <= 5; round++) {
        for (let guess = 1; guess <= round; guess++) {
          run = await prepare(store, (await store.get(run.id))!);
          const answer = guess === round ? run.rounds[round - 1].aiAnswer! : "different";
          await store.submit({
            id: run.id, playerId, round, guess, answer, exactAnswer: answer, semanticMatched: false,
            boardAttempts: guess === 1 ? (await store.firstBoard("unlimited", round)).attempts : null,
          });
        }
      }
      run = (await store.get(a.id))!;
      expect(run).toMatchObject({ status: "completed", score: 3000 });
      expect(run.rounds.map((round) => round.score)).toEqual([1000, 800, 600, 400, 200]);
      expect((await store.summary(playerId, today)).history.find((entry) => entry.id === run.id)).toMatchObject({ mode: "unlimited", score: 3000 });
      expect(await store.results(run.id, playerId)).toBeNull();
    });
  });
}
