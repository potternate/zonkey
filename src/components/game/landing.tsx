import Link from "next/link";
import { Archive, Flame, Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { puzzleNumberForDate } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import type { Account } from "@/lib/client/api";
import { InstallPrompt } from "./install-prompt";
import { NextDailyCountdown } from "./next-daily-countdown";
import { PixelScene } from "./pixel-scene";
import { TutorialNudge } from "./tutorial";
import { WordPairCard } from "./word";

export function Landing({
  onPlay, onScores, onTutorial, scores, busy, error, account,
}: {
  onTutorial: () => void;
  onPlay: (mode: GameMode) => void;
  onScores: () => void;
  scores: PlayerScores | null;
  busy: boolean;
  error: string | null;
  account: Account | null;
}) {
  const daily = scores?.dailyRuns?.history.find((run) => run.mode === "daily" && run.date === scores.dailyDate);
  const dailyLabel = daily?.status === "active" ? "Resume Daily" : daily ? "View Daily result" : "Play Daily";
  const dailyDone = daily !== undefined && daily.status !== "active";
  const puzzleNumber = scores ? puzzleNumberForDate(scores.dailyDate) : null;
  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-7 py-8 animate-in fade-in duration-500 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
      <div className="text-center lg:text-left">
        <p className="eyebrow mb-4 text-primary glow">Your daily word safari</p>
        <h1 className="glitch font-pixel text-[clamp(1.6rem,7.5vw,3.25rem)] leading-[1.35]">
          Meet in<br /><span className="text-primary">the middle</span>
        </h1>
        <p className="mt-4 text-sm tracking-[0.12em] text-muted-foreground uppercase">
          Pick your word · Reveal Zonkey&rsquo;s · Connect
        </p>
        <PixelScene className="-mx-5 mt-6 h-44 w-[calc(100%+2.5rem)] border-y-2 border-[var(--pixel-shadow)] sm:mx-0 sm:h-56 sm:w-full sm:border-2" />
        <WordPairCard wordA="zebra" wordB="donkey" className="relative z-10 mx-2 -mt-10 sm:mx-6" />
      </div>
      <div className="mx-auto w-full max-w-md border bg-card p-5 text-center sm:p-7">
        <div className="mb-5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="eyebrow text-primary">Daily {puzzleNumber !== null ? `#${puzzleNumber}` : ""}</span>
          <span>3 rounds · 5 guesses each</span>
        </div>
        <div className="space-y-3">
          <Button onClick={() => onPlay("daily")} disabled={busy} className="mb-3 h-auto min-h-16 w-full min-w-0 gap-3 px-4 py-3 text-[clamp(1.05rem,5vw,1.25rem)] leading-tight whitespace-normal">
            {busy ? "Getting ready…" : <><span aria-hidden="true">▶</span>{`${dailyLabel}${puzzleNumber !== null ? ` #${puzzleNumber}` : ""}`}<span aria-hidden="true">◀</span></>}
          </Button>
          {dailyDone && <NextDailyCountdown className="mb-4" />}
          {scores && !scores.dailyRuns?.history.some((run) => run.mode === "daily") && <TutorialNudge onTutorial={onTutorial} />}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => onPlay("unlimited")} disabled={busy} className="h-12 rounded-xl">
              <InfinityIcon className="size-4" />Unlimited
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-xl">
              <Link href="/daily"><Archive className="size-4" />Archive</Link>
            </Button>
          </div>
          {(account?.enabled || (account?.accounts && !account.email)) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 text-xs">
              {account.accounts && !account.email && <Link href="/account" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Sign in free to save your streak</Link>}
              {account.enabled && <Link href="/plus" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">
                {account.plus ? "Plus unlocked" : "Unlimited + Archive · $5 once"}
              </Link>}
            </div>
          )}
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>}
        </div>
        {scores && (
          <button onClick={onScores} disabled={busy} className="mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">
            <Flame className="size-4 text-primary" aria-hidden="true" />
            {scores.dailyStreak.current ? `${scores.dailyStreak.current} day streak` : "Start a Daily streak"}
          </button>
        )}
        {dailyDone && <InstallPrompt />}
      </div>
    </div>
  );
}
