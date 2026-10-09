import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ModeScores, PlayerScores } from "@/lib/game/scores";
import { DailyStreakSummary } from "./daily-streak";
import { DailyScores } from "./daily-scores";

export function ScoreSummary({ scores }: { scores: ModeScores }) {
  const items = [
    ["Played", scores.played],
    ["Win %", `${scores.winRate}%`],
    ["Best", scores.bestRounds ?? "—"],
    ["Avg", scores.averageRounds ?? "—"],
  ] as const;
  return (
    <dl className="grid w-full grid-cols-4 gap-2 divide-x text-center">
      {items.map(([label, value]) => (
        <div key={label}>
          <dd className="text-2xl font-bold tracking-tight text-primary tabular-nums">{value}</dd>
          <dt className="mt-1 text-[10px] text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function ScoresScreen({
  scores,
  error,
  onHome,
  onRetry,
  onResult,
  onDailyResult,
}: {
  scores: PlayerScores | null;
  error: string | null;
  onHome: () => void;
  onRetry: () => void;
  onResult: (id: string) => void;
  onDailyResult: (date: string) => void;
}) {
  const [mode, setMode] = useState<"daily" | "unlimited" | "archive">("daily");
  return (
    <section className="flex flex-1 flex-col gap-8 py-6">
      <div className="mt-4 space-y-2 text-center"><p className="eyebrow text-muted-foreground">Every connection counts</p><h1 className="text-4xl font-bold tracking-[-0.06em]">Your scores.</h1></div>
      <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-muted p-1.5">
        {(["daily", "unlimited", "archive"] as const).map((value) => (
          <Button key={value} className="h-12 rounded-xl" variant={mode === value ? "default" : "ghost"} aria-pressed={mode === value} onClick={() => setMode(value)}>
            {value === "daily" ? "Daily" : value === "archive" ? "Archive" : "Unlimited"}
          </Button>
        ))}
      </div>
      {scores && (
        <>
          <DailyScores history={scores.dailyRuns?.history ?? []} mode={mode} today={scores.dailyDate} onResult={mode === "unlimited" ? onResult : onDailyResult} />
          {mode === "daily" && <DailyStreakSummary streak={scores.dailyStreak} />}
        </>
      )}
      {!scores && !error && <p className="text-center text-muted-foreground">Loading scores…</p>}
      {error && (
        <div className="space-y-3 text-center" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={onRetry}>TRY AGAIN</Button>
        </div>
      )}
      <p className="mt-auto text-center text-xs text-muted-foreground">Scores are saved for this browser. No account needed.</p>
      <Button variant="ghost" className="h-11" onClick={onHome}>Back to home</Button>
    </section>
  );
}
