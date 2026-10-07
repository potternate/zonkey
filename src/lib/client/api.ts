import type { GameMode, GameView, Reveal } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import type { DailyResults } from "@/lib/game/daily-results";
import type { DailyRunView, DailyScoreResults } from "@/lib/game/daily-run";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import { getPlayerId } from "./player-id";

export interface Account {
  enabled: boolean;
  email: string | null;
  plus: boolean;
  playerId: string | null;
  restore: boolean;
}

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
  if (!res.ok) {
    if ((data.code === "plus_required" || data.code === "auth_required") &&
      !path.startsWith("/api/account") && !path.startsWith("/api/checkout") && typeof window !== "undefined") {
      window.location.assign(`/plus?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new ApiError(data.error ?? "Something went wrong.", data.code ?? "internal", res.status);
  }
  return data;
}

export const api = {
  account: () => request<Account>("/api/account"),
  signIn: (email: string) => request<{ ok: true }>("/api/account/sign-in", { method: "POST", body: { email } }),
  verify: (email: string, token: string) =>
    request<{ playerId: string }>("/api/account/verify", { method: "POST", body: { email, token } }),
  signOut: () => request<{ ok: true }>("/api/account/sign-out", { method: "POST" }),
  checkout: () => request<{ url: string }>("/api/checkout", { method: "POST" }),
  confirmCheckout: (sessionId: string) =>
    request<{ plus: boolean }>("/api/checkout/confirm", { method: "POST", body: { sessionId } }),
  startDaily: (date?: string) => request<{ run: DailyRunView }>("/api/daily", { method: "POST", body: { date } }),
  getDaily: (id: string) => request<{ run: DailyRunView }>(`/api/daily/${id}`),
  prepareDaily: (id: string) => request<{ run: DailyRunView }>(`/api/daily/${id}/prepare`, { method: "POST" }),
  submitDaily: (id: string, round: number, guess: number, answer: string) =>
    request<{ run: DailyRunView; reveal: Reveal; firstGuesses?: FirstGuessBoard }>(`/api/daily/${id}/submit`, {
      method: "POST", body: { round, guess, answer },
    }),
  dailyResults: (id: string) => request<{ results: DailyScoreResults }>(`/api/daily/${id}/results`),
  shareDaily: (id: string) => request<{ ok: true }>(`/api/daily/${id}/share`, { method: "POST" }).catch(() => undefined),
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
