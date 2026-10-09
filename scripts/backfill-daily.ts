import { createClient } from "@supabase/supabase-js";
import { dailyArchiveDates } from "../src/lib/game/archive";
import { puzzleNumberForDate } from "../src/lib/game/daily";
import { presetOpeningWords } from "../src/server/opening-words";

const puzzles = dailyArchiveDates().map((date) => {
  const number = puzzleNumberForDate(date);
  return { date, number };
});
const apply = process.argv.includes("--apply");
console.log(`${apply ? "Backfilling" : "Dry run:"} ${puzzles.length} player-first five-round puzzles (${puzzles[0]?.date} through ${puzzles.at(-1)?.date}).`);
async function backfill() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const puzzle of puzzles) {
    const { error } = await db.rpc("seed_scored_puzzle", {
      p_date: puzzle.date, p_number: puzzle.number, p_opening_words: presetOpeningWords(5),
    });
    if (error) throw new Error(`Backfill failed: ${error.message}`);
  }
  console.log("Backfill complete. Existing puzzles and player results were preserved.");
}

if (apply) void backfill().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "Backfill failed.");
  process.exitCode = 1;
});
