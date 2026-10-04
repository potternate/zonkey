import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ModeScores, PlayerScores } from "@/lib/game/scores";
import { gameLabel } from "./header";

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
}: {
  scores: PlayerScores | null;
  error: string | null;
  onHome: () => void;
  onRetry: () => void;
  onResult: (id: string) => void;
}) {
  const [mode, setMode] = useState<"daily" | "unlimited">("daily");
  return (
    <section className="flex flex-1 flex-col gap-8 py-6">
      <div className="mt-4 space-y-2 text-center"><p className="eyebrow text-muted-foreground">Every connection counts</p><h1 className="text-4xl font-bold tracking-[-0.06em]">Your scores.</h1></div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-muted p-1.5">
        {(["daily", "unlimited"] as const).map((value) => (
          <Button key={value} className="h-12 rounded-xl" variant={mode === value ? "default" : "ghost"} aria-pressed={mode === value} onClick={() => setMode(value)}>
            {value === "daily" ? "Daily" : "Unlimited"}
          </Button>
        ))}
      </div>
      {scores && (
        <>
          <ScoreSummary scores={scores[mode]} />
          <p className="text-center text-xs text-muted-foreground">Best and average are rounds to connect. Lower is better.</p>
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="eyebrow mb-3 text-muted-foreground">Recent connections</h2>
            <ul className="divide-y">
              {scores.recent.filter((game) => (game.mode === "daily") === (mode === "daily")).map((game) => (
                <li key={game.id}>
                  <button className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-2" onClick={() => onResult(game.id)}>
                    <span>
                      <span className="block text-sm font-bold">{gameLabel(game.mode, game.puzzleNumber)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(game.completedAt).toLocaleDateString()}</span>
                    </span>
                    <span className={game.status === "won" ? "font-bold text-success" : "font-bold"}>
                      {game.status === "won" ? `${game.rounds} rounds` : "No match"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!scores[mode].played && <p className="py-5 text-center text-sm text-muted-foreground">Finish a game to save your first score.</p>}
          </div>
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
