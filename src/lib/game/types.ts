import type { FirstGuessBoard } from "./first-guesses";
import type { UnlimitedTheme } from "./themes";

export type GameMode = "daily" | "unlimited" | "practice";

export type GameStatus = "active" | "won" | "lost";

export interface StartingPair {
  a: string;
  b: string;
  emojiA: string;
  emojiB: string;
}

/** A completed (revealed) round. Safe to send to the client. */
export interface RoundView {
  number: number;
  wordA: string;
  wordB: string;
  playerAnswer: string;
  aiAnswer: string;
  matched: boolean;
}

/** The round the player is currently answering. Never includes the AI answer. */
export interface CurrentRoundView {
  number: number;
  wordA: string;
  wordB: string;
  /** True once the server has locked in the AI's answer for this round. */
  ready: boolean;
}

export interface GameView {
  theme?: UnlimitedTheme;
  id: string;
  mode: GameMode;
  puzzleNumber: number | null;
  status: GameStatus;
  maxRounds: number;
  startPair: StartingPair;
  rounds: RoundView[];
  current: CurrentRoundView | null;
  firstGuesses?: FirstGuessBoard;
}

export interface Reveal {
  roundNumber: number;
  playerAnswer: string;
  aiAnswer: string;
  matched: boolean;
}
