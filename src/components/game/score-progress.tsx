import type { DailyRunEntry } from "@/lib/game/daily-run";
import { scoreProgress } from "@/lib/game/progress";

export function ScoreProgress({ history, mode, today }: {
  history: DailyRunEntry[]; mode: "daily" | "archive" | "unlimited"; today: string;
}) {
  const progress = scoreProgress(history, mode, today);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const points = progress.points.map(({ date, score }) => ({
    x: 12 + (29 - (todayMs - Date.parse(`${date}T00:00:00Z`)) / 86_400_000) * 276 / 29,
    y: 88 - score * 72 / 5_000,
    date, score,
  }));
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="eyebrow text-muted-foreground">Your progress</h2>
      <dl className="grid grid-cols-2 gap-4">
        <div><dd className="text-2xl font-bold text-primary tabular-nums">{progress.weekAverage?.toLocaleString("en-US") ?? "—"}</dd><dt className="text-xs text-muted-foreground">7-day average · {progress.weekPlayed} played</dt></div>
        <div><dd className="text-2xl font-bold text-primary tabular-nums">{progress.averageSolvedGuesses ?? "—"}</dd><dt className="text-xs text-muted-foreground">Guesses per solved round</dt></div>
      </dl>
      {points.length > 0 ? (
        <figure>
          <svg viewBox="0 0 300 104" className="w-full text-primary" role="img" aria-label="Scores over the last 30 days, from 0 to 5,000 points">
            <desc>{points.map(({ date, score }) => `${date}: ${score} points`).join("; ")}</desc>
            {[16, 52, 88].map((y) => <line key={y} x1="12" x2="288" y1={y} y2={y} stroke="currentColor" opacity="0.15" />)}
            <polyline points={points.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
            {points.map(({ x, y, date, score }) => <circle key={date} cx={x} cy={y} r="3" fill="currentColor"><title>{date}: {score} points</title></circle>)}
          </svg>
          <figcaption className="flex justify-between text-[11px] text-muted-foreground">
            <span>Last 30 days · {mode === "daily" ? "puzzle date" : "played date"}</span><span>0–5,000 pts</span>
          </figcaption>
        </figure>
      ) : <p className="text-xs text-muted-foreground">Finish a puzzle to start your trend.</p>}
      <p className="text-[11px] leading-5 text-muted-foreground">
        Averages use completed {mode === "daily" ? "Dailies" : mode === "archive" ? "Archive puzzles" : "Unlimited games"}. Missed days and unsolved rounds aren’t counted as extra guesses.
      </p>
    </section>
  );
}
