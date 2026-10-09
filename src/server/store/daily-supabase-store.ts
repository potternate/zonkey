import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyRunSummary, DailyScoreResults } from "@/lib/game/daily-run";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import type { RoundView } from "@/lib/game/types";
import { DailyConflictError, dailyBoardKey } from "./daily-types";
import type { DailyPosition, DailyRoundRecord, DailyRunRecord, DailyStore, DailySubmission } from "./daily-types";
import type { UnlimitedTheme } from "@/lib/game/themes";

interface GuessRow {
  guess_number: number;
  word_a: string;
  word_b: string;
  player_answer: string;
  ai_answer: string;
  matched: boolean;
}

interface RunRow {
  id: string;
  player_id: string;
  puzzle_date: string | null;
  puzzle_number: number | null;
  started_at: string;
  opening_words: string[];
  theme: UnlimitedTheme | null;
  mode: "daily" | "archive" | "unlimited";
  status: "active" | "completed";
  current_round: number;
  score: number;
  completed_at: string | null;
  scored_rounds: {
    round_number: number;
    word_a: string;
    word_b: string;
    ai_answer: string | null;
    status: "active" | "won" | "lost";
    score: number;
    scored_guesses: GuessRow[];
  }[];
}

function toGuess(row: GuessRow): RoundView {
  return {
    number: row.guess_number, wordA: row.word_a, wordB: row.word_b,
    playerAnswer: row.player_answer, aiAnswer: row.ai_answer, matched: row.matched,
  };
}

function checkResult(code: string): void {
  if (code === "ok") return;
  if (code === "not_found" || code === "conflict" || code === "ai_not_ready" || code === "board_changed") {
    throw new DailyConflictError(code);
  }
  throw new Error(`Unexpected Daily result: ${code}`);
}

export class DailySupabaseStore implements DailyStore {
  private db: SupabaseClient;

  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async start(playerId: string, date: string, number: number, openingWords: string[]): Promise<{ run: DailyRunRecord; created: boolean }> {
    const { data, error } = await this.db.rpc("start_scored_run", {
      p_player_id: playerId, p_date: date, p_number: number,
      p_opening_words: openingWords,
    }).single<{ id: string; created: boolean }>();
    if (error) throw new Error(`start_scored_run failed: ${error.message}`);
    const run = await this.get(data.id);
    if (!run) throw new Error("Daily run disappeared");
    return { run, created: data.created };
  }

  async startUnlimited(playerId: string, openingWords: string[], theme?: UnlimitedTheme, requestId?: string): Promise<DailyRunRecord> {
    const { data, error } = await this.db.rpc("start_scored_run", {
      p_player_id: playerId, p_date: null, p_number: null, p_opening_words: openingWords, p_theme: theme ?? null, p_request_id: requestId ?? null,
    }).single<{ id: string }>();
    if (error) throw new Error(`start_scored_run failed: ${error.message}`);
    const run = await this.get(data.id);
    if (!run) throw new Error("Game disappeared");
    return run;
  }

  async get(id: string): Promise<DailyRunRecord | null> {
    const { data, error } = await this.db.from("scored_runs")
      .select("*, scored_rounds(*, scored_guesses(*))")
      .eq("id", id).maybeSingle<RunRow>();
    if (error) throw new Error(`get Daily failed: ${error.message}`);
    if (!data) return null;
    const rounds: DailyRoundRecord[] = data.scored_rounds.sort((a, b) => a.round_number - b.round_number).map((round) => ({
      number: round.round_number, wordA: round.word_a, wordB: round.word_b, aiAnswer: round.ai_answer,
      status: round.status, score: round.score,
      guesses: round.scored_guesses.sort((a, b) => a.guess_number - b.guess_number).map(toGuess),
    }));
    return {
      id: data.id, playerId: data.player_id, date: data.puzzle_date ?? data.started_at.slice(0, 10), puzzleNumber: data.puzzle_number,
      mode: data.mode, status: data.status, currentRound: data.current_round, score: data.score,
      completedAt: data.completed_at, rounds, openingWords: data.opening_words,
      ...(data.theme ? { theme: data.theme } : {}),
    };
  }

  async cachedAnswer(run: DailyRunRecord): Promise<string | null> {
    const round = run.rounds[run.currentRound - 1];
    if (round.guesses.length === 0) return run.openingWords[run.currentRound - 1];
    if (run.mode === "unlimited") return null;
    const { data, error } = await this.db.from("scored_ai_answers").select("answer")
      .eq("puzzle_date", run.date).eq("round_number", run.currentRound).eq("guess_number", round.guesses.length + 1)
      .eq("word_a", round.wordA).eq("word_b", round.wordB).maybeSingle<{ answer: string }>();
    if (error) throw new Error(`Daily answer lookup failed: ${error.message}`);
    return data?.answer ?? null;
  }

  async commitAnswer(input: DailyPosition, answer: string): Promise<void> {
    const { data, error } = await this.db.rpc("commit_scored_answer", {
      p_id: input.id, p_player_id: input.playerId, p_round: input.round, p_guess: input.guess, p_answer: answer,
    });
    if (error) throw new Error(`commit_daily_answer failed: ${error.message}`);
    checkResult(data as string);
  }

  async submit(input: DailySubmission): Promise<RoundView> {
    const { data, error } = await this.db.rpc("submit_scored_guess", {
      p_id: input.id, p_player_id: input.playerId, p_round: input.round, p_guess: input.guess,
      p_answer: input.answer, p_exact_answer: input.exactAnswer, p_semantic_matched: input.semanticMatched,
      p_board_attempts: input.boardAttempts,
    }).single<{ code: string; reveal: GuessRow | null }>();
    if (error) throw new Error(`submit_daily_guess failed: ${error.message}`);
    checkResult(data.code);
    if (!data.reveal) throw new Error("Missing Daily reveal");
    return toGuess(data.reveal);
  }

  async firstBoard(date: string, round: number): Promise<FirstGuessBoard> {
    const { data, error } = await this.db.rpc("first_guess_board", { p_board_key: date === "unlimited" ? `unlimited-v3:${round}` : dailyBoardKey(date, round) }).single<FirstGuessBoard>();
    if (error) throw new Error(`Daily board failed: ${error.message}`);
    return data;
  }

  async firstWords(date: string, round: number): Promise<string[]> {
    const words: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.db.from("first_guesses").select("word")
        .eq("board_key", date === "unlimited" ? `unlimited-v3:${round}` : dailyBoardKey(date, round)).order("word").range(offset, offset + 499).returns<{ word: string }[]>();
      if (error) throw new Error(`Daily words failed: ${error.message}`);
      words.push(...data.map((row) => row.word));
      if (data.length < 500) return words;
    }
  }

  async summary(playerId: string, today: string): Promise<DailyRunSummary> {
    const { data, error } = await this.db.rpc("scored_run_summary", { p_player_id: playerId, p_today: today }).single<DailyRunSummary>();
    if (error) throw new Error(`Daily summary failed: ${error.message}`);
    return data;
  }

  async results(id: string, playerId: string): Promise<DailyScoreResults | null> {
    const { data, error } = await this.db.rpc("scored_daily_results", { p_id: id, p_player_id: playerId }).single<DailyScoreResults | null>();
    if (error) throw new Error(`Daily results failed: ${error.message}`);
    return data;
  }
}
