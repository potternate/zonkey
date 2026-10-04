"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { Reveal } from "@/lib/game/types";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import { cn } from "@/lib/utils";
import { BigWord } from "./word";
import { FirstGuesses } from "./first-guesses";

interface Props {
  reveal: Reveal;
  gameOver: boolean;
  onContinue: () => void;
  firstGuesses?: FirstGuessBoard;
}

function Card({ label, word, matched, delay }: { label: string; word: string; matched: boolean; delay: number }) {
  return (
    <div
      className={cn(
        "animate-flip-in flex min-w-0 flex-col items-center gap-4 rounded-3xl border px-4 py-8",
        matched ? "border-success-border bg-success-muted text-success" : "border-border bg-card",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="eyebrow opacity-60">{label}</span>
      <BigWord word={word} className="text-[clamp(1.125rem,5vw,2rem)] sm:text-3xl" />
    </div>
  );
}

export function RevealScreen({ reveal, gameOver, onContinue, firstGuesses }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setTimeout(() => buttonRef.current?.focus(), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 pt-8">
      <div className="grid grid-cols-2 gap-3 [perspective:800px]">
        <Card label="YOU" word={reveal.playerAnswer} matched={reveal.matched} delay={0} />
        <Card label="ZONKEY AI" word={reveal.aiAnswer} matched={reveal.matched} delay={250} />
      </div>

      {reveal.matched && reveal.playerAnswer !== reveal.aiAnswer && (
        <p className="text-center text-sm text-success">Synonyms count as a connection.</p>
      )}

      <div className="animate-in fade-in fill-mode-both text-center delay-700 duration-500">
        {reveal.matched ? (
          <p className="animate-pop text-3xl font-bold tracking-tight text-success">You found your stripe.</p>
        ) : gameOver ? (
          <p className="text-lg font-bold">Out of rounds.</p>
        ) : (
          <p className="text-muted-foreground">No match. These are your next two words.</p>
        )}
      </div>

      <Button
        ref={buttonRef}
        onClick={onContinue}
        className="animate-in fade-in fill-mode-both h-14 rounded-2xl text-base font-semibold delay-700 duration-500"
      >
        {gameOver ? "See your result" : "Next connection →"}
      </Button>
      {reveal.roundNumber === 1 && firstGuesses && <FirstGuesses board={firstGuesses} yourWord={reveal.playerAnswer} />}
    </div>
  );
}
