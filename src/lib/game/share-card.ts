import { DAILY_GUESSES, DAILY_MAX_SCORE, DAILY_ROUNDS, type DailyRunView } from "./daily-run";

export type ShareCell = "hit" | "miss" | "none";

export interface ShareCard {
  /** null for Unlimited runs. */
  puzzleNumber: number | null;
  score: number;
  grid: ShareCell[][];
}

const CODES: Record<ShareCell, string> = { hit: "g", miss: "x", none: "o" };
const CELLS: Record<string, ShareCell> = { g: "hit", x: "miss", o: "none" };

/** Compact URL slug, e.g. "45-2400-gooooxgoooxxxxx". */
export function encodeShareCard(run: DailyRunView): string {
  const cells = Array.from({ length: DAILY_ROUNDS }, (_, r) =>
    Array.from({ length: DAILY_GUESSES }, (_, g) => {
      const guess = run.rounds[r]?.guesses[g];
      return CODES[guess ? guess.matched ? "hit" : "miss" : "none"];
    }).join(""),
  ).join("");
  return `${run.mode === "unlimited" ? "u" : run.puzzleNumber}-${run.score}-${cells}`;
}

export function decodeShareCard(slug: string): ShareCard | null {
  const match = /^(u|[1-9]\d{0,4})-(\d{1,4})-([gxo]+)$/.exec(slug);
  if (!match) return null;
  const score = Number(match[2]);
  const cells = match[3];
  if (score > DAILY_MAX_SCORE || cells.length !== DAILY_ROUNDS * DAILY_GUESSES) return null;
  return {
    puzzleNumber: match[1] === "u" ? null : Number(match[1]),
    score,
    grid: Array.from({ length: DAILY_ROUNDS }, (_, r) => [...cells.slice(r * DAILY_GUESSES, (r + 1) * DAILY_GUESSES)].map((c) => CELLS[c])),
  };
}

export function shareCardTitle(card: ShareCard): string {
  return card.puzzleNumber === null ? "Zonkey Unlimited" : `Zonkey #${card.puzzleNumber}`;
}
