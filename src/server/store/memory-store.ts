import { resolveSubmission } from "@/lib/game/engine";
import { MAX_ROUNDS } from "@/lib/game/config";
import type { DailyResults } from "@/lib/game/daily-results";
import { playerScores, type PlayerScores } from "@/lib/game/scores";
import { firstGuessBoardKey, type FirstGuessBoard } from "@/lib/game/first-guesses";
import type { GameRecord, RoundRecord } from "@/lib/game/view";
import {
  DuplicateDailyGameError,
  type AnalyticsEvent,
  type GameStore,
  type NewGameInput,
  type SubmitAnswerInput,
  type SubmitAnswerResult,
} from "./types";

/** In-process store for local development without Supabase. */
export class MemoryStore implements GameStore {
  private games = new Map<string, GameRecord>();
  private rounds = new Map<string, RoundRecord>();
  private firstGuesses = new Map<string, Map<string, number>>();
  private aiUsage = new Map<string, number>();
  readonly events: (AnalyticsEvent & { createdAt: string })[] = [];

  async createGame(input: NewGameInput): Promise<GameRecord> {
    if (input.mode === "daily" && input.puzzleDate) {
      for (const game of this.games.values()) {
        if (game.playerId === input.playerId && game.mode === "daily" && game.puzzleDate === input.puzzleDate) {
          throw new DuplicateDailyGameError();
        }
      }
    }
    const now = new Date().toISOString();
    const game: GameRecord = {
      id: crypto.randomUUID(),
      playerId: input.playerId,
      mode: input.mode,
      puzzleDate: input.puzzleDate,
      puzzleNumber: input.puzzleNumber,
      startWordA: input.wordA,
      startWordB: input.wordB,
      status: "active",
      roundNumber: 1,
      startedAt: now,
      completedAt: null,
      finalRounds: null,
    };
    this.games.set(game.id, game);
    this.addRound(game.id, 1, input.wordA, input.wordB);
    return { ...game };
  }

  async getGame(gameId: string): Promise<GameRecord | null> {
    const game = this.games.get(gameId);
    return game ? { ...game } : null;
  }

  async findDailyGame(playerId: string, puzzleDate: string): Promise<GameRecord | null> {
    for (const g of this.games.values()) {
      if (g.playerId === playerId && g.mode === "daily" && g.puzzleDate === puzzleDate) return { ...g };
    }
    return null;
  }

  async getRounds(gameId: string): Promise<RoundRecord[]> {
    return [...this.rounds.values()]
      .filter((r) => r.gameId === gameId)
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => ({ ...r }));
  }

  async getPlayerScores(playerId: string, dailyDate: string): Promise<PlayerScores> {
    return playerScores([...this.games.values()].filter((game) => game.playerId === playerId), dailyDate);
  }

  async getDailyResults(gameId: string, playerId: string): Promise<DailyResults | null> {
    const game = this.games.get(gameId);
    if (!game || game.playerId !== playerId || game.mode !== "daily" || game.status === "active" || !game.completedAt) return null;
    const ownRounds = game.finalRounds;
    if (ownRounds === null || ownRounds < 1 || ownRounds > MAX_ROUNDS) return null;
    const completed = [...this.games.values()].filter((other) =>
      other.mode === "daily" && other.puzzleDate === game.puzzleDate &&
      other.status !== "active" && other.completedAt !== null &&
      other.finalRounds !== null && other.finalRounds >= 1 && other.finalRounds <= MAX_ROUNDS,
    );
    const peers = completed.filter((other) => other.id !== gameId);
    const worse = game.status === "won" ? peers.filter((other) =>
      other.status === "lost" || (other.finalRounds !== null && other.finalRounds > ownRounds),
    ).length : 0;
    return {
      distribution: Array.from({ length: MAX_ROUNDS }, (_, index) => ({
        rounds: index + 1,
        count: completed.filter((other) => other.status === "won" && other.finalRounds === index + 1).length,
      })),
      failed: completed.filter((other) => other.status === "lost").length,
      totalPlayers: completed.length,
      betterThanPercent: peers.length ? Math.floor(worse * 100 / peers.length) : null,
    };
  }

  async getFirstGuesses(boardKey: string): Promise<FirstGuessBoard> {
    const guesses = [...(this.firstGuesses.get(boardKey) ?? new Map<string, number>())]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    return {
      attempts: guesses.reduce((sum, guess) => sum + guess.count, 0),
      guesses: guesses.slice(0, 200),
    };
  }

  async getFirstGuessWords(boardKey: string): Promise<string[]> {
    return [...(this.firstGuesses.get(boardKey) ?? new Map<string, number>()).keys()].sort();
  }

  async consumeAiQuota(playerId: string, playerLimit: number, globalLimit: number): Promise<boolean> {
    const window = new Date().toISOString().slice(0, 13);
    const playerKey = `${window}:player:${playerId}`;
    const globalKey = `${window}:global`;
    const playerCount = this.aiUsage.get(playerKey) ?? 0;
    const globalCount = this.aiUsage.get(globalKey) ?? 0;
    if (playerCount >= playerLimit || globalCount >= globalLimit) return false;
    this.aiUsage.set(playerKey, playerCount + 1);
    this.aiUsage.set(globalKey, globalCount + 1);
    return true;
  }

  async setAiAnswer(roundId: string, aiAnswer: string): Promise<string> {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Round ${roundId} not found`);
    if (round.aiAnswer === null) round.aiAnswer = aiAnswer;
    return round.aiAnswer;
  }

  async submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
    const game = this.games.get(input.gameId);
    if (!game) return { ok: false, code: "not_found" };
    if (game.playerId !== input.playerId) return { ok: false, code: "forbidden" };
    if (game.status !== "active") return { ok: false, code: "not_active" };
    if (game.roundNumber !== input.roundNumber) return { ok: false, code: "wrong_round" };
    const round = [...this.rounds.values()].find(
      (r) => r.gameId === game.id && r.roundNumber === input.roundNumber,
    );
    if (!round || round.aiAnswer === null) return { ok: false, code: "ai_not_ready" };
    if (round.playerAnswer !== null) return { ok: false, code: "already_submitted" };
    if (input.roundNumber === 1 && input.boardAttempts !== undefined) {
      const board = this.firstGuesses.get(firstGuessBoardKey(game));
      const attempts = [...(board?.values() ?? [])].reduce((sum, count) => sum + count, 0);
      if (attempts !== input.boardAttempts) return { ok: false, code: "board_changed" };
    }

    const outcome = resolveSubmission({
      roundNumber: input.roundNumber,
      playerAnswer: input.answer,
      exactAnswer: input.exactAnswer,
      aiAnswer: round.aiAnswer,
      maxRounds: input.maxRounds,
      semanticMatched: input.semanticMatched,
    });
    if (input.roundNumber === 1) {
      const key = firstGuessBoardKey(game);
      const board = this.firstGuesses.get(key) ?? new Map<string, number>();
      board.set(input.answer, (board.get(input.answer) ?? 0) + 1);
      this.firstGuesses.set(key, board);
    }
    round.playerAnswer = input.answer;
    round.matched = outcome.matched;
    if (outcome.nextRound) {
      game.roundNumber = outcome.nextRound.roundNumber;
      this.addRound(game.id, outcome.nextRound.roundNumber, outcome.nextRound.wordA, outcome.nextRound.wordB);
    } else {
      game.status = outcome.status;
      game.completedAt = new Date().toISOString();
      game.finalRounds = input.roundNumber;
    }
    return { ok: true, matched: outcome.matched, status: outcome.status, aiAnswer: round.aiAnswer };
  }

  async insertEvent(event: AnalyticsEvent): Promise<void> {
    this.events.push({ ...event, createdAt: new Date().toISOString() });
  }

  private addRound(gameId: string, roundNumber: number, wordA: string, wordB: string) {
    const round: RoundRecord = {
      id: crypto.randomUUID(),
      gameId,
      roundNumber,
      wordA,
      wordB,
      playerAnswer: null,
      aiAnswer: null,
      matched: null,
      createdAt: new Date().toISOString(),
    };
    this.rounds.set(round.id, round);
  }
}
