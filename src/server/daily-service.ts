import "server-only";
import { dailyArchiveEntry } from "@/lib/game/archive";
import { toIsoDate } from "@/lib/game/daily";
import { dailyPairsForPuzzle } from "@/lib/game/daily-run";
import type { DailyRunView, DailyScoreResults } from "@/lib/game/daily-run";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import { validateAnswer } from "@/lib/game/normalize";
import type { Reveal } from "@/lib/game/types";
import { getAiPlayer, getAnswerJudge } from "./ai";
import { pendingAnswer } from "./ai/pending-answer";
import { track } from "./analytics";
import { GameError } from "./errors";
import { assertAiQuota } from "./game-service";
import { getDailyStore } from "./store/daily-index";
import { DailyConflictError, toDailyView } from "./store/daily-types";
import type { DailyPosition, DailyRunRecord } from "./store/daily-types";

async function owned(playerId: string, id: string): Promise<DailyRunRecord> {
  const run = await getDailyStore().get(id);
  if (!run || run.playerId !== playerId) throw new GameError("not_found", "Daily not found.");
  return run;
}

function rethrow(err: unknown): never {
  if (err instanceof DailyConflictError) {
    if (err.code === "not_found") throw new GameError("not_found", "Daily not found.");
    if (err.code === "ai_not_ready") throw new GameError("ai_unavailable", "The AI hasn't picked its word yet. Try again.");
    if (err.code === "board_changed") throw new GameError("ai_unavailable", "The guess board is busy. No guess was used—try again.");
    throw new GameError("conflict", "That guess is already done. Your progress is saved.");
  }
  throw err;
}

export async function getDaily(playerId: string, id: string): Promise<DailyRunView> {
  return toDailyView(await owned(playerId, id));
}

export async function startDaily(playerId: string, date = toIsoDate(new Date())): Promise<DailyRunView> {
  const puzzle = dailyArchiveEntry(date);
  if (!puzzle) throw new GameError("bad_request", "That puzzle is not available.");
  const { run, created } = await getDailyStore().start(playerId, date, puzzle.number, dailyPairsForPuzzle(puzzle.number));
  if (created) void track({
    name: "daily_started", playerId, gameId: null,
    properties: { dailyRunId: run.id, mode: run.mode, puzzleNumber: run.puzzleNumber, format: 2 },
  });
  return toDailyView(run);
}

async function chooseDailyAnswer(run: DailyRunRecord, round: number, guess: number, wordA: string, wordB: string): Promise<string> {
  const key = JSON.stringify(["daily", run.date, round, guess, wordA, wordB]);
  return pendingAnswer(key, async () => {
    await assertAiQuota(run.playerId);
    let answer: string;
    try {
      answer = await getAiPlayer().chooseWord({ wordA, wordB });
    } catch {
      throw new GameError("ai_unavailable", "The AI couldn't think of a word. Try again.");
    }
    const validated = validateAnswer(answer, [wordA, wordB]);
    if (!validated.ok) throw new GameError("ai_unavailable", "The AI couldn't think of a new word. Try again.");
    return validated.word;
  });
}

export async function warmDailyOpenings(playerId: string, id: string): Promise<void> {
  const store = getDailyStore();
  const run = await owned(playerId, id);
  if (run.status !== "active") return;
  await Promise.allSettled(run.pairs.map(async (pair, index) => {
    const number = index + 1;
    if (number <= run.currentRound) return;
    const opening = { ...run, currentRound: number };
    if (await store.cachedAnswer(opening) !== null) return;
    const answer = await chooseDailyAnswer(run, number, 1, pair.a, pair.b);
    await store.cacheFirstAnswer(run, number, answer);
  }));
}

export async function prepareDaily(playerId: string, id: string): Promise<DailyRunView> {
  const store = getDailyStore();
  const run = await owned(playerId, id);
  if (run.status !== "active") return toDailyView(run);
  const round = run.rounds[run.currentRound - 1];
  if (round.aiAnswer !== null) return toDailyView(run);
  let answer = await store.cachedAnswer(run);
  if (answer === null) {
    answer = await chooseDailyAnswer(run, run.currentRound, round.guesses.length + 1, round.wordA, round.wordB);
  }
  const validated = validateAnswer(answer, [round.wordA, round.wordB]);
  if (!validated.ok) throw new GameError("ai_unavailable", "The AI couldn't think of a new word. Try again.");
  try {
    await store.commitAnswer({ id, playerId, round: run.currentRound, guess: round.guesses.length + 1 }, validated.word);
  } catch (err) {
    if (!(err instanceof DailyConflictError && err.code === "conflict")) rethrow(err);
  }
  return getDaily(playerId, id);
}

export async function submitDaily(input: DailyPosition & { answer: string }): Promise<{
  run: DailyRunView; reveal: Reveal; firstGuesses?: FirstGuessBoard;
}> {
  const store = getDailyStore();
  let run = await owned(input.playerId, input.id);
  let round = run.rounds[run.currentRound - 1];
  if (run.status !== "active" || run.currentRound !== input.round || round.guesses.length + 1 !== input.guess) {
    throw new GameError("conflict", "That guess is already done.");
  }
  const validation = validateAnswer(input.answer, [round.wordA, round.wordB]);
  if (!validation.ok) throw new GameError("invalid_answer", validation.error);
  if (round.aiAnswer === null) {
    await prepareDaily(input.playerId, input.id);
    run = await owned(input.playerId, input.id);
    round = run.rounds[run.currentRound - 1];
    if (run.status !== "active" || run.currentRound !== input.round || round.guesses.length + 1 !== input.guess) {
      throw new GameError("conflict", "That guess is already done.");
    }
    if (round.aiAnswer === null) throw new GameError("ai_unavailable", "The AI couldn't think of a word. Try again.");
  }
  for (let retry = 0; retry < 3; retry++) {
    const boardAttempts = input.guess === 1 ? (await store.firstBoard(run.date, input.round)).attempts : null;
    const boardWords = input.guess === 1 ? await store.firstWords(run.date, input.round) : [];
    await assertAiQuota(input.playerId);
    let review;
    try {
      review = await getAnswerJudge().reviewAnswer({
        answer: validation.word, wordA: round.wordA, wordB: round.wordB, aiAnswer: round.aiAnswer,
        roundNumber: input.guess, boardWords,
      });
    } catch {
      throw new GameError("ai_unavailable", "Couldn't check your guess. No guess was used—try again.");
    }
    const corrected = validateAnswer(review.word, [round.wordA, round.wordB]);
    if (!corrected.ok) throw new GameError("invalid_answer", corrected.error);
    try {
      const guess = await store.submit({
        ...input, answer: corrected.word, exactAnswer: validation.word,
        semanticMatched: input.guess > 1 && review.semanticMatch, boardAttempts,
      });
      const next = await getDaily(input.playerId, input.id);
      const properties = { dailyRunId: run.id, format: 2, round: input.round, guess: input.guess, matched: guess.matched };
      void track({ name: "daily_guess_submitted", playerId: input.playerId, gameId: null, properties });
      if (next.rounds[input.round - 1].status !== "active") void track({
        name: "daily_round_completed", playerId: input.playerId, gameId: null,
        properties: { ...properties, score: next.rounds[input.round - 1].score },
      });
      if (next.status === "completed") void track({
        name: "daily_completed", playerId: input.playerId, gameId: null,
        properties: { dailyRunId: run.id, format: 2, score: next.score, mode: next.mode },
      });
      return {
        run: next,
        reveal: { roundNumber: input.guess, playerAnswer: guess.playerAnswer, aiAnswer: guess.aiAnswer, matched: guess.matched },
        ...(input.guess === 1 ? { firstGuesses: await store.firstBoard(run.date, input.round) } : {}),
      };
    } catch (err) {
      if (err instanceof DailyConflictError && err.code === "board_changed" && retry < 2) continue;
      rethrow(err);
    }
  }
  throw new GameError("internal", "Could not save your guess.");
}

export async function dailyResults(playerId: string, id: string): Promise<DailyScoreResults> {
  const run = await owned(playerId, id);
  if (run.mode !== "daily") throw new GameError("not_found", "Daily results are only available for live Dailies.");
  if (run.status !== "completed") throw new GameError("conflict", "Finish all five rounds to see everyone’s results.");
  const results = await getDailyStore().results(id, playerId);
  if (!results) throw new GameError("conflict", "Finish all five rounds to see everyone’s results.");
  return results;
}

export async function shareDaily(playerId: string, id: string): Promise<void> {
  const run = await owned(playerId, id);
  if (run.status !== "completed") throw new GameError("conflict", "Finish your Daily first.");
  await track({ name: "share_clicked", playerId, gameId: null, properties: { dailyRunId: id, format: 2 } });
}
