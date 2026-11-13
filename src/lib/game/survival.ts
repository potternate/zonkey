import type { DailyRunView } from "./daily-run";

export const SURVIVAL_LIVES = 3;

export interface SurvivalTally {
  total: number;
  /** Finished rounds, won or lost. */
  rounds: number;
  lost: number;
}

export const EMPTY_TALLY: SurvivalTally = { total: 0, rounds: 0, lost: 0 };

export function tallyRun(run: Pick<DailyRunView, "rounds" | "score">): SurvivalTally {
  const finished = run.rounds.filter((round) => round.status !== "active");
  return { total: run.score, rounds: finished.length, lost: finished.filter((round) => round.status === "lost").length };
}

export function addTally(a: SurvivalTally, b: SurvivalTally): SurvivalTally {
  return { total: a.total + b.total, rounds: a.rounds + b.rounds, lost: a.lost + b.lost };
}

export function livesLeft(tally: SurvivalTally): number {
  return Math.max(0, SURVIVAL_LIVES - tally.lost);
}

export function hearts(lives: number): string {
  return "♥".repeat(lives) + "♡".repeat(Math.max(0, SURVIVAL_LIVES - lives));
}
