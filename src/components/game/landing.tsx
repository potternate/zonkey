import Image from "next/image";
import { ArrowRight, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { puzzleNumberForDate } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/types";
import type { PlayerScores } from "@/lib/game/scores";
import { ScoreSummary } from "./scores-screen";

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
    <div className="flex flex-1 flex-col justify-center py-9 animate-in fade-in duration-500 sm:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <section className="text-center lg:text-left">
          <p className="eyebrow mb-5 inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-foreground" /> A daily meeting of minds
          </p>
          <h1 className="text-[clamp(3rem,9vw,5.75rem)] font-extrabold leading-[1.02] tracking-[-0.075em]">
            Two minds.<br /><span className="editorial font-normal tracking-[-0.06em]">One word.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-80 text-sm leading-7 text-muted-foreground sm:text-base lg:mx-0">
            You think of a word. The AI does too.<br />
            Keep connecting until you think alike.
          </p>
          <div className="mt-7 hidden max-w-80 items-center gap-3 lg:flex" aria-hidden="true">
            <span className="flex h-16 flex-1 rotate-[-5deg] items-center justify-center rounded-2xl border bg-card text-lg font-bold shadow-sm">pizza</span>
            <span className="text-xl text-muted-foreground">↔</span>
            <span className="flex h-16 flex-1 rotate-[5deg] items-center justify-center rounded-2xl border bg-card text-lg font-bold shadow-sm">ocean</span>
          </div>
          <p className="eyebrow mt-8 hidden text-muted-foreground lg:block">One word at a time. Eight chances to connect.</p>
        </section>
        <div className="mx-auto w-full max-w-md space-y-4 lg:max-w-none">
          <section className="daily-card relative isolate overflow-hidden rounded-[2rem] bg-foreground p-6 text-background sm:p-8">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <p className="eyebrow text-background/65">The daily connection</p>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">Free to play</span>
            </div>
            <div className="relative z-10 my-6 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[2.65rem] font-bold leading-none tracking-[-0.06em] sm:text-5xl">Daily<span className="text-2xl font-normal text-background/45 sm:text-3xl">{puzzleNumber !== null ? `#${puzzleNumber}` : ""}</span></p>
                <p className="mt-3 max-w-48 text-sm leading-6 text-background/65">Same two words.<br />A world of different minds.</p>
              </div>
              <Image src="/zonkey-mark.webp" alt="Zonkey zebra mascot" width={104} height={132} priority className="h-28 w-18 shrink-0 object-contain sm:h-32 sm:w-25" />
            </div>
            <Button onClick={() => onPlay("daily")} disabled={busy} className="relative z-10 h-14 w-full justify-between rounded-xl bg-background px-5 text-base font-semibold text-foreground shadow-none hover:bg-white">
              {busy ? "Getting ready…" : dailyLabel}<ArrowRight className="size-5" />
            </Button>
            <p className="relative z-10 mt-4 text-center text-[11px] text-background/55">A fresh puzzle every day at midnight UTC.</p>
          </section>
          <button onClick={() => onPlay("unlimited")} disabled={busy} className="group flex min-h-22 w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted"><InfinityIcon className="size-6" /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-bold tracking-tight">Unlimited</span><span className="mt-1 block text-xs text-muted-foreground">New words. As many games as you like.</span></span>
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
          </button>
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </div>
      <div className="mt-10 grid gap-6 border-t pt-6 lg:mt-14 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start"><Sparkles className="size-4" /> No sign-up. Just a little spark of connection.</p>
        <div className="mx-auto w-full max-w-md">
          <button onClick={onScores} disabled={busy} className="mb-4 flex min-h-11 w-full items-center justify-between rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4">
            <span className="eyebrow">Your daily stats</span><span className="flex items-center gap-1 text-xs text-muted-foreground">All scores <ArrowRight className="size-3" /></span>
          </button>
          {scores ? <ScoreSummary scores={scores.daily} /> : <p className="text-sm text-muted-foreground">Your scores live here. No account needed.</p>}
        </div>
      </div>
    </div>
  );
}
