import { createClient } from "@supabase/supabase-js";
import { dailyArchiveDates } from "../src/lib/game/archive";
import { puzzleNumberForDate } from "../src/lib/game/daily";
import { dailyPairsForPuzzle } from "../src/lib/game/daily-run";
import { playerFirstDaily } from "../src/lib/game/opening";

const puzzles = dailyArchiveDates().filter((date) => !playerFirstDaily(puzzleNumberForDate(date))).map((date) => {
  const number = puzzleNumberForDate(date);
  return { puzzle_date: date, puzzle_number: number, pairs: dailyPairsForPuzzle(number) };
});
const apply = process.argv.includes("--apply");
console.log(`${apply ? "Backfilling" : "Dry run:"} ${puzzles.length} five-round puzzles (${puzzles[0]?.puzzle_date} through ${puzzles.at(-1)?.puzzle_date}).`);
async function backfill() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let offset = 0; offset < puzzles.length; offset += 500) {
    const { error } = await db.from("daily_puzzles").upsert(puzzles.slice(offset, offset + 500), {
      onConflict: "puzzle_date", ignoreDuplicates: true,
    });
    if (error) throw new Error(`Backfill failed: ${error.message}`);
  }
  console.log("Backfill complete. Existing puzzles and player results were preserved.");
}

if (apply) void backfill().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "Backfill failed.");
  process.exitCode = 1;
});
