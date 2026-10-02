import type { GameMode, GameStatus } from "./types";
import type { GameRecord } from "./view";

export interface ModeScores {
  played: number;
  wins: number;
  winRate: number;
  bestRounds: number | null;
  averageRounds: number | null;
}

export interface ScoreEntry {
  id: string;
  mode: GameMode;
  puzzleNumber: number | null;
  status: "won" | "lost";
  rounds: number;
  completedAt: string;
}

export interface PlayerScores {
  dailyDate: string;
  dailyGame: { id: string; status: GameStatus } | null;
  daily: ModeScores;
  unlimited: ModeScores;
  recent: ScoreEntry[];
}

function modeScores(games: GameRecord[]): ModeScores {
  const wins = games.filter((game) => game.status === "won");
  const rounds = wins.map((game) => game.finalRounds ?? game.roundNumber);
  return {
    played: games.length,
    wins: wins.length,
    winRate: games.length ? Math.round((wins.length / games.length) * 100) : 0,
    bestRounds: rounds.length ? Math.min(...rounds) : null,
    averageRounds: rounds.length ? Math.round((rounds.reduce((sum, n) => sum + n, 0) / rounds.length) * 10) / 10 : null,
  };
}

export function playerScores(games: GameRecord[], dailyDate: string): PlayerScores {
  const completed = games.filter((game) => game.status !== "active" && game.completedAt !== null);
  const dailyGame = games.find((game) => game.mode === "daily" && game.puzzleDate === dailyDate);
  const recentGames = (["daily", "unlimited"] as const).flatMap((mode) =>
    completed
      .filter((game) => (game.mode === "daily" ? "daily" : "unlimited") === mode)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || b.id.localeCompare(a.id))
      .slice(0, 10),
  );
  const recent: ScoreEntry[] = recentGames
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || b.id.localeCompare(a.id))
    .map((game) => ({
      id: game.id,
      mode: game.mode,
      puzzleNumber: game.puzzleNumber,
      status: game.status === "won" ? "won" : "lost",
      rounds: game.finalRounds ?? game.roundNumber,
      completedAt: game.completedAt!,
    }));
  return {
    dailyDate,
    dailyGame: dailyGame ? { id: dailyGame.id, status: dailyGame.status } : null,
    daily: modeScores(completed.filter((game) => game.mode === "daily")),
    unlimited: modeScores(completed.filter((game) => game.mode !== "daily")),
    recent,
  };
}
