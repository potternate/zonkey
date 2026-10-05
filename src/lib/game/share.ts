import type { GameView } from "./types";
import { dateForPuzzleNumber } from "./daily";

const MISS = "⬜";
const HIT = "🟩";

export function buildShareText(game: GameView, url?: string): string {
  const title =
    game.mode === "daily" && game.puzzleNumber !== null
      ? `Zonkey #${game.puzzleNumber}`
      : game.mode === "practice" && game.puzzleNumber !== null
        ? `Zonkey · Archive #${game.puzzleNumber}`
        : game.mode === "unlimited" ? "Zonkey · Unlimited" : "Zonkey · Practice";
  const score =
    game.status === "won"
      ? `Connected in ${game.rounds.length}/${game.maxRounds} 🦓`
      : `No match in ${game.maxRounds}/${game.maxRounds} 🦓`;
  const guesses = game.rounds.map((round) => (round.matched ? HIT : MISS).repeat(2)).join(" ");
  const lines = [title, score, "", guesses];
  if (url) lines.push(url);
  return lines.join("\n");
}

export function gameShareUrl(game: GameView, origin: string): string {
  return (game.mode === "practice" || game.mode === "daily") && game.puzzleNumber !== null
    ? `${origin}/?daily=${dateForPuzzleNumber(game.puzzleNumber)}`
    : origin;
}
