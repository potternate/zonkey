export const PLAYER_FIRST_DAILY_FROM = 11;

export const OPEN_BOARD = ["", ""] as const;

export function playerFirstDaily(puzzleNumber: number): boolean {
  return puzzleNumber >= PLAYER_FIRST_DAILY_FROM;
}
