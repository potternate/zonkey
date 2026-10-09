import { pairForPuzzle } from "./daily";
import { STARTING_PAIRS } from "./pairs";
import type { DailyStreak } from "./scores";
import type { RoundView, StartingPair } from "./types";
import { CURATED_DAILY_FROM, curatedDailyExtras } from "./curated-pairs";

export const DAILY_ROUNDS = 5;
export const DAILY_GUESSES = 5;
export const DAILY_MAX_SCORE = 5_000;
export const DAILY_POINTS = [1_000, 800, 600, 400, 200] as const;

export function dailyPairsForPuzzle(number: number): StartingPair[] {
  if (number >= CURATED_DAILY_FROM) {
    const first = pairForPuzzle(number);
    return [first, ...curatedDailyExtras(number, first)];
  }
  return [
    pairForPuzzle(number),
    ...Array.from({ length: DAILY_ROUNDS - 1 }, (_, index) =>
      STARTING_PAIRS[((number - 2 + (index + 1) * 997) % STARTING_PAIRS.length + STARTING_PAIRS.length) % STARTING_PAIRS.length],
    ),
  ];
}

export function dailyRoundScore(guess: number, matched: boolean): number {
  return matched ? DAILY_POINTS[guess - 1] ?? 0 : 0;
}

export interface DailyRound {
  number: number;
  startPair: StartingPair | null;
  status: "active" | "won" | "lost";
  score: number;
  guesses: RoundView[];
}

export interface DailyRunView {
  id: string;
  date: string;
  puzzleNumber: number;
  mode: "daily" | "archive";
  playerFirst?: boolean;
  status: "active" | "completed";
  score: number;
  rounds: DailyRound[];
  current: {
    round: number;
    guess: number;
    wordA: string;
    wordB: string;
    opening?: boolean;
    ready: boolean;
  } | null;
}

export interface DailyScoreResults {
  distribution: { score: number; count: number }[];
  totalPlayers: number;
  betterThanPercent: number | null;
}

export interface DailyRunEntry {
  id: string;
  date: string;
  puzzleNumber: number;
  mode: "daily" | "archive";
  status: "active" | "completed";
  score: number;
  completedAt: string | null;
  solvedRounds?: number;
  solvedGuesses?: number;
}

export interface DailyRunSummary {
  history: DailyRunEntry[];
  streak: DailyStreak;
}

export function dailyScoreResults(scores: { id: string; score: number }[], yours: { id: string; score: number }): DailyScoreResults {
  const peers = scores.filter((run) => run.id !== yours.id);
  return {
    distribution: Array.from({ length: DAILY_MAX_SCORE / 200 + 1 }, (_, index) => ({
      score: index * 200,
      count: scores.filter((run) => run.score === index * 200).length,
    })),
    totalPlayers: scores.length,
    betterThanPercent: peers.length ? Math.floor(peers.filter((run) => run.score < yours.score).length * 100 / peers.length) : null,
  };
}

export function buildDailyShareText(run: DailyRunView, url?: string): string {
  const rows = run.rounds.map((round) =>
    Array.from({ length: DAILY_GUESSES }, (_, index) =>
      round.guesses[index] ? round.guesses[index].matched ? "🟩" : "⬜" : "➖",
    ).join(""),
  );
  return [
    `Zonkey ${run.mode === "archive" ? "Archive " : ""}#${run.puzzleNumber}`,
    `${run.score.toLocaleString("en-US")} / 5,000 🦓`,
    "",
    ...rows,
    ...(url ? [url] : []),
  ].join("\n");
}
