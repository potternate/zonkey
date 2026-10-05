import type { GameMode, GameView, Reveal } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import type { DailyResults } from "@/lib/game/daily-results";
import { getPlayerId } from "./player-id";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json", "x-player-id": getPlayerId() },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Network error. Check your connection.", "network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong.", data.code ?? "internal", res.status);
  return data;
}

export const api = {
  getScores: () => request<{ scores: PlayerScores }>("/api/scores"),
  startGame: (mode: GameMode, puzzleDate?: string) =>
    request<{ game: GameView }>("/api/games", { method: "POST", body: { mode, puzzleDate } }),
  getGame: (id: string) => request<{ game: GameView }>(`/api/games/${id}`),
  getDailyResults: (id: string) => request<{ results: DailyResults }>(`/api/games/${id}/daily-results`),
  prepare: (id: string) => request<{ game: GameView }>(`/api/games/${id}/prepare`, { method: "POST" }),
  submit: (id: string, roundNumber: number, answer: string) =>
    request<{ game: GameView; reveal: Reveal }>(`/api/games/${id}/submit`, {
      method: "POST",
      body: { roundNumber, answer },
    }),
  trackShare: (gameId: string) =>
    request<{ ok: true }>("/api/events", { method: "POST", body: { name: "share_clicked", gameId } }).catch(() => undefined),
};
