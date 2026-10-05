"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { copyText, shareText } from "@/lib/client/share";
import { buildDailyShareText, DAILY_MAX_SCORE } from "@/lib/game/daily-run";
import type { DailyRunView } from "@/lib/game/daily-run";
import { DailyScoreChart } from "./daily-score-chart";

export function DailyResult({ run, onUnlimited, onHome }: { run: DailyRunView; onUnlimited: () => void; onHome: () => void }) {
  const [copyOnly, setCopyOnly] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const [openSeparately, setOpenSeparately] = useState(false);
  useEffect(() => { setCopyOnly(typeof navigator.share !== "function"); }, []);

  async function share() {
    if (sharing) return;
    setSharing(true);
    setManualCopy(null);
    setMessage(null);
    setOpenSeparately(false);
    const url = `${window.location.origin}/?daily=${run.date}`;
    const text = buildDailyShareText(run, copyOnly ? url : undefined);
    const operation = copyOnly ? copyText(text) : shareText(text, url);
    void api.shareDaily(run.id);
    const outcome = await operation;
    setSharing(false);
    if (outcome === "copied") setMessage("Copied to clipboard");
    if (outcome === "failed" || outcome === "blocked") {
      setCopyOnly(true);
      setMessage("Sharing unavailable here. Copy your result below.");
      setManualCopy(buildDailyShareText(run, url));
      setOpenSeparately(outcome === "blocked" && window.self !== window.top);
    }
  }

  const solved = run.rounds.filter((round) => round.status === "won").length;
  return (
    <div className="flex flex-1 flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-3">
        <p className="eyebrow text-primary">{run.mode === "archive" ? "Archive" : "Daily"} #{run.puzzleNumber} complete</p>
        <h1 className="text-5xl font-bold tracking-tight tabular-nums">{run.score.toLocaleString("en-US")}<span className="mt-2 block text-sm font-normal text-muted-foreground">of {DAILY_MAX_SCORE.toLocaleString("en-US")} points</span></h1>
        <p className="text-sm text-muted-foreground">{solved} of 5 rounds connected.</p>
      </div>
      <div className="w-full space-y-3">
        <Button onClick={share} disabled={sharing} className="h-14 w-full gap-2 rounded-xl text-base font-semibold">
          {copyOnly ? <Copy className="size-4" /> : <Share2 className="size-4" />}{sharing ? "Sharing…" : copyOnly ? "Copy result" : "Share result"}
        </Button>
        {run.mode === "archive" ? (
          <Button asChild variant="outline" className="h-12 w-full rounded-xl"><Link href="/daily">Play another Archive</Link></Button>
        ) : <Button variant="outline" onClick={onUnlimited} className="h-12 w-full rounded-xl">Play Unlimited</Button>}
        {openSeparately && <a href={`/?daily=${run.date}`} target="_blank" rel="noopener noreferrer" className="block py-3 text-sm underline">Open game to share</a>}
        {manualCopy && <textarea aria-label="Result to copy" value={manualCopy} readOnly onFocus={(event) => event.currentTarget.select()} className="min-h-52 w-full rounded-xl border bg-card p-3 text-sm" />}
        <p className="text-sm text-muted-foreground" aria-live="polite">{message}</p>
      </div>
      {run.mode === "daily" && <DailyScoreChart id={run.id} score={run.score} />}
      <div className="w-full divide-y border-y text-left">
        {run.rounds.map((round) => (
          <details key={round.number}>
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-3 text-sm">
              <span>Round {round.number} · {round.startPair.a} + {round.startPair.b}</span>
              <span className="shrink-0 font-semibold tabular-nums">{round.score} pts</span>
            </summary>
            <ol className="space-y-2 pb-4 text-sm">
              {round.guesses.map((guess) => (
                <li key={guess.number} className={guess.matched ? "text-success" : "text-muted-foreground"}>
                  {guess.number}. {guess.wordA} + {guess.wordB} → You: {guess.playerAnswer} · AI: {guess.aiAnswer}{guess.matched ? " · Connected" : ""}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
      {run.mode === "daily" && <p className="text-xs text-muted-foreground">Next Daily at midnight UTC.</p>}
      <Button variant="ghost" onClick={onHome} className="h-11">Back to home</Button>
    </div>
  );
}
