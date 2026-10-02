import type { GameMode, GameStatus } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import type { GameRecord, RoundRecord } from "@/lib/game/view";

export interface NewGameInput {
  playerId: string;
  mode: GameMode;
  puzzleDate: string | null;
  puzzleNumber: number | null;
  wordA: string;
  wordB: string;
}

export interface SubmitAnswerInput {
  gameId: string;
  playerId: string;
  roundNumber: number;
  answer: string;
  exactAnswer?: string;
  boardAttempts?: number;
  maxRounds: number;
  semanticMatched?: boolean;
}

export type SubmitAnswerResult =
  | { ok: true; matched: boolean; status: GameStatus; aiAnswer: string }
  | {
      ok: false;
      code: "not_found" | "forbidden" | "not_active" | "wrong_round" | "already_submitted" | "ai_not_ready" | "board_changed";
    };

export interface AnalyticsEvent {
  name: string;
  playerId: string | null;
  gameId: string | null;
  properties?: Record<string, unknown>;
}

export class DuplicateDailyGameError extends Error {
  constructor() {
    super("Player already has a daily game for this date");
  }
}

/**
 * Persistence boundary. All state transitions that must be atomic
 * (creating a game with its first round, submitting an answer) are single
 * calls so each backend can implement them transactionally.
 */
export interface GameStore {
  /** @throws DuplicateDailyGameError */
  createGame(input: NewGameInput): Promise<GameRecord>;
  getGame(gameId: string): Promise<GameRecord | null>;
  findDailyGame(playerId: string, puzzleDate: string): Promise<GameRecord | null>;
  getPlayerScores(playerId: string, dailyDate: string): Promise<PlayerScores>;
  getFirstGuesses(boardKey: string): Promise<FirstGuessBoard>;
  getFirstGuessWords(boardKey: string): Promise<string[]>;
  consumeAiQuota(playerId: string, playerLimit: number, globalLimit: number): Promise<boolean>;
  getRounds(gameId: string): Promise<RoundRecord[]>;
  /** Sets the AI answer only if none is stored yet. Returns the stored answer. */
  setAiAnswer(roundId: string, aiAnswer: string): Promise<string>;
  submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult>;
  insertEvent(event: AnalyticsEvent): Promise<void>;
}
