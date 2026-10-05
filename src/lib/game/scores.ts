import type { GameMode, GameStatus } from "./types";
import type { GameRecord } from "./view";
import { toIsoDate } from "./daily";
import type { DailyRunSummary } from "./daily-run";

export interface DailyStreak {
  current: number;
  best: number;
}

export function dailyStreak(games: GameRecord[], dailyDate: string): DailyStreak {
  const dates = games.filter((game) =>
    game.mode === "daily" && game.status !== "active" && game.puzzleDate !== null &&
    game.completedAt !== null && toIsoDate(new Date(game.completedAt)) === game.puzzleDate &&
    game.puzzleDate <= dailyDate,
  ).map((game) => game.puzzleDate!);
  return streakForDates(dates, dailyDate);
}

export function streakForDates(completedDates: string[], dailyDate: string): DailyStreak {
  const dates = [...new Set(completedDates.filter((date) => date <= dailyDate))].sort();
  const dayMs = 86_400_000;
  let run = 0;
  let best = 0;
  let previous = 0;
  for (const date of dates) {
    const ms = Date.parse(`${date}T00:00:00Z`);
    run = ms - previous === dayMs ? run + 1 : 1;
    best = Math.max(best, run);
    previous = ms;
  }
  const today = Date.parse(`${dailyDate}T00:00:00Z`);
  return { current: dates.length && today - previous <= dayMs ? run : 0, best };
}

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

export interface SavedDailyEntry {
  id: string;
  date: string;
  puzzleNumber: number;
  status: GameStatus;
  rounds: number;
}

export function savedDailies(games: GameRecord[], dailyDate: string): SavedDailyEntry[] {
  const dated = games.filter((game) =>
    (game.mode === "daily" || game.mode === "practice") &&
    game.puzzleDate !== null && game.puzzleNumber !== null && game.puzzleDate <= dailyDate,
  ).sort((a, b) => Number(a.mode !== "daily") - Number(b.mode !== "daily") || b.id.localeCompare(a.id));
  const byDate = new Map<string, SavedDailyEntry>();
  for (const game of dated) {
    const { puzzleDate, puzzleNumber } = game;
    if (puzzleDate !== null && puzzleNumber !== null && !byDate.has(puzzleDate)) {
      byDate.set(puzzleDate, {
        id: game.id,
        date: puzzleDate,
        puzzleNumber,
        status: game.status,
        rounds: game.status === "active" ? game.roundNumber - 1 : game.finalRounds ?? game.roundNumber,
      });
    }
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export interface PlayerScores {
  dailyRuns?: DailyRunSummary;
  dailyDate: string;
  dailyGame: { id: string; status: GameStatus } | null;
  dailyStreak: DailyStreak;
  daily: ModeScores;
  unlimited: ModeScores;
  archive: ModeScores;
  savedDailies: SavedDailyEntry[];
  recent: ScoreEntry[];
}

export function scoreMode(game: { mode: GameMode; puzzleNumber: number | null }): "daily" | "unlimited" | "archive" {
  if (game.mode === "daily") return "daily";
  return game.mode === "practice" && game.puzzleNumber !== null ? "archive" : "unlimited";
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
  const recentGames = (["daily", "unlimited", "archive"] as const).flatMap((mode) =>
    completed
      .filter((game) => scoreMode(game) === mode)
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
    dailyStreak: dailyStreak(games, dailyDate),
    daily: modeScores(completed.filter((game) => game.mode === "daily")),
    unlimited: modeScores(completed.filter((game) => scoreMode(game) === "unlimited")),
    archive: modeScores(completed.filter((game) => scoreMode(game) === "archive")),
    savedDailies: savedDailies(games, dailyDate),
    recent,
  };
}
