import { DAILY_GUESSES, DAILY_ROUNDS, dailyRoundScore, dailyScoreResults } from "@/lib/game/daily-run";
import type { DailyRunEntry, DailyRunSummary, DailyScoreResults } from "@/lib/game/daily-run";
import { toIsoDate } from "@/lib/game/daily";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import { streakForDates } from "@/lib/game/scores";
import type { RoundView, StartingPair } from "@/lib/game/types";
import { DailyConflictError, dailyBoardKey } from "./daily-types";
import type { DailyPosition, DailyRunRecord, DailyStore, DailySubmission } from "./daily-types";

export class DailyMemoryStore implements DailyStore {
  private runs = new Map<string, DailyRunRecord>();
  private puzzles = new Map<string, StartingPair[]>();
  private answers = new Map<string, string>();
  private boards = new Map<string, Map<string, number>>();

  constructor(private legacyDates: (playerId: string) => Promise<string[]> = async () => []) {}

  async start(playerId: string, date: string, number: number, pairs: StartingPair[]): Promise<{ run: DailyRunRecord; created: boolean }> {
    const existing = [...this.runs.values()].find((run) => run.playerId === playerId && run.date === date);
    if (existing) return { run: structuredClone(existing), created: false };
    if (pairs.length !== DAILY_ROUNDS) throw new Error("A Daily needs five pairs");
    const canonical = this.puzzles.get(date) ?? structuredClone(pairs);
    this.puzzles.set(date, canonical);
    const run: DailyRunRecord = {
      id: crypto.randomUUID(), playerId, date, puzzleNumber: number,
      mode: date === toIsoDate(new Date()) ? "daily" : "archive",
      status: "active", currentRound: 1, score: 0, completedAt: null, pairs: canonical,
      rounds: canonical.map((pair, index) => ({
        number: index + 1, wordA: pair.a, wordB: pair.b, aiAnswer: null, status: "active", score: 0, guesses: [],
      })),
    };
    this.runs.set(run.id, run);
    return { run: structuredClone(run), created: true };
  }

  async get(id: string): Promise<DailyRunRecord | null> {
    const run = this.runs.get(id);
    return run ? structuredClone(run) : null;
  }

  private position(input: DailyPosition) {
    const run = this.runs.get(input.id);
    if (!run || run.playerId !== input.playerId) throw new DailyConflictError("not_found");
    const round = run.rounds[run.currentRound - 1];
    if (run.status !== "active" || run.currentRound !== input.round || round.guesses.length + 1 !== input.guess) {
      throw new DailyConflictError("conflict");
    }
    return { run, round };
  }

  private answerKey(run: DailyRunRecord): string {
    const round = run.rounds[run.currentRound - 1];
    return JSON.stringify([run.date, run.currentRound, round.guesses.length + 1, round.wordA, round.wordB]);
  }

  async cachedAnswer(run: DailyRunRecord): Promise<string | null> {
    return this.answers.get(this.answerKey(run)) ?? null;
  }

  async cacheFirstAnswer(run: DailyRunRecord, round: number, answer: string): Promise<void> {
    const pair = run.pairs[round - 1];
    const key = JSON.stringify([run.date, round, 1, pair.a, pair.b]);
    if (!this.answers.has(key)) this.answers.set(key, answer);
  }

  async commitAnswer(position: DailyPosition, answer: string): Promise<void> {
    const { run, round } = this.position(position);
    const key = this.answerKey(run);
    const canonical = this.answers.get(key) ?? answer;
    this.answers.set(key, canonical);
    round.aiAnswer ??= canonical;
  }

  async submit(input: DailySubmission): Promise<RoundView> {
    const { run, round } = this.position(input);
    if (round.aiAnswer === null) throw new DailyConflictError("ai_not_ready");
    const boardKey = dailyBoardKey(run.date, input.round);
    const board = this.boards.get(boardKey) ?? new Map<string, number>();
    if (input.guess === 1 && input.boardAttempts !== [...board.values()].reduce((sum, count) => sum + count, 0)) {
      throw new DailyConflictError("board_changed");
    }
    const matched = input.answer === round.aiAnswer || input.exactAnswer === round.aiAnswer || (input.guess > 1 && input.semanticMatched);
    const guess: RoundView = {
      number: input.guess, wordA: round.wordA, wordB: round.wordB,
      playerAnswer: input.answer, aiAnswer: round.aiAnswer, matched,
    };
    round.guesses.push(guess);
    if (input.guess === 1) {
      board.set(input.answer, (board.get(input.answer) ?? 0) + 1);
      this.boards.set(boardKey, board);
    }
    if (matched || input.guess === DAILY_GUESSES) {
      round.status = matched ? "won" : "lost";
      round.score = dailyRoundScore(input.guess, matched);
      run.score += round.score;
      if (run.currentRound === DAILY_ROUNDS) {
        run.status = "completed";
        run.completedAt = new Date().toISOString();
      } else {
        run.currentRound += 1;
      }
    } else {
      round.wordA = input.answer;
      round.wordB = round.aiAnswer;
    }
    round.aiAnswer = null;
    return structuredClone(guess);
  }

  async firstWords(date: string, round: number): Promise<string[]> {
    return [...(this.boards.get(dailyBoardKey(date, round))?.keys() ?? [])].sort();
  }

  async firstBoard(date: string, round: number): Promise<FirstGuessBoard> {
    const guesses = [...(this.boards.get(dailyBoardKey(date, round))?.entries() ?? [])]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    return { attempts: guesses.reduce((sum, guess) => sum + guess.count, 0), guesses: guesses.slice(0, 20) };
  }

  async summary(playerId: string, today: string): Promise<DailyRunSummary> {
    const owned = [...this.runs.values()].filter((run) => run.playerId === playerId && run.date <= today);
    const history: DailyRunEntry[] = owned.sort((a, b) => b.date.localeCompare(a.date)).map((run) => ({
      id: run.id, date: run.date, puzzleNumber: run.puzzleNumber, mode: run.mode,
      status: run.status, score: run.score, completedAt: run.completedAt,
    }));
    const dates = owned.filter((run) => run.mode === "daily" && run.completedAt?.slice(0, 10) === run.date).map((run) => run.date);
    return { history, streak: streakForDates([...dates, ...await this.legacyDates(playerId)], today) };
  }

  async results(id: string, playerId: string): Promise<DailyScoreResults | null> {
    const run = this.runs.get(id);
    if (!run || run.playerId !== playerId || run.status !== "completed" || run.mode !== "daily") return null;
    const scores = [...this.runs.values()].filter((other) => other.date === run.date && other.status === "completed" && other.mode === "daily");
    return dailyScoreResults(scores, run);
  }
}
