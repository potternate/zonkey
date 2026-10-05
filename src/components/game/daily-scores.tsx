import { Button } from "@/components/ui/button";
import type { DailyRunEntry } from "@/lib/game/daily-run";

export function DailyScores({ history, mode, onResult }: {
  history: DailyRunEntry[]; mode: "daily" | "archive"; onResult: (date: string) => void;
}) {
  const completed = history.filter((run) => run.mode === mode && run.status === "completed");
  const summary = [
    ["Played", completed.length],
    ["Best", completed.length ? Math.max(...completed.map((run) => run.score)).toLocaleString("en-US") : "—"],
    ["Avg", completed.length ? Math.round(completed.reduce((sum, run) => sum + run.score, 0) / completed.length).toLocaleString("en-US") : "—"],
  ] as const;
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 divide-x text-center">
        {summary.map(([label, value]) => (
          <div key={label}><dd className="text-2xl font-bold text-primary tabular-nums">{value}</dd><dt className="mt-1 text-xs text-muted-foreground">{label}</dt></div>
        ))}
      </dl>
      <p className="text-center text-xs text-muted-foreground">Points out of 5,000. Higher is better.</p>
      <ul className="divide-y border-y">
        {history.filter((run) => run.mode === mode).slice(0, 10).map((run) => (
          <li key={run.id}>
            <Button variant="ghost" onClick={() => onResult(run.date)} className="min-h-16 w-full justify-between gap-3 whitespace-normal px-2 text-left">
              <span>{mode === "daily" ? "Daily" : "Archive"} #{run.puzzleNumber}<span className="mt-1 block text-xs font-normal text-muted-foreground">{run.date}</span></span>
              <span className="shrink-0 font-bold text-success tabular-nums">{run.status === "active" ? "Resume" : `${run.score.toLocaleString("en-US")} pts`}</span>
            </Button>
          </li>
        ))}
      </ul>
      {!history.some((run) => run.mode === mode) && <p className="text-center text-sm text-muted-foreground">Finish a five-round puzzle to save your first score.</p>}
    </div>
  );
}
