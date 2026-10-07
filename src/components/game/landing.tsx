import Link from "next/link";
import { Archive, ArrowRight, Flame, Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { puzzleNumberForDate } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import { WordPairCard } from "./word";

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
    <div className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-7 py-8 animate-in fade-in duration-500 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
      <div className="text-center lg:text-left">
        <p className="eyebrow mb-4 text-primary">Your daily word safari</p>
        <h1 className="text-[clamp(3rem,8vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.06em]">
          Meet in<br /><span className="text-primary italic">the middle.</span>
        </h1>
        <p className="mt-5 text-sm leading-6 text-muted-foreground sm:text-base">
          Two words. You and an AI. Find the same connection.
        </p>
        <WordPairCard wordA="zebra" wordB="donkey" className="mt-6 sm:mt-8" />
      </div>
      <div className="mx-auto w-full max-w-md rounded-[2rem] border bg-card p-5 text-center shadow-sm sm:p-7">
        <div className="mb-5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="eyebrow text-primary">Daily {puzzleNumber !== null ? `#${puzzleNumber}` : ""}</span>
          <span>5 rounds · 5 guesses each</span>
        </div>
        <div className="space-y-3">
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
    </div>
  );
}
