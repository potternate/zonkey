import type { GameRecord } from "./view";

export interface FirstGuessBoard {
  attempts: number;
  guesses: { word: string; count: number }[];
}

export function firstGuessBoardKey(game: GameRecord): string {
  return game.mode === "daily"
    ? `daily:${game.puzzleDate}`
    : `unlimited:${game.startWordA}|${game.startWordB}`;
}
