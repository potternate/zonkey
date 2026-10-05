import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameMode, GameStatus } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import type { DailyResults } from "@/lib/game/daily-results";
import type { GameRecord, RoundRecord } from "@/lib/game/view";
import {
  DuplicateDailyGameError,
  type AnalyticsEvent,
  type GameStore,
  type NewGameInput,
  type SubmitAnswerInput,
  type SubmitAnswerResult,
} from "./types";

interface GameRow {
  id: string;
  player_id: string;
  mode: GameMode;
  puzzle_date: string | null;
  puzzle_number: number | null;
  start_word_a: string;
  start_word_b: string;
  status: GameStatus;
  round_number: number;
  started_at: string;
  completed_at: string | null;
  final_rounds: number | null;
}

interface RoundRow {
  id: string;
  game_id: string;
  round_number: number;
  word_a: string;
  word_b: string;
  player_answer: string | null;
  ai_answer: string | null;
  matched: boolean | null;
  created_at: string;
}

interface SubmitRow {
  out_result: string;
  out_matched: boolean | null;
  out_status: GameStatus | null;
  out_ai_answer: string | null;
}

const UNIQUE_VIOLATION = "23505";

function toGame(row: GameRow): GameRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    mode: row.mode,
    puzzleDate: row.puzzle_date,
    puzzleNumber: row.puzzle_number,
    startWordA: row.start_word_a,
    startWordB: row.start_word_b,
    status: row.status,
    roundNumber: row.round_number,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    finalRounds: row.final_rounds,
  };
}

function toRound(row: RoundRow): RoundRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    roundNumber: row.round_number,
    wordA: row.word_a,
    wordB: row.word_b,
    playerAnswer: row.player_answer,
    aiAnswer: row.ai_answer,
    matched: row.matched,
    createdAt: row.created_at,
  };
}

const SUBMIT_CODES = new Set([
  "not_found",
  "forbidden",
  "not_active",
  "wrong_round",
  "already_submitted",
  "ai_not_ready",
  "board_changed",
] as const);

type SubmitCode = Extract<SubmitAnswerResult, { ok: false }>["code"];

function isSubmitCode(value: string): value is SubmitCode {
  return SUBMIT_CODES.has(value as SubmitCode);
}

/** Server-only store using the service role key (bypasses RLS). */
export class SupabaseStore implements GameStore {
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createGame(input: NewGameInput): Promise<GameRecord> {
    const { data, error } = await this.db
      .rpc("create_game", {
        p_player_id: input.playerId,
        p_mode: input.mode,
        p_puzzle_date: input.puzzleDate,
        p_puzzle_number: input.puzzleNumber,
        p_word_a: input.wordA,
        p_word_b: input.wordB,
      })
      .single<GameRow>();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new DuplicateDailyGameError();
      throw new Error(`create_game failed: ${error.message}`);
    }
    return toGame(data);
  }

  async getGame(gameId: string): Promise<GameRecord | null> {
    const { data, error } = await this.db.from("games").select("*").eq("id", gameId).maybeSingle<GameRow>();
    if (error) throw new Error(`getGame failed: ${error.message}`);
    return data ? toGame(data) : null;
  }

  async findDailyGame(playerId: string, puzzleDate: string, mode: "daily" | "practice" = "daily"): Promise<GameRecord | null> {
    const { data, error } = await this.db
      .from("games")
      .select("*")
      .eq("player_id", playerId)
      .eq("mode", mode)
      .eq("puzzle_date", puzzleDate)
      .maybeSingle<GameRow>();
    if (error) throw new Error(`findDailyGame failed: ${error.message}`);
    return data ? toGame(data) : null;
  }

  async getRounds(gameId: string): Promise<RoundRecord[]> {
    const { data, error } = await this.db
      .from("rounds")
      .select("*")
      .eq("game_id", gameId)
      .order("round_number", { ascending: true })
      .returns<RoundRow[]>();
    if (error) throw new Error(`getRounds failed: ${error.message}`);
    return data.map(toRound);
  }

  async getPlayerScores(playerId: string, dailyDate: string): Promise<PlayerScores> {
    const { data, error } = await this.db
      .rpc("player_scores", { p_player_id: playerId, p_daily_date: dailyDate })
      .single<PlayerScores>();
    if (error) throw new Error(`player_scores failed: ${error.message}`);
    return data;
  }

  async getDailyResults(gameId: string, playerId: string): Promise<DailyResults | null> {
    const { data, error } = await this.db
      .rpc("daily_results", { p_game_id: gameId, p_player_id: playerId })
      .single<DailyResults | null>();
    if (error) throw new Error(`daily_results failed: ${error.message}`);
    return data;
  }

  async getFirstGuesses(boardKey: string): Promise<FirstGuessBoard> {
    const { data, error } = await this.db
      .rpc("first_guess_board", { p_board_key: boardKey })
      .single<FirstGuessBoard>();
    if (error) throw new Error(`first_guess_board failed: ${error.message}`);
    return data;
  }

  async getFirstGuessWords(boardKey: string): Promise<string[]> {
    const words: string[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.db
        .from("first_guesses")
        .select("word")
        .eq("board_key", boardKey)
        .order("word")
        .range(offset, offset + pageSize - 1)
        .returns<{ word: string }[]>();
      if (error) throw new Error(`getFirstGuessWords failed: ${error.message}`);
      words.push(...data.map(({ word }) => word));
      if (data.length < pageSize) return words;
    }
  }

  async consumeAiQuota(playerId: string, playerLimit: number, globalLimit: number): Promise<boolean> {
    const { data, error } = await this.db.rpc("consume_ai_quota", {
      p_player_id: playerId,
      p_player_limit: playerLimit,
      p_global_limit: globalLimit,
    });
    if (error) throw new Error(`consume_ai_quota failed: ${error.message}`);
    return data === true;
  }

  async setAiAnswer(roundId: string, aiAnswer: string): Promise<string> {
    const { error } = await this.db
      .from("rounds")
      .update({ ai_answer: aiAnswer })
      .eq("id", roundId)
      .is("ai_answer", null);
    if (error) throw new Error(`setAiAnswer failed: ${error.message}`);
    const { data, error: readError } = await this.db
      .from("rounds")
      .select("ai_answer")
      .eq("id", roundId)
      .single<{ ai_answer: string | null }>();
    if (readError) throw new Error(`setAiAnswer read failed: ${readError.message}`);
    if (data.ai_answer === null) throw new Error("setAiAnswer: answer not stored");
    return data.ai_answer;
  }

  async submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
    const { data, error } = await this.db
      .rpc("submit_judged_answer", {
        p_game_id: input.gameId,
        p_player_id: input.playerId,
        p_round_number: input.roundNumber,
        p_answer: input.answer,
        p_exact_answer: input.exactAnswer ?? input.answer,
        p_board_attempts: input.boardAttempts ?? null,
        p_max_rounds: input.maxRounds,
        p_semantic_matched: input.semanticMatched ?? false,
      })
      .single<SubmitRow>();
    if (error) throw new Error(`submit_answer failed: ${error.message}`);
    if (data.out_result === "ok" && data.out_status && data.out_ai_answer !== null) {
      return { ok: true, matched: data.out_matched === true, status: data.out_status, aiAnswer: data.out_ai_answer };
    }
    if (isSubmitCode(data.out_result)) return { ok: false, code: data.out_result };
    throw new Error(`submit_answer returned unexpected result: ${data.out_result}`);
  }

  async insertEvent(event: AnalyticsEvent): Promise<void> {
    const { error } = await this.db.from("events").insert({
      name: event.name,
      player_id: event.playerId,
      game_id: event.gameId,
      properties: event.properties ?? {},
    });
    if (error) throw new Error(`insertEvent failed: ${error.message}`);
  }
}
