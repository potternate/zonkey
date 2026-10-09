import type { DailyRunEntry } from "./daily-run";

const DAY_MS = 86_400_000;

export function scoreProgress(history: DailyRunEntry[], mode: "daily" | "archive" | "unlimited", today: string) {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const completed = history.filter((run) => run.mode === mode && run.status === "completed" && run.completedAt !== null);
  const dateOf = (run: DailyRunEntry) => mode === "daily" ? run.date : run.completedAt!.slice(0, 10);
  const recent = completed.filter((run) => {
    const age = todayMs - Date.parse(`${dateOf(run)}T00:00:00Z`);
    return age >= 0 && age < 7 * DAY_MS;
  });
  const byDay = new Map<string, number[]>();
  for (const run of completed) {
    const date = dateOf(run);
    const age = todayMs - Date.parse(`${date}T00:00:00Z`);
    if (age < 0 || age >= 30 * DAY_MS) continue;
    const scores = byDay.get(date) ?? [];
    scores.push(run.score);
    byDay.set(date, scores);
  }
  const recorded = completed.filter((run) => run.solvedRounds !== undefined && run.solvedGuesses !== undefined);
  const solved = recorded.reduce((sum, run) => sum + run.solvedRounds!, 0);
  return {
    weekAverage: recent.length ? Math.round(recent.reduce((sum, run) => sum + run.score, 0) / recent.length) : null,
    weekPlayed: recent.length,
    averageSolvedGuesses: solved ? Math.round(recorded.reduce((sum, run) => sum + run.solvedGuesses!, 0) / solved * 10) / 10 : null,
    points: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, scores]) => ({
      date, score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    })),
  };
}
