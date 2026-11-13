"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareText } from "@/lib/client/share";
import type { DailyRunView } from "@/lib/game/daily-run";
import { addTally, EMPTY_TALLY, livesLeft, tallyRun, type SurvivalTally } from "@/lib/game/survival";
import { DailyGame } from "./daily-game";
import { ZonkeyReaction } from "./zonkey-reaction";

const BEST_KEY = "zonkey-survival-best";

export function survivalBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function recordBest(score: number): { best: number; isNew: boolean } {
  const previous = survivalBest();
  if (score <= previous) return { best: previous, isNew: false };
  try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
  return { best: score, isNew: score > 0 };
}

export function SurvivalGame({ onHome, onProgress }: { onHome: () => void; onProgress: () => void }) {
  const [before, setBefore] = useState<SurvivalTally>(EMPTY_TALLY);
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<{ tally: SurvivalTally; best: number; isNew: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onEnd(run: DailyRunView) {
    const tally = addTally(before, tallyRun(run));
    if (livesLeft(tally) === 0) setResult({ tally, ...recordBest(tally.total) });
    else setBefore(tally);
    setRunKey((key) => key + 1);
  }

  function restart() {
    setBefore(EMPTY_TALLY);
    setResult(null);
    setMessage(null);
    setRunKey((key) => key + 1);
  }

  async function share() {
    if (!result) return;
    const text = `Zonkey Survival\n${result.tally.total.toLocaleString("en-US")} pts · ${result.tally.rounds} rounds 🦓`;
    const outcome = await shareText(text, window.location.origin);
    if (outcome === "copied") setMessage("Copied to clipboard");
    if (outcome === "failed" || outcome === "blocked") setMessage("Sharing unavailable here.");
  }

  if (result) {
    const connected = result.tally.rounds - result.tally.lost;
    return (
      <div className="flex flex-1 flex-col items-center gap-6 py-8 text-center animate-in fade-in duration-500">
        <div className="space-y-3">
          <p className="eyebrow text-primary">Survival over</p>
          <h1 className="glitch font-pixel text-4xl tabular-nums">{result.tally.total.toLocaleString("en-US")}<span className="mt-3 block font-sans text-sm text-muted-foreground [text-shadow:none]">points</span></h1>
          <p className="text-sm text-muted-foreground">{result.tally.rounds} rounds · {connected} connected</p>
          {(result.isNew || result.best > 0) && (
            <p className={result.isNew ? "animate-pop glow font-pixel text-sm text-success uppercase" : "text-sm"}>
              {result.isNew ? "New best!" : `Best: ${result.best.toLocaleString("en-US")}`}
            </p>
          )}
        </div>
        <ZonkeyReaction className="w-full text-left" line={connected >= 3 ? "You've got stamina. Again?" : "Three strikes. Rematch?"} />
        <div className="w-full space-y-3">
          <Button onClick={restart} className="h-14 w-full text-base font-semibold">▶ Play again ◀</Button>
          <Button variant="outline" onClick={share} className="h-12 w-full gap-2"><Share2 className="size-4" />Share</Button>
          <p className="text-sm text-muted-foreground" aria-live="polite">{message}</p>
        </div>
        <Button variant="ghost" onClick={onHome} className="h-11">Back to home</Button>
      </div>
    );
  }

  return <DailyGame key={runKey} mode="unlimited" survival={{ before, onEnd }} onHome={onHome} onUnlimited={onHome} onProgress={onProgress} />;
}
