import type { DailyRunEntry, DailyRunSummary, DailyRunView, DailyScoreResults } from "@/lib/game/daily-run";
import type { RoundView, StartingPair } from "@/lib/game/types";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";

export interface DailyRoundRecord {
  number: number;
  wordA: string;
  wordB: string;
  aiAnswer: string | null;
  status: "active" | "won" | "lost";
  score: number;
  guesses: RoundView[];
}

export interface DailyRunRecord extends DailyRunEntry {
  playerId: string;
  currentRound: number;
  pairs: StartingPair[];
  rounds: DailyRoundRecord[];
}

export interface DailyPosition {
  id: string;
  playerId: string;
  round: number;
  guess: number;
}

export interface DailySubmission extends DailyPosition {
  answer: string;
  exactAnswer: string;
  semanticMatched: boolean;
  boardAttempts: number | null;
}

export class DailyConflictError extends Error {
  constructor(readonly code: "not_found" | "conflict" | "ai_not_ready" | "board_changed") {
    super(code);
  }
}

export interface DailyStore {
  start(playerId: string, date: string, number: number, pairs: StartingPair[]): Promise<{ run: DailyRunRecord; created: boolean }>;
  get(id: string): Promise<DailyRunRecord | null>;
  cachedAnswer(run: DailyRunRecord): Promise<string | null>;
  cacheFirstAnswer(run: DailyRunRecord, round: number, answer: string): Promise<void>;
  commitAnswer(position: DailyPosition, answer: string): Promise<void>;
  submit(input: DailySubmission): Promise<RoundView>;
  firstBoard(date: string, round: number): Promise<FirstGuessBoard>;
  firstWords(date: string, round: number): Promise<string[]>;
  summary(playerId: string, today: string): Promise<DailyRunSummary>;
  results(id: string, playerId: string): Promise<DailyScoreResults | null>;
}

export function dailyBoardKey(date: string, round: number): string {
  return `daily-v2:${date}:${round}`;
}

export function toDailyView(run: DailyRunRecord): DailyRunView {
  const current = run.rounds.find((round) => round.number === run.currentRound);
  return {
    id: run.id,
    date: run.date,
    puzzleNumber: run.puzzleNumber,
    mode: run.mode,
    status: run.status,
    score: run.score,
    rounds: run.rounds.map((round) => ({
      number: round.number,
      startPair: run.pairs[round.number - 1],
      status: round.status,
      score: round.score,
      guesses: round.guesses,
    })),
    current: run.status === "active" && current ? {
      round: run.currentRound,
      guess: current.guesses.length + 1,
      wordA: current.wordA,
      wordB: current.wordB,
      ready: current.aiAnswer !== null,
    } : null,
  };
}
