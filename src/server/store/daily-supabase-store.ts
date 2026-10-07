import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyRunSummary, DailyScoreResults } from "@/lib/game/daily-run";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import type { RoundView, StartingPair } from "@/lib/game/types";
import { DailyConflictError, dailyBoardKey } from "./daily-types";
import type { DailyPosition, DailyRoundRecord, DailyRunRecord, DailyStore, DailySubmission } from "./daily-types";

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
  puzzle_date: string;
  puzzle_number: number;
  mode: "daily" | "archive";
  status: "active" | "completed";
  current_round: number;
  score: number;
  completed_at: string | null;
  daily_puzzles: { pairs: StartingPair[] };
  daily_rounds: {
    round_number: number;
    word_a: string;
    word_b: string;
    ai_answer: string | null;
    status: "active" | "won" | "lost";
    score: number;
    daily_guesses: GuessRow[];
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

  async start(playerId: string, date: string, number: number, pairs: StartingPair[]): Promise<{ run: DailyRunRecord; created: boolean }> {
    const { data, error } = await this.db.rpc("start_daily_run", {
      p_player_id: playerId, p_date: date, p_number: number, p_pairs: pairs,
    }).single<{ id: string; created: boolean }>();
    if (error) throw new Error(`start_daily_run failed: ${error.message}`);
    const run = await this.get(data.id);
    if (!run) throw new Error("Daily run disappeared");
    return { run, created: data.created };
  }

  async get(id: string): Promise<DailyRunRecord | null> {
    const { data, error } = await this.db.from("daily_runs")
      .select("*, daily_puzzles(pairs), daily_rounds(*, daily_guesses(*))")
      .eq("id", id).maybeSingle<RunRow>();
    if (error) throw new Error(`get Daily failed: ${error.message}`);
    if (!data) return null;
    const rounds: DailyRoundRecord[] = data.daily_rounds.sort((a, b) => a.round_number - b.round_number).map((round) => ({
      number: round.round_number, wordA: round.word_a, wordB: round.word_b, aiAnswer: round.ai_answer,
      status: round.status, score: round.score,
      guesses: round.daily_guesses.sort((a, b) => a.guess_number - b.guess_number).map(toGuess),
    }));
    return {
      id: data.id, playerId: data.player_id, date: data.puzzle_date, puzzleNumber: data.puzzle_number,
      mode: data.mode, status: data.status, currentRound: data.current_round, score: data.score,
      completedAt: data.completed_at, pairs: data.daily_puzzles.pairs, rounds,
    };
  }

  async cachedAnswer(run: DailyRunRecord): Promise<string | null> {
    const round = run.rounds[run.currentRound - 1];
    const { data, error } = await this.db.from("daily_ai_answers").select("answer")
      .eq("puzzle_date", run.date).eq("round_number", run.currentRound).eq("guess_number", round.guesses.length + 1)
      .eq("word_a", round.wordA).eq("word_b", round.wordB).maybeSingle<{ answer: string }>();
    if (error) throw new Error(`Daily answer lookup failed: ${error.message}`);
    return data?.answer ?? null;
  }

  async cacheFirstAnswer(run: DailyRunRecord, round: number, answer: string): Promise<void> {
    const pair = run.pairs[round - 1];
    const { error } = await this.db.from("daily_ai_answers").upsert({
      puzzle_date: run.date, round_number: round, guess_number: 1,
      word_a: pair.a, word_b: pair.b, answer,
    }, { onConflict: "puzzle_date,round_number,guess_number,word_a,word_b", ignoreDuplicates: true });
    if (error) throw new Error(`Daily opening answer cache failed: ${error.message}`);
  }

  async commitAnswer(input: DailyPosition, answer: string): Promise<void> {
    const { data, error } = await this.db.rpc("commit_daily_answer", {
      p_id: input.id, p_player_id: input.playerId, p_round: input.round, p_guess: input.guess, p_answer: answer,
    });
    if (error) throw new Error(`commit_daily_answer failed: ${error.message}`);
    checkResult(data as string);
  }

  async submit(input: DailySubmission): Promise<RoundView> {
    const { data, error } = await this.db.rpc("submit_daily_guess", {
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
    const { data, error } = await this.db.rpc("first_guess_board", { p_board_key: dailyBoardKey(date, round) }).single<FirstGuessBoard>();
    if (error) throw new Error(`Daily board failed: ${error.message}`);
    return data;
  }

  async firstWords(date: string, round: number): Promise<string[]> {
    const words: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.db.from("first_guesses").select("word")
        .eq("board_key", dailyBoardKey(date, round)).order("word").range(offset, offset + 499).returns<{ word: string }[]>();
      if (error) throw new Error(`Daily words failed: ${error.message}`);
      words.push(...data.map((row) => row.word));
      if (data.length < 500) return words;
    }
  }

  async summary(playerId: string, today: string): Promise<DailyRunSummary> {
    const { data, error } = await this.db.rpc("daily_run_summary", { p_player_id: playerId, p_today: today }).single<DailyRunSummary>();
    if (error) throw new Error(`Daily summary failed: ${error.message}`);
    return data;
  }

  async results(id: string, playerId: string): Promise<DailyScoreResults | null> {
    const { data, error } = await this.db.rpc("daily_score_results", { p_id: id, p_player_id: playerId }).single<DailyScoreResults | null>();
    if (error) throw new Error(`Daily results failed: ${error.message}`);
    return data;
  }
}
