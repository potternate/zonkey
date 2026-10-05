import Image from "next/image";
import Link from "next/link";
import { Archive, ArrowRight, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { puzzleNumberForDate } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import { ScoreSummary } from "./scores-screen";
import { DailyStreakSummary } from "./daily-streak";
import { ConnectionExample } from "./connection-example";

export function Landing({
  onPlay, onScores, scores, busy, error,
}: {
  onPlay: (mode: GameMode) => void;
  onScores: () => void;
  scores: PlayerScores | null;
  busy: boolean;
  error: string | null;
}) {
  const daily = scores?.dailyGame;
  const dailyLabel = daily?.status === "active" ? "Resume daily" : daily ? "View daily result" : "Play daily";
  const puzzleNumber = scores ? puzzleNumberForDate(scores.dailyDate) : null;
  return (
    <div className="flex flex-1 flex-col justify-center py-8 animate-in fade-in duration-500 sm:py-16">
      <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <section className="text-center lg:text-left">
          <p className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-2 text-primary">
            <span className="size-1.5 rounded-full bg-primary" /> Find your stripe
          </p>
          <h1 className="text-[clamp(3rem,9vw,5.75rem)] font-extrabold leading-[1.02] tracking-[-0.075em]">
            Two words.<br /><span className="text-primary">One wild<br className="hidden lg:block" /> match.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-80 text-sm leading-7 text-muted-foreground sm:text-base lg:mx-0">
            You pick a word. Zonkey&rsquo;s AI picks one too.<br />
            Follow the connections until your words match.
          </p>
          <div className="mt-7 hidden max-w-80 lg:block">
            <ConnectionExample />
          </div>
          <p className="eyebrow mt-8 hidden text-muted-foreground lg:block">One word at a time. Eight chances to connect.</p>
        </section>
        <div className="mx-auto w-full max-w-md space-y-4 lg:max-w-none">
          <section className="daily-card relative isolate overflow-hidden rounded-[2rem] border border-primary/25 bg-card p-6 sm:p-8">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <p className="eyebrow text-primary">Zonkey daily</p>
              <span className="rounded-full border border-primary/25 bg-background/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">Free to play</span>
            </div>
            <div className="relative z-10 my-6 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[2.65rem] font-bold leading-none tracking-[-0.06em] sm:text-5xl">Daily<span className="text-2xl font-normal text-muted-foreground sm:text-3xl">{puzzleNumber !== null ? `#${puzzleNumber}` : ""}</span></p>
                <p className="mt-3 max-w-48 text-sm leading-6 text-muted-foreground">One pair for everyone.<br />See where your words take you.</p>
              </div>
              <Image src="/zonkey-mark.webp" alt="Zonkey zebra mascot" width={128} height={164} priority className="h-36 w-24 shrink-0 rotate-[-8deg] object-contain sm:h-40 sm:w-28" />
            </div>
            <Button onClick={() => onPlay("daily")} disabled={busy} className="relative z-10 h-14 w-full justify-between rounded-xl px-5 text-base font-bold shadow-none">
              {busy ? "Getting ready…" : dailyLabel}<ArrowRight className="size-5" />
            </Button>
            <p className="relative z-10 mt-4 text-center text-[11px] text-muted-foreground">A fresh puzzle every day at midnight UTC.</p>
          </section>
          <button onClick={() => onPlay("unlimited")} disabled={busy} className="group flex min-h-22 w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><InfinityIcon className="size-6" /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-bold tracking-tight">Unlimited</span><span className="mt-1 block text-xs text-muted-foreground">New words. As many games as you like.</span></span>
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
          </button>
          <Link href="/daily" className="group flex min-h-16 w-full items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-4">
            <Archive className="size-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm font-bold">Play past Dailies</span>
            <ArrowRight className="size-4" />
          </Link>
          <div className="lg:hidden"><ConnectionExample /></div>
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </div>
      <div className="mt-10 grid gap-6 border-t pt-6 lg:mt-14 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start"><Sparkles className="size-4 text-primary" /> No sign-up. Eight turns. Go with your gut.</p>
        <div className="mx-auto w-full max-w-md">
          <button onClick={onScores} disabled={busy} className="mb-4 flex min-h-11 w-full items-center justify-between rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4">
            <span className="eyebrow">Your daily stats</span><span className="flex items-center gap-1 text-xs text-muted-foreground">All scores <ArrowRight className="size-3" /></span>
          </button>
          {scores ? (
            <div className="space-y-5">
              <ScoreSummary scores={scores.daily} />
              <DailyStreakSummary streak={scores.dailyStreak} />
            </div>
          ) : <p className="text-sm text-muted-foreground">Your scores live here. No account needed.</p>}
        </div>
      </div>
    </div>
  );
}
