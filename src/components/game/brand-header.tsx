"use client";

import Image from "next/image";
import { useRef } from "react";
import { ArrowLeft, ChartNoAxesColumn, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionExample } from "./connection-example";
import { ThemeToggle } from "./theme-toggle";

export function BrandHeader({
  onHome, onScores, home, disabled,
}: {
  onHome: () => void;
  onScores: () => void;
  home: boolean;
  disabled: boolean;
}) {
  const instructions = useRef<HTMLDialogElement>(null);

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b py-5 sm:py-6">
        <button onClick={onHome} disabled={disabled} aria-label="Zonkey home" className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">
          <span className="brand-mark flex size-11 items-center justify-center rounded-xl border">
            <Image src="/zonkey-mark.webp" alt="" width={29} height={34} priority className="h-8 w-7 object-contain" />
          </span>
          <span className="font-heading text-3xl font-bold tracking-[-0.06em]">zonkey</span>
        </button>
        <nav aria-label="Game navigation" className="flex gap-1">
          {!home && (
            <Button variant="ghost" onClick={onHome} disabled={disabled} className="hidden h-11 px-3 sm:inline-flex" aria-label="Back to home">
              <ArrowLeft className="size-4" /><span className="hidden sm:inline">Home</span>
            </Button>
          )}
          <Button variant="ghost" onClick={() => instructions.current?.showModal()} className="h-11 px-3" aria-label="How to play">
            <CircleHelp className="size-4" /><span className="hidden sm:inline">How to play</span>
          </Button>
          <Button variant="ghost" onClick={onScores} disabled={disabled} className="h-11 px-3" aria-label="Your scores">
            <ChartNoAxesColumn className="size-4" /><span className="hidden sm:inline">Your scores</span>
          </Button>
          <ThemeToggle />
        </nav>
      </header>
      <dialog ref={instructions} aria-labelledby="instructions-title" className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border bg-card p-6 text-foreground shadow-2xl backdrop:bg-foreground/60 backdrop:backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 id="instructions-title" className="text-2xl font-bold tracking-tight">How to play Zonkey.</h2>
          <Button variant="ghost" size="icon" className="size-11" onClick={() => instructions.current?.close()} aria-label="Close instructions"><X /></Button>
        </div>
        <ol className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
          <li><span className="eyebrow mb-1 block text-primary">01 · Pick your word</span>Enter any starting word. Zonkey has already picked its word; submit yours to reveal them together. Your opening entry counts as the first guess.</li>
          <li><span className="eyebrow mb-1 block text-primary">02 · Find your match</span>Different answers become your next two words. From guess two, synonyms can connect too.</li>
          <li><span className="eyebrow mb-1 block text-primary">03 · Score your Daily</span>Everyone faces the same five preset opening words. Each round allows five guesses. Connect on guesses 1–5 to earn 1,000, 800, 600, 400, or 200 points. A missed round scores 0. Finish all five for your total out of 5,000 and player comparison.</li>
          <li><span className="eyebrow mb-1 block text-primary">04 · Keep it wild</span>Unlimited has a fresh opening word and eight turns. Archive lets you play past five-round Dailies; earlier puzzles keep their original starting pairs.</li>
        </ol>
        <div className="mt-5"><ConnectionExample /></div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          A zonkey is a donkey–zebra hybrid. Finish each Daily on its UTC day to grow your streak, or play past puzzles in the archive as practice.
        </p>
        <Button className="mt-7 h-12 w-full rounded-xl" onClick={() => instructions.current?.close()}>Got it. Let&rsquo;s connect.</Button>
      </dialog>
    </>
  );
}
