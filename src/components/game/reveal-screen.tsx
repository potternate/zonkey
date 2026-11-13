"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { haptic, playSfx } from "@/lib/client/sfx";
import type { Reveal } from "@/lib/game/types";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import { zonkeyLine } from "@/lib/game/reactions";
import { cn } from "@/lib/utils";
import { BigWord } from "./word";
import { FirstGuesses } from "./first-guesses";
import { HeatMeter } from "./heat-meter";
import { ScrambleWord } from "./scramble-word";
import { ZonkeyReaction } from "./zonkey-reaction";

interface Props {
  reveal: Reveal;
  gameOver: boolean;
  onContinue: () => void;
  firstGuesses?: FirstGuessBoard;
  continueLabel?: string;
  resultText?: string;
}

const WORD_CLASS = "text-[clamp(1.6rem,7vw,2.5rem)]";

function Card({ label, matched, delay, children }: { label: string; matched: boolean; delay: number; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "animate-flip-in flex min-w-0 flex-col items-center gap-2 border px-4 py-5",
        matched ? "border-success-border bg-success-muted text-success" : "border-border bg-card",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="eyebrow text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function RevealScreen({ reveal, gameOver, onContinue, firstGuesses, continueLabel, resultText }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [landed, setLanded] = useState(false);
  const matched = landed && reveal.matched;

  const land = useCallback(() => {
    setLanded(true);
    playSfx(reveal.matched ? "match" : "miss");
    haptic(reveal.matched ? "success" : "light");
  }, [reveal.matched]);

  useEffect(() => {
    if (landed) buttonRef.current?.focus();
  }, [landed]);

  const line = zonkeyLine({
    matched: reveal.matched,
    synonym: reveal.playerAnswer !== reveal.aiAnswer,
    opening: reveal.roundNumber === 1,
    roundOver: gameOver,
    closeness: reveal.closeness,
  }, `${reveal.playerAnswer}:${reveal.aiAnswer}:${reveal.roundNumber}`);

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="grid grid-cols-2 gap-3 [perspective:800px]">
        <Card label="YOU" matched={matched} delay={0}><BigWord word={reveal.playerAnswer} className={WORD_CLASS} /></Card>
        <Card label="ZONKEY AI" matched={matched} delay={250}>
          <ScrambleWord word={reveal.aiAnswer} delay={300} className={WORD_CLASS} onTick={() => playSfx("tick")} onDone={land} />
        </Card>
      </div>

      {landed && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          {resultText && <p className="text-center text-lg font-semibold tabular-nums">{resultText}</p>}
          {reveal.matched ? (
            <p className="animate-pop glow text-center font-pixel text-lg text-success uppercase">Connected!</p>
          ) : reveal.closeness !== undefined && <HeatMeter closeness={reveal.closeness} />}
          <ZonkeyReaction line={line} />
          {!reveal.matched && !gameOver && (
            <p className="-mt-2 text-center text-sm text-muted-foreground">
              Next pair: <span className="text-foreground uppercase">{reveal.playerAnswer} ↔ {reveal.aiAnswer}</span>
            </p>
          )}
        </div>
      )}

      <Button
        ref={buttonRef}
        onClick={onContinue}
        className={cn("h-14 text-base font-semibold transition-opacity", !landed && "pointer-events-none opacity-0")}
      >
        {continueLabel ?? (gameOver ? "See your result" : "Next connection →")}
      </Button>
      {landed && reveal.roundNumber === 1 && firstGuesses && <FirstGuesses board={firstGuesses} yourWord={reveal.playerAnswer} />}
    </div>
  );
}
