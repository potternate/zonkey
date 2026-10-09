import { findStartingPair } from "./pairs";
import type { CurrentRoundView, GameMode, GameStatus, GameView, RoundView } from "./types";
import type { UnlimitedTheme } from "./themes";

export interface GameRecord {
  theme?: UnlimitedTheme;
  id: string;
  playerId: string;
  mode: GameMode;
  puzzleDate: string | null;
  puzzleNumber: number | null;
  startWordA: string;
  startWordB: string;
  status: GameStatus;
  roundNumber: number;
  startedAt: string;
  completedAt: string | null;
  finalRounds: number | null;
}

export interface RoundRecord {
  id: string;
  gameId: string;
  roundNumber: number;
  wordA: string;
  wordB: string;
  playerAnswer: string | null;
  aiAnswer: string | null;
  matched: boolean | null;
  createdAt: string;
}

/**
 * The only path from stored state to client-facing state. The AI answer is
 * exposed only for rounds the player has already answered.
 */
export function toGameView(game: GameRecord, rounds: RoundRecord[], maxRounds: number): GameView {
  const sorted = [...rounds].sort((x, y) => x.roundNumber - y.roundNumber);
  const completed: RoundView[] = [];
  let current: CurrentRoundView | null = null;
  for (const r of sorted) {
    if (r.playerAnswer !== null && r.aiAnswer !== null) {
      completed.push({
        number: r.roundNumber,
        wordA: r.wordA,
        wordB: r.wordB,
        playerAnswer: r.playerAnswer,
        aiAnswer: r.aiAnswer,
        matched: r.matched === true,
      });
    } else if (game.status === "active" && r.roundNumber === game.roundNumber) {
      current = { number: r.roundNumber, wordA: r.wordA, wordB: r.wordB, ready: r.aiAnswer !== null };
    }
  }
  return {
    ...(game.theme ? { theme: game.theme } : {}),
    id: game.id,
    mode: game.mode,
    puzzleNumber: game.puzzleNumber,
    status: game.status,
    maxRounds,
    startPair: findStartingPair(game.startWordA, game.startWordB),
    rounds: completed,
    current,
  };
}
