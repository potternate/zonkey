import type { GameView } from "./types";

const MISS = "⬜";
const HIT = "🟩";

export function buildShareText(game: GameView, url?: string): string {
  const title =
    game.mode === "daily" && game.puzzleNumber !== null
      ? `Zonkey #${game.puzzleNumber}`
      : game.mode === "unlimited" ? "Zonkey · Unlimited" : "Zonkey · Practice";
  const score = `${game.status === "won" ? game.rounds.length : "X"}/${game.maxRounds}`;
  const guesses = game.rounds.map((round) => (round.matched ? HIT : MISS).repeat(2)).join(" ");
  const lines = [title, score, "", guesses];
  if (url) lines.push(url);
  return lines.join("\n");
}
