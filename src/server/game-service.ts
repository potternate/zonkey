import "server-only";
import { MAX_ROUNDS } from "@/lib/game/config";
import { dailyPuzzle } from "@/lib/game/daily";
import { dailyArchiveEntry } from "@/lib/game/archive";
import type { DailyResults } from "@/lib/game/daily-results";
import { firstGuessBoardKey } from "@/lib/game/first-guesses";
import { validateAnswer } from "@/lib/game/normalize";
import { randomStartingPair } from "@/lib/game/pairs";
import type { GameMode, GameView, Reveal } from "@/lib/game/types";
import { toGameView, type GameRecord } from "@/lib/game/view";
import { AiUnavailableError, getAiPlayer, getAnswerJudge } from "./ai";
import type { AnswerReview } from "./ai/types";
import { pendingAnswer } from "./ai/pending-answer";
import { track } from "./analytics";
import { GameError } from "./errors";
import { getStore } from "./store";
import { DuplicateDailyGameError, type SubmitAnswerResult } from "./store/types";

export interface StartGameInput {
  playerId: string;
  mode: GameMode;
  puzzleDate?: string;
}

function positiveLimit(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function assertAiQuota(playerId: string): Promise<void> {
  const allowed = await getStore().consumeAiQuota(
    playerId,
    positiveLimit("AI_REQUESTS_PER_PLAYER_HOUR", 120),
    positiveLimit("AI_REQUESTS_GLOBAL_HOUR", 5_000),
  );
  if (!allowed) throw new GameError("rate_limited", "Too many AI requests. Try again later.");
}

async function loadView(game: GameRecord): Promise<GameView> {
  const rounds = await getStore().getRounds(game.id);
  const view = toGameView(game, rounds, MAX_ROUNDS);
  if (view.rounds.some((round) => round.number === 1)) {
    view.firstGuesses = await getStore().getFirstGuesses(firstGuessBoardKey(game));
  }
  return view;
}

async function loadOwnedGame(playerId: string, gameId: string): Promise<GameRecord> {
  const game = await getStore().getGame(gameId);
  if (!game || game.playerId !== playerId) throw new GameError("not_found", "Game not found.");
  return game;
}

async function createGame(input: StartGameInput): Promise<{ game: GameRecord; created: boolean }> {
  const store = getStore();
  if (input.puzzleDate !== undefined && input.mode !== "daily") {
    throw new GameError("bad_request", "Choose Daily to play a dated puzzle.");
  }
  if (input.mode !== "daily") {
    const pair = randomStartingPair();
    const game = await store.createGame({
      playerId: input.playerId,
      mode: input.mode,
      puzzleDate: null,
      puzzleNumber: null,
      wordA: pair.a,
      wordB: pair.b,
    });
    return { game, created: true };
  }

  const now = new Date();
  const today = dailyPuzzle(now);
  const puzzle = input.puzzleDate === undefined ? today : dailyArchiveEntry(input.puzzleDate, now);
  if (!puzzle) throw new GameError("bad_request", "That puzzle is not available.");
  const { date, number: puzzleNumber, pair } = puzzle;
  const mode = date === today.date ? "daily" : "practice";
  const original = await store.findDailyGame(input.playerId, date);
  const existing = original ?? (mode === "practice" ? await store.findDailyGame(input.playerId, date, mode) : null);
  if (existing) return { game: existing, created: false };

  try {
    const game = await store.createGame({
      playerId: input.playerId,
      mode,
      puzzleDate: date,
      puzzleNumber,
      wordA: pair.a,
      wordB: pair.b,
    });
    return { game, created: true };
  } catch (err) {
    if (!(err instanceof DuplicateDailyGameError)) throw err;
    const raced = await store.findDailyGame(input.playerId, date, mode);
    if (!raced) throw err;
    return { game: raced, created: false };
  }
}

/** Starts or resumes a puzzle, optionally preparing its first AI answer. */
export async function startGame(input: StartGameInput, prepare = true): Promise<GameView> {
  const { game, created } = await createGame(input);
  if (created) {
    void track({
      name: "game_started",
      playerId: input.playerId,
      gameId: game.id,
      properties: { mode: game.mode, puzzleNumber: game.puzzleNumber },
    });
  }
  if (!prepare) return loadView(game);
  try {
    return await prepareRound(input.playerId, game.id);
  } catch (err) {
    if (err instanceof GameError && err.code === "ai_unavailable") return loadView(game);
    throw err;
  }
}

export async function getGame(playerId: string, gameId: string): Promise<GameView> {
  return loadView(await loadOwnedGame(playerId, gameId));
}

export async function getDailyResults(playerId: string, gameId: string): Promise<DailyResults> {
  const game = await loadOwnedGame(playerId, gameId);
  if (game.mode !== "daily") throw new GameError("not_found", "Daily results are only available for Daily games.");
  if (game.status === "active") throw new GameError("conflict", "Finish your Daily to see everyone’s results.");
  const results = await getStore().getDailyResults(gameId, playerId);
  if (!results) throw new GameError("conflict", "Finish your Daily to see everyone’s results.");
  return results;
}

export async function trackShare(playerId: string, gameId: string): Promise<void> {
  await loadOwnedGame(playerId, gameId);
  await track({ name: "share_clicked", playerId, gameId });
}

/**
 * Ensures the AI has committed an answer for the current round. Idempotent:
 * safe to call repeatedly and concurrently; the first stored answer wins.
 */
export async function prepareRound(playerId: string, gameId: string): Promise<GameView> {
  const store = getStore();
  const game = await loadOwnedGame(playerId, gameId);
  if (game.status !== "active") return loadView(game);
  const rounds = await store.getRounds(game.id);
  const current = rounds.find((r) => r.roundNumber === game.roundNumber);
  if (!current) throw new GameError("internal", "Current round is missing.");
  if (current.aiAnswer === null) {
    const word = await pendingAnswer(`game:${current.id}`, async () => {
      await assertAiQuota(playerId);
      try {
        return await getAiPlayer().chooseWord({ wordA: current.wordA, wordB: current.wordB });
      } catch (err) {
        console.error("[zonkey] AI failed", err instanceof AiUnavailableError ? err.cause ?? err : err);
        throw new GameError("ai_unavailable", "The AI couldn't think of a word. Try again.");
      }
    });
    await store.setAiAnswer(current.id, word);
  }
  return getGame(playerId, gameId);
}

export interface SubmitInput {
  playerId: string;
  gameId: string;
  roundNumber: number;
  answer: string;
}

export interface SubmitResult {
  game: GameView;
  reveal: Reveal;
}

export async function submitAnswer(input: SubmitInput): Promise<SubmitResult> {
  const store = getStore();
  const game = await loadOwnedGame(input.playerId, input.gameId);
  if (game.status !== "active") throw new GameError("conflict", "This game is already over.");
  if (game.roundNumber !== input.roundNumber) throw new GameError("conflict", "That round is already done.");

  const rounds = await store.getRounds(game.id);
  let current = rounds.find((r) => r.roundNumber === game.roundNumber);
  if (!current) throw new GameError("internal", "Current round is missing.");

  const validation = validateAnswer(input.answer, [current.wordA, current.wordB]);
  if (!validation.ok) throw new GameError("invalid_answer", validation.error);

  if (current.aiAnswer === null) {
    await prepareRound(input.playerId, game.id);
    current = (await store.getRounds(game.id)).find((r) => r.roundNumber === input.roundNumber);
    if (!current?.aiAnswer) throw new GameError("ai_unavailable", "The AI couldn't think of a word. Try again.");
  }
  let playerAnswer = validation.word;
  let result: SubmitAnswerResult = { ok: false, code: "board_changed" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const boardKey = firstGuessBoardKey(game);
    const boardAttempts = input.roundNumber === 1 ? (await store.getFirstGuesses(boardKey)).attempts : undefined;
    const boardWords = input.roundNumber === 1 ? await store.getFirstGuessWords(boardKey) : [];
    let review: AnswerReview;
    await assertAiQuota(input.playerId);
    try {
      review = await getAnswerJudge().reviewAnswer({
        answer: validation.word,
        wordA: current.wordA,
        wordB: current.wordB,
        aiAnswer: current.aiAnswer,
        roundNumber: input.roundNumber,
        boardWords,
      });
    } catch (err) {
      console.error("[zonkey] guess review failed", err instanceof Error ? err.message : "Unknown error");
      throw new GameError("ai_unavailable", "Couldn't check your guess. Your turn is saved—try again.");
    }
    const corrected = validateAnswer(review.word, [current.wordA, current.wordB]);
    if (!corrected.ok) throw new GameError("invalid_answer", corrected.error);
    playerAnswer = corrected.word;
    result = await store.submitAnswer({
      gameId: game.id,
      playerId: input.playerId,
      roundNumber: input.roundNumber,
      answer: playerAnswer,
      exactAnswer: validation.word,
      boardAttempts,
      maxRounds: MAX_ROUNDS,
      semanticMatched: input.roundNumber > 1 && review.semanticMatch,
    });
    if (result.ok || result.code !== "board_changed") break;
  }
  if (!result.ok) {
    switch (result.code) {
      case "board_changed":
        throw new GameError("ai_unavailable", "The guess board is busy. Your turn is saved—try again.");
      case "not_found":
      case "forbidden":
        throw new GameError("not_found", "Game not found.");
      case "ai_not_ready":
        throw new GameError("ai_unavailable", "The AI hasn't picked its word yet. Try again.");
      default:
        throw new GameError("conflict", "That round is already done.");
    }
  }

  const base = { playerId: input.playerId, gameId: game.id };
  void track({ ...base, name: "answer_submitted", properties: { round: input.roundNumber } });
  void track({ ...base, name: "round_completed", properties: { round: input.roundNumber, matched: result.matched } });
  if (result.status === "won") void track({ ...base, name: "game_won", properties: { rounds: input.roundNumber } });
  if (result.status === "lost") void track({ ...base, name: "game_lost", properties: { rounds: input.roundNumber } });

  const updated = await store.getGame(game.id);
  if (!updated) throw new GameError("internal", "Game disappeared.");
  return {
    game: await loadView(updated),
    reveal: {
      roundNumber: input.roundNumber,
      playerAnswer,
      aiAnswer: result.aiAnswer,
      matched: result.matched,
    },
  };
}
