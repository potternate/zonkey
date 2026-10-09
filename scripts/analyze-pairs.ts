import { createClient } from "@supabase/supabase-js";
import { pairQuality, type PairObservation } from "../src/lib/game/pair-quality";

interface DailyRow {
  id: string;
  mode: string;
  current_round: number;
  started_at: string;
  daily_puzzles: { pairs: { a: string; b: string }[]; opening_words: string[] | null };
  daily_rounds: {
    round_number: number;
    status: "active" | "won" | "lost";
    daily_guesses: { guess_number: number; matched: boolean; created_at: string }[];
  }[];
}

interface GameRow {
  player_first: boolean;
  id: string;
  mode: string;
  status: "active" | "won" | "lost";
  start_word_a: string;
  start_word_b: string;
  started_at: string;
  rounds: { round_number: number; player_answer: string | null; matched: boolean | null; created_at: string }[];
}

async function analyze() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const observations: PairObservation[] = [];
  const snapshot = new Date().toISOString();
  const dailySelect = "id,mode,current_round,started_at,daily_puzzles(pairs,opening_words),daily_rounds(round_number,status,daily_guesses(guess_number,matched,created_at))";
  const gameSelect = "id,mode,status,start_word_a,start_word_b,started_at,player_first,rounds(round_number,player_answer,matched,created_at)";
  await Promise.all([
    (async () => {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db.from("daily_runs").select(dailySelect)
          .lte("started_at", snapshot).order("id").range(offset, offset + 499).returns<DailyRow[]>();
        if (error) throw new Error(error.message);
        for (const run of data) {
          if (run.daily_puzzles.opening_words) continue;
          const lastActivity = run.daily_rounds.flatMap((round) => round.daily_guesses.map((guess) => guess.created_at)).sort().at(-1) ?? run.started_at;
          for (const round of run.daily_rounds.filter((round) => round.round_number <= run.current_round)) {
            const pair = run.daily_puzzles.pairs[round.round_number - 1];
            observations.push({
              ...pair, mode: run.mode, status: round.status, guesses: round.daily_guesses.length,
              firstGuessMatched: round.daily_guesses.some((guess) => guess.guess_number === 1 && guess.matched),
              updatedAt: round.status === "active" ? lastActivity : round.daily_guesses.map((guess) => guess.created_at).sort().at(-1) ?? run.started_at,
            });
          }
        }
        if (data.length < 500) break;
      }
    })(),
    (async () => {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db.from("games").select(gameSelect)
          .lte("started_at", snapshot).order("id").range(offset, offset + 499).returns<GameRow[]>();
        if (error) throw new Error(error.message);
        for (const game of data) {
          if (game.player_first) continue;
          const submitted = game.rounds.filter((round) => round.player_answer !== null);
          observations.push({
            a: game.start_word_a, b: game.start_word_b, mode: game.mode === "daily" ? "legacy-daily" : game.mode,
            status: game.status, guesses: submitted.length,
            firstGuessMatched: submitted.some((round) => round.round_number === 1 && round.matched),
            updatedAt: game.rounds.map((round) => round.created_at).sort().at(-1) ?? game.started_at,
          });
        }
        if (data.length < 500) break;
      }
    })(),
  ]);
  console.log(JSON.stringify({
    asOf: snapshot, minimumReviewSample: 20,
    note: "Player-first games are excluded: their initial pairs are player-selected. Stale means unfinished for at least 24 hours; it is a review signal, not confirmed abandonment. Difficulty labels are editorial until samples are sufficient.",
    queries: { daily: dailySelect, games: gameSelect },
    pairs: pairQuality(observations, new Date(snapshot)),
  }, null, 2));
}

void analyze().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Analysis failed.");
  process.exitCode = 1;
});
