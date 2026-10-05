import { DAILY_EPOCH, DAILY_PAIR_EPOCH } from "./config";
import { LEGACY_STARTING_PAIRS, STARTING_PAIRS } from "./pairs";
import type { StartingPair } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateToUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function puzzleNumberForDate(date: string): number {
  return Math.round((dateToUtcMs(date) - dateToUtcMs(DAILY_EPOCH)) / DAY_MS) + 1;
}

export function dateForPuzzleNumber(puzzleNumber: number): string {
  return toIsoDate(new Date(dateToUtcMs(DAILY_EPOCH) + (puzzleNumber - 1) * DAY_MS));
}

export function pairForPuzzle(puzzleNumber: number): StartingPair {
  const index = puzzleNumber - puzzleNumberForDate(DAILY_PAIR_EPOCH);
  if (index < 0) {
    const n = LEGACY_STARTING_PAIRS.length;
    return LEGACY_STARTING_PAIRS[((index % n) + n) % n];
  }
  return STARTING_PAIRS[index % STARTING_PAIRS.length];
}

export function dailyPuzzle(now: Date = new Date()) {
  const date = toIsoDate(now);
  const number = puzzleNumberForDate(date);
  return { date, number, pair: pairForPuzzle(number) };
}

/**
 * Players send their local calendar date so the daily puzzle flips at local
 * midnight. Accept only dates within one day of the server's UTC date (covers
 * every timezone) and not before the first puzzle.
 */
export function isAcceptablePuzzleDate(date: string, now: Date = new Date()): boolean {
  if (!DATE_RE.test(date)) return false;
  const ms = dateToUtcMs(date);
  if (Number.isNaN(ms) || toIsoDate(new Date(ms)) !== date) return false;
  if (ms < dateToUtcMs(DAILY_EPOCH)) return false;
  const today = dateToUtcMs(toIsoDate(now));
  return Math.abs(ms - today) <= DAY_MS;
}
