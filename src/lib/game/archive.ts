import { DAILY_EPOCH } from "./config";
import {
  pairForPuzzle,
  puzzleNumberForDate,
  toIsoDate,
} from "./daily";
import type { StartingPair } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyArchiveEntry {
  date: string;
  number: number;
  pair: StartingPair;
}

function parseDate(date: string): number | null {
  if (!DATE_RE.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || toIsoDate(new Date(ms)) !== date) return null;
  return ms;
}

export function dailyArchiveEntry(
  date: string,
  now: Date = new Date(),
): DailyArchiveEntry | null {
  const ms = parseDate(date);
  if (ms === null) return null;

  const first = Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  const today = Date.parse(`${toIsoDate(now)}T00:00:00Z`);
  if (ms < first || ms > today) return null;

  const number = puzzleNumberForDate(date);
  return { date, number, pair: pairForPuzzle(number) };
}

export function dailyArchiveDates(now: Date = new Date()): string[] {
  const first = Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  const today = Date.parse(`${toIsoDate(now)}T00:00:00Z`);
  const dates: string[] = [];

  for (let ms = first; ms <= today; ms += DAY_MS) {
    dates.push(toIsoDate(new Date(ms)));
  }

  return dates;
}

export function formatArchiveDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
