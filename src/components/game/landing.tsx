import Link from "next/link";
import { Archive, ArrowRight, Flame, Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { puzzleNumberForDate } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";

export function Landing({
  onPlay, onScores, scores, busy, error,
}: {
  onPlay: (mode: GameMode) => void;
  onScores: () => void;
  scores: PlayerScores | null;
  busy: boolean;
  error: string | null;
}) {
  const daily = scores?.dailyRuns ? scores.dailyRuns.history.find((run) => run.date === scores.dailyDate) : scores?.dailyGame;
  const dailyLabel = daily?.status === "active" ? "Resume Daily" : daily ? "View Daily result" : "Play Daily";
  const puzzleNumber = scores ? puzzleNumberForDate(scores.dailyDate) : null;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 text-center animate-in fade-in duration-500 sm:py-14">
      <h1 className="text-[clamp(2.25rem,7vw,3.5rem)] font-extrabold leading-tight tracking-[-0.06em]">
        Two words.<br /><span className="text-primary">One wild match.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-80 text-sm leading-6 text-muted-foreground">
        Five daily rounds. Five guesses each.<br />Connect faster to earn up to 5,000 points.
      </p>
      <p className="mt-4 text-sm" aria-label="For example, donkey and zebra connect when you and the AI both choose Zonkey.">
        donkey + zebra <span className="mx-1 text-muted-foreground">→</span> <span className="font-semibold text-primary">Zonkey</span>
      </p>
      <div className="mt-8 space-y-3">
        <Button onClick={() => onPlay("daily")} disabled={busy} className="h-14 w-full justify-between rounded-xl px-5 text-base font-bold">
          {busy ? "Getting ready…" : `${dailyLabel}${puzzleNumber !== null ? ` #${puzzleNumber}` : ""}`}<ArrowRight className="size-5" />
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => onPlay("unlimited")} disabled={busy} className="h-12 rounded-xl">
            <InfinityIcon className="size-4" />Unlimited
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl">
            <Link href="/daily"><Archive className="size-4" />Archive</Link>
          </Button>
        </div>
        {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>}
      </div>
      {scores && (
        <button onClick={onScores} disabled={busy} className="mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">
          <Flame className="size-4 text-primary" aria-hidden="true" />
          {scores.dailyStreak.current ? `${scores.dailyStreak.current} day streak` : "Start a Daily streak"}
        </button>
      )}
    </div>
  );
}
