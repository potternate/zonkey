import type { GameMode, GameView, Reveal } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import type { DailyResults } from "@/lib/game/daily-results";
import type { DailyRunView, DailyScoreResults } from "@/lib/game/daily-run";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import type { UnlimitedTheme } from "@/lib/game/themes";
import { getPlayerId, resetPlayerId } from "./player-id";

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

async function request<T>(path: string, init?: { method?: string; body?: unknown }, retryIdentity = true): Promise<T> {
  let res: Response;
  let data: T & { error?: string; code?: string };
  const playerId = getPlayerId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json", "x-player-id": playerId },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: controller.signal,
    });
    data = (await res.json().catch((error: unknown) => {
      if (controller.signal.aborted || res.ok) throw error;
      return {};
    })) as T & { error?: string; code?: string };
  } catch {
    throw new ApiError(controller.signal.aborted ? "The request took too long. Your guess is still here." : "Network error. Check your connection.",
      controller.signal.aborted ? "timeout" : "network", 0);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if ((data.code === "plus_required" || data.code === "auth_required") &&
      !path.startsWith("/api/account") && !path.startsWith("/api/checkout") && typeof window !== "undefined") {
      const account = await request<Account>("/api/account").catch(() => null);
      if (account?.enabled === false) {
        if (data.code === "auth_required" && retryIdentity) {
          if (getPlayerId() === playerId) resetPlayerId();
          return request<T>(path, init, false);
        }
      } else {
        window.location.assign(`/plus?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    }
    throw new ApiError(data.error ?? "Something went wrong.", data.code ?? "internal", res.status);
  }
  return data;
}

function retryable(error: unknown): error is ApiError {
  return error instanceof ApiError && (["ai_unavailable", "network", "timeout"].includes(error.code) ||
    [502, 504].includes(error.status));
}

async function recoverRequest<T>(send: () => Promise<T>, read?: () => Promise<T | null>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (read && (retryable(error) || error instanceof ApiError && error.code === "conflict")) {
        const saved = await read().catch(() => null);
        if (saved !== null) return saved;
      }
      if (attempt === 1 || !retryable(error)) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new ApiError("Couldn't complete the request. Try again.", "network", 0);
}

type DailySubmission = { run: DailyRunView; reveal: Reveal; firstGuesses?: FirstGuessBoard };

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
  startUnlimited: (theme?: UnlimitedTheme, requestId?: string) => request<{ run: DailyRunView }>("/api/daily", { method: "POST", body: { mode: "unlimited", theme, requestId } }),
  getDaily: (id: string) => request<{ run: DailyRunView }>(`/api/daily/${id}`),
  prepareDaily: (id: string) => recoverRequest(() => request<{ run: DailyRunView }>(`/api/daily/${id}/prepare`, { method: "POST" })),
  submitDaily: (id: string, round: number, guess: number, answer: string) =>
    recoverRequest<DailySubmission>(() => request<DailySubmission>(`/api/daily/${id}/submit`, {
      method: "POST", body: { round, guess, answer },
    }), async () => {
      const { run } = await request<{ run: DailyRunView }>(`/api/daily/${id}`);
      const saved = run.rounds[round - 1]?.guesses[guess - 1];
      return saved ? {
        run, reveal: { roundNumber: guess, playerAnswer: saved.playerAnswer, aiAnswer: saved.aiAnswer, matched: saved.matched },
      } : null;
    }),
  dailyResults: (id: string) => request<{ results: DailyScoreResults }>(`/api/daily/${id}/results`),
  shareDaily: (id: string) => request<{ ok: true }>(`/api/daily/${id}/share`, { method: "POST" }).catch(() => undefined),
  getScores: () => request<{ scores: PlayerScores }>("/api/scores"),
  startGame: (mode: GameMode, puzzleDate?: string, theme?: UnlimitedTheme) =>
    request<{ game: GameView }>("/api/games", { method: "POST", body: { mode, puzzleDate, theme } }),
  getGame: (id: string) => request<{ game: GameView }>(`/api/games/${id}`),
  getDailyResults: (id: string) => request<{ results: DailyResults }>(`/api/games/${id}/daily-results`),
  prepare: (id: string) => recoverRequest(() => request<{ game: GameView }>(`/api/games/${id}/prepare`, { method: "POST" })),
  submit: (id: string, roundNumber: number, answer: string) =>
    recoverRequest(() => request<{ game: GameView; reveal: Reveal }>(`/api/games/${id}/submit`, {
      method: "POST",
      body: { roundNumber, answer },
    }), async () => {
      const { game } = await request<{ game: GameView }>(`/api/games/${id}`);
      const saved = game.rounds.find((round) => round.number === roundNumber);
      return saved ? {
        game, reveal: { roundNumber, playerAnswer: saved.playerAnswer, aiAnswer: saved.aiAnswer, matched: saved.matched },
      } : null;
    }),
  trackShare: (gameId: string) =>
    request<{ ok: true }>("/api/events", { method: "POST", body: { name: "share_clicked", gameId } }).catch(() => undefined),
};
