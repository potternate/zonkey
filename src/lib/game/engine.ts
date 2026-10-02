import type { GameStatus } from "./types";

export interface SubmissionInput {
  roundNumber: number;
  playerAnswer: string;
  exactAnswer?: string;
  aiAnswer: string;
  maxRounds: number;
  semanticMatched?: boolean;
}

export interface SubmissionOutcome {
  matched: boolean;
  status: GameStatus;
  /** Endpoints for the next round, when the game continues. */
  nextRound: { roundNumber: number; wordA: string; wordB: string } | null;
}

/**
 * Pure game rule. Mirrored by the `submit_answer` Postgres function, which
 * applies the same transition atomically in Supabase.
 */
export function resolveSubmission({
  roundNumber,
  playerAnswer,
  exactAnswer,
  aiAnswer,
  maxRounds,
  semanticMatched,
}: SubmissionInput): SubmissionOutcome {
  const matched = playerAnswer === aiAnswer || exactAnswer === aiAnswer || (roundNumber > 1 && semanticMatched === true);
  if (matched) return { matched, status: "won", nextRound: null };
  if (roundNumber >= maxRounds) return { matched, status: "lost", nextRound: null };
  return {
    matched,
    status: "active",
    nextRound: { roundNumber: roundNumber + 1, wordA: playerAnswer, wordB: aiAnswer },
  };
}
